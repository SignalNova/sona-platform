#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# SONA Email Service - Startup & Monitoring Script
# 
# This script starts and monitors:
# 1. Email Relay Server (pm2 managed)
# 2. Cloudflare Tunnel (for public access)
# 3. Auto-restarts tunnel if it disconnects
#
# Usage: ./start-email-service.sh
# ═══════════════════════════════════════════════════════════════

set -e

RELAY_DIR="/home/z/my-project/email-relay"
RELAY_PORT=3001
RELAY_API_KEY="sk-sona-relay-2024-secure"
SMTP_USER="helpsona.support@gmail.com"
SMTP_PASS="${SMTP_PASS:-}"  # Set via env
LOG_DIR="$RELAY_DIR/logs"
TUNNEL_LOG="$LOG_DIR/tunnel.log"
URL_FILE="$RELAY_DIR/current-tunnel-url.txt"

# Create log directory
mkdir -p "$LOG_DIR"

echo "══════════════════════════════════════════════════════════"
echo "  SONA Email Service - Starting..."
echo "══════════════════════════════════════════════════════════"

# Step 1: Kill existing processes
echo "[1/4] Cleaning up existing processes..."
pkill -f "cloudflared tunnel" 2>/dev/null || true
pm2 delete sona-email-relay 2>/dev/null || true
sleep 2

# Step 2: Start Email Relay Server with pm2
echo "[2/4] Starting Email Relay Server..."
cd "$RELAY_DIR"
SMTP_USER="$SMTP_USER" \
SMTP_PASS="$SMTP_PASS" \
RELAY_PORT="$RELAY_PORT" \
RELAY_API_KEY="$RELAY_API_KEY" \
pm2 start server.js --name "sona-email-relay" \
  --node-args="--max-old-space-size=256" \
  --log "$LOG_DIR/relay.log" \
  --error-log "$LOG_DIR/relay-error.log" \
  --time

# Wait for relay to start
sleep 3

# Verify relay is running
if ! curl -s http://localhost:$RELAY_PORT/health > /dev/null 2>&1; then
  echo "❌ Email Relay failed to start!"
  pm2 logs sona-email-relay --lines 20 --nostream
  exit 1
fi
echo "✅ Email Relay Server is running on port $RELAY_PORT"

# Step 3: Start Cloudflare Tunnel
echo "[3/4] Starting Cloudflare Tunnel..."
cloudflared tunnel --url http://localhost:$RELAY_PORT --protocol quic > "$TUNNEL_LOG" 2>&1 &
TUNNEL_PID=$!
echo "   Tunnel PID: $TUNNEL_PID"

# Wait for tunnel URL
TUNNEL_URL=""
for i in $(seq 1 30); do
  sleep 1
  TUNNEL_URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$TUNNEL_LOG" 2>/dev/null | head -1)
  if [ -n "$TUNNEL_URL" ]; then
    break
  fi
  echo "   Waiting for tunnel URL... ($i/30)"
done

if [ -z "$TUNNEL_URL" ]; then
  echo "❌ Failed to get tunnel URL!"
  cat "$TUNNEL_LOG"
  exit 1
fi

# Save tunnel URL
echo "$TUNNEL_URL" > "$URL_FILE"

# Step 4: Verify the tunnel works
echo "[4/4] Verifying tunnel connectivity..."
sleep 3

HEALTH=$(curl -s --connect-timeout 10 "$TUNNEL_URL/health" 2>/dev/null || echo "FAILED")
if [[ "$HEALTH" == *"ok"* ]]; then
  echo "✅ Tunnel is working!"
else
  echo "⚠️  Tunnel health check failed, but it may work shortly."
fi

# Print summary
echo ""
echo "══════════════════════════════════════════════════════════"
echo "  SONA Email Service - RUNNING!"
echo "══════════════════════════════════════════════════════════"
echo ""
echo "  📧 Email Relay: http://localhost:$RELAY_PORT"
echo "  🌐 Public URL:  $TUNNEL_URL"
echo "  🔑 API Key:     $RELAY_API_KEY"
echo ""
echo "  Update Render environment variables:"
echo "    EMAIL_RELAY_URL=$TUNNEL_URL"
echo "    EMAIL_RELAY_KEY=$RELAY_API_KEY"
echo ""
echo "  Monitor: pm2 logs sona-email-relay"
echo "  Stop:    pm2 stop sona-email-relay && pkill -f cloudflared"
echo "══════════════════════════════════════════════════════════"

# Save PIDs for monitoring
echo "$TUNNEL_PID" > "$RELAY_DIR/tunnel-pid.txt"
echo "$$" > "$RELAY_DIR/monitor-pid.txt"

# Step 5: Monitor and auto-restart tunnel
echo ""
echo "Monitoring tunnel... (Ctrl+C to stop)"

LAST_URL="$TUNNEL_URL"
while true; do
  sleep 60
  
  # Check if tunnel process is alive
  if ! kill -0 $TUNNEL_PID 2>/dev/null; then
    echo "$(date): Tunnel process died. Restarting..."
    pkill -f "cloudflared tunnel" 2>/dev/null || true
    sleep 2
    
    cloudflared tunnel --url http://localhost:$RELAY_PORT --protocol quic > "$TUNNEL_LOG" 2>&1 &
    TUNNEL_PID=$!
    
    # Wait for new URL
    for i in $(seq 1 30); do
      sleep 1
      NEW_URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$TUNNEL_LOG" 2>/dev/null | head -1)
      if [ -n "$NEW_URL" ]; then
        if [ "$NEW_URL" != "$LAST_URL" ]; then
          echo "$(date): ⚠️  Tunnel URL changed!"
          echo "$(date): Old: $LAST_URL"
          echo "$(date): New: $NEW_URL"
          echo "$NEW_URL" > "$URL_FILE"
          LAST_URL="$NEW_URL"
          echo ""
          echo "  ⚠️  UPDATE RENDER ENV VARS:"
          echo "    EMAIL_RELAY_URL=$NEW_URL"
          echo ""
        fi
        break
      fi
    done
  fi
  
  # Check if relay is alive
  if ! curl -s http://localhost:$RELAY_PORT/health > /dev/null 2>&1; then
    echo "$(date): Relay health check failed. Restarting..."
    pm2 restart sona-email-relay
    sleep 5
  fi
done
