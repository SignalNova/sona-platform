#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# SONA Email Relay - Watchdog
# 
# Monitors tunnel URL changes and auto-updates GitHub Gist.
# Also ensures relay + tunnel stay running.
# Run via cron or pm2 (with --interpreter bash).
# ═══════════════════════════════════════════════════════════════

RELAY_DIR="/home/z/my-project/email-relay"
URL_FILE="$RELAY_DIR/current-tunnel-url.txt"
GIST_ID="c4c89af78e5f073912160edcea45a61b"
GITHUB_TOKEN="${GIST_GITHUB_TOKEN:-}"  # Read from env
RELAY_KEY="${RELAY_API_KEY:-sk-sona-relay-2024-secure}"
LOG_FILE="$RELAY_DIR/watchdog.log"

log() {
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $1" >> "$LOG_FILE"
}

# Get current tunnel URL from pm2 logs
get_tunnel_url() {
  grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' /home/z/.pm2/logs/cloudflared-tunnel-error.log 2>/dev/null | tail -1
}

# Update GitHub Gist
update_gist() {
  local url="$1"
  local status="$2"
  local timestamp
  timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  
  local json_content="{\"relayUrl\":\"$url\",\"relayKey\":\"$RELAY_KEY\",\"updatedAt\":\"$timestamp\",\"status\":\"$status\"}"
  
  local result
  result=$(curl -s -w "%{http_code}" -X PATCH "https://api.github.com/gists/$GIST_ID" \
    -H "Authorization: token $GITHUB_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"files\":{\"relay-config.json\":{\"content\":\"$json_content\"}}}" 2>/dev/null)
  
  local http_code="${result: -3}"
  if [ "$http_code" = "200" ]; then
    log "GIST UPDATED: $url (status=$status)"
    return 0
  else
    log "GIST UPDATE FAILED: HTTP $http_code"
    return 1
  fi
}

# Main watchdog logic
main() {
  # 1. Check if relay is running
  if ! pm2 describe sona-email-relay > /dev/null 2>&1; then
    log "RELAY DOWN - Restarting..."
    cd "$RELAY_DIR"
    SMTP_USER="helpsona.support@gmail.com" \
    SMTP_PASS="${SMTP_PASS:-}" \
    RELAY_PORT=3001 \
    RELAY_API_KEY="$RELAY_KEY" \
    pm2 start server.js --name "sona-email-relay" --time 2>/dev/null
    sleep 3
    pm2 save 2>/dev/null
  fi

  # 2. Check if tunnel is running
  if ! pm2 describe cloudflared-tunnel > /dev/null 2>&1; then
    log "TUNNEL DOWN - Restarting..."
    pm2 start cloudflared --name "cloudflared-tunnel" -- tunnel --url http://localhost:3001 --protocol quic 2>/dev/null
    sleep 10
    pm2 save 2>/dev/null
  fi

  # 3. Get current tunnel URL
  local current_url
  current_url=$(get_tunnel_url)
  
  if [ -z "$current_url" ]; then
    log "NO TUNNEL URL FOUND - skipping gist update"
    exit 0
  fi

  # 4. Check if URL changed
  local saved_url=""
  if [ -f "$URL_FILE" ]; then
    saved_url=$(cat "$URL_FILE" 2>/dev/null)
  fi

  if [ "$current_url" != "$saved_url" ]; then
    log "TUNNEL URL CHANGED: $saved_url -> $current_url"
    echo "$current_url" > "$URL_FILE"
    
    # Verify tunnel is working
    local health
    health=$(curl -s --connect-timeout 10 "$current_url/health" 2>/dev/null)
    local status="inactive"
    if [[ "$health" == *"ok"* ]]; then
      status="active"
      log "TUNNEL HEALTH CHECK: OK"
    else
      log "TUNNEL HEALTH CHECK: FAILED"
    fi
    
    # Update Gist with new URL
    update_gist "$current_url" "$status"
  fi

  # 5. Periodic health check - verify Gist URL matches and tunnel works
  local gist_url
  gist_url=$(curl -s "https://gist.githubusercontent.com/SignalNova/$GIST_ID/raw/relay-config.json" 2>/dev/null | grep -o '"relayUrl":"[^"]*"' | cut -d'"' -f4)
  
  if [ -n "$gist_url" ] && [ "$gist_url" != "$current_url" ]; then
    log "GIST STALE: gist=$gist_url actual=$current_url - updating..."
    update_gist "$current_url" "active"
  fi
}

main
