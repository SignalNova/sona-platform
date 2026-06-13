#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# SONA Email Relay - Tunnel Manager
# 
# Manages the email relay and Cloudflare tunnel lifecycle.
# Auto-restarts on failure, tracks tunnel URL changes.
#
# Usage:
#   ./tunnel-manager.sh start   - Start relay + tunnel
#   ./tunnel-manager.sh status  - Check status
#   ./tunnel-manager.sh url     - Get current tunnel URL
#   ./tunnel-manager.sh stop    - Stop everything
# ═══════════════════════════════════════════════════════════════

RELAY_DIR="/home/z/my-project/email-relay"
RELAY_PORT=3001
RELAY_API_KEY="${RELAY_API_KEY:-}"  # Set via env
SMTP_USER="${SMTP_USER:-}"  # Set via env
SMTP_PASS="${SMTP_PASS:-}"  # Set via env
URL_FILE="$RELAY_DIR/current-tunnel-url.txt"
RENDER_ENV_FILE="/home/z/my-project/.env"

start() {
  echo "Starting SONA Email Relay..."
  
  # Ensure relay is running
  if ! pm2 describe sona-email-relay > /dev/null 2>&1; then
    cd "$RELAY_DIR"
    SMTP_USER="$SMTP_USER" \
    SMTP_PASS="$SMTP_PASS" \
    RELAY_PORT="$RELAY_PORT" \
    RELAY_API_KEY="$RELAY_API_KEY" \
    pm2 start server.js --name "sona-email-relay" \
      --node-args="--max-old-space-size=256" \
      --time
    sleep 3
  fi
  
  # Ensure tunnel is running
  if ! pm2 describe cloudflared-tunnel > /dev/null 2>&1; then
    pm2 start cloudflared --name "cloudflared-tunnel" -- tunnel --url http://localhost:$RELAY_PORT --protocol quic
    sleep 8
  fi
  
  # Get and save tunnel URL
  get_url
  
  pm2 save
}

get_url() {
  local url
  url=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' /home/z/.pm2/logs/cloudflared-tunnel-error.log 2>/dev/null | tail -1)
  
  if [ -n "$url" ]; then
    echo "$url" > "$URL_FILE"
    
    # Check if URL changed
    local old_url
    old_url=$(grep "EMAIL_RELAY_URL=" "$RENDER_ENV_FILE" 2>/dev/null | cut -d= -f2)
    
    if [ "$url" != "$old_url" ]; then
      echo ""
      echo "⚠️  TUNNEL URL CHANGED!"
      echo "   Old: $old_url"
      echo "   New: $url"
      echo ""
      echo "   UPDATE RENDER ENVIRONMENT VARIABLES:"
      echo "   EMAIL_RELAY_URL=$url"
      echo ""
      
      # Update local .env
      sed -i "s|EMAIL_RELAY_URL=.*|EMAIL_RELAY_URL=$url|" "$RENDER_ENV_FILE"
      echo "   Local .env updated automatically"
    fi
    
    echo "Current tunnel URL: $url"
  else
    echo "ERROR: Could not find tunnel URL"
  fi
}

status() {
  echo "=== SONA Email Relay Status ==="
  pm2 list 2>&1 | grep -E "cloudflared|sona-email"
  echo ""
  
  local url
  url=$(cat "$URL_FILE" 2>/dev/null)
  if [ -n "$url" ]; then
    echo "Tunnel URL: $url"
    
    # Test tunnel health
    local health
    health=$(curl -s --connect-timeout 10 "$url/health" 2>/dev/null)
    if [[ "$health" == *"ok"* ]]; then
      echo "Tunnel Status: ✅ Working"
    else
      echo "Tunnel Status: ❌ Not responding"
    fi
  else
    echo "No tunnel URL found"
  fi
  
  # Test local relay
  local local_health
  local_health=$(curl -s --connect-timeout 5 "http://localhost:$RELAY_PORT/health" 2>/dev/null)
  if [[ "$local_health" == *"ok"* ]]; then
    echo "Local Relay: ✅ Working"
  else
    echo "Local Relay: ❌ Not responding"
  fi
}

stop() {
  echo "Stopping SONA Email Relay..."
  pm2 delete cloudflared-tunnel 2>/dev/null
  pm2 delete sona-email-relay 2>/dev/null
  pm2 save
  echo "Stopped."
}

case "${1:-status}" in
  start)  start ;;
  status) status ;;
  url)    get_url ;;
  stop)   stop ;;
  *)      echo "Usage: $0 {start|status|url|stop}" ;;
esac
