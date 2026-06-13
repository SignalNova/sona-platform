#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# SONA Email Relay - Tunnel Monitor & Auto-Updater
# 
# Runs in the background, monitors the Cloudflare tunnel,
# and updates the GitHub Gist when the URL changes.
# Also restarts the relay if it goes down.
#
# Usage: bash monitor-relay.sh &
# ═══════════════════════════════════════════════════════════════

RELAY_DIR="/home/z/my-project/email-relay"
LOG_FILE="$RELAY_DIR/logs/monitor.log"
LAST_URL_FILE="$RELAY_DIR/.last-known-url"

mkdir -p "$RELAY_DIR/logs"

echo "$(date -u): Monitor started" >> "$LOG_FILE"

while true; do
  sleep 30
  
  # Get current tunnel URL from pm2 logs
  CURRENT_URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' /home/z/.pm2/logs/cloudflared-tunnel-error.log 2>/dev/null | tail -1)
  
  if [ -z "$CURRENT_URL" ]; then
    echo "$(date -u): No tunnel URL found in logs" >> "$LOG_FILE"
    
    # Try to restart the tunnel
    if ! pm2 describe cloudflared-tunnel > /dev/null 2>&1; then
      echo "$(date -u): Restarting cloudflared tunnel..." >> "$LOG_FILE"
      pm2 start cloudflared --name "cloudflared-tunnel" -- tunnel --url http://localhost:3001 --protocol quic 2>&1 >> "$LOG_FILE"
      sleep 10
    fi
    continue
  fi
  
  # Check if URL changed
  LAST_URL=$(cat "$LAST_URL_FILE" 2>/dev/null || echo "")
  
  if [ "$CURRENT_URL" != "$LAST_URL" ]; then
    echo "$(date -u): Tunnel URL changed: $LAST_URL -> $CURRENT_URL" >> "$LOG_FILE"
    echo "$CURRENT_URL" > "$LAST_URL_FILE"
    echo "$CURRENT_URL" > "$RELAY_DIR/current-tunnel-url.txt"
    
    # Update GitHub Gist
    bash "$RELAY_DIR/update-gist.sh" "$CURRENT_URL" >> "$LOG_FILE" 2>&1
    
    # Update local .env
    sed -i "s|EMAIL_RELAY_URL=.*|EMAIL_RELAY_URL=$CURRENT_URL|" /home/z/my-project/.env
    echo "$(date -u): Updated local .env" >> "$LOG_FILE"
  fi
  
  # Check tunnel health
  HEALTH=$(curl -s --connect-timeout 5 "$CURRENT_URL/health" 2>/dev/null)
  if [[ "$HEALTH" != *"ok"* ]]; then
    echo "$(date -u): Tunnel health check FAILED" >> "$LOG_FILE"
    
    # Restart cloudflared if needed
    if ! pm2 describe cloudflared-tunnel > /dev/null 2>&1; then
      echo "$(date -u): Restarting cloudflared tunnel..." >> "$LOG_FILE"
      pm2 restart cloudflared-tunnel 2>&1 >> "$LOG_FILE" || \
      pm2 start cloudflared --name "cloudflared-tunnel" -- tunnel --url http://localhost:3001 --protocol quic 2>&1 >> "$LOG_FILE"
      sleep 10
    fi
  fi
  
  # Check relay health
  RELAY_HEALTH=$(curl -s --connect-timeout 5 http://localhost:3001/health 2>/dev/null)
  if [[ "$RELAY_HEALTH" != *"ok"* ]]; then
    echo "$(date -u): Relay health check FAILED, restarting..." >> "$LOG_FILE"
    pm2 restart sona-email-relay 2>&1 >> "$LOG_FILE"
    sleep 5
  fi
  
done
