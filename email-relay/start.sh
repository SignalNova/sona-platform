#!/bin/bash
# SONA Email Relay Startup Script
# Starts the email relay server and Cloudflare tunnel

cd /home/z/my-project/email-relay

# Set environment
export SMTP_USER=helpsona.support@gmail.com
export SMTP_PASS="${SMTP_PASS:-}"  # Set via env
export RELAY_PORT=3001
export RELAY_API_KEY=sk-sona-relay-2024-secure

# Kill existing processes
pkill -f "cloudflared" 2>/dev/null
pm2 delete sona-email-relay 2>/dev/null
sleep 2

# Start email relay with pm2
pm2 start server.js --name "sona-email-relay" --node-args="--max-old-space-size=256"

# Wait for relay to start
sleep 3

# Start Cloudflare tunnel
cloudflared tunnel --url http://localhost:3001 --protocol quic > tunnel.log 2>&1 &
TUNNEL_PID=$!

# Wait for tunnel URL
for i in $(seq 1 30); do
  sleep 1
  URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' tunnel.log 2>/dev/null | head -1)
  if [ -n "$URL" ]; then
    echo "======================================"
    echo "SONA Email Relay is RUNNING!"
    echo "======================================"
    echo "Tunnel URL: $URL"
    echo "API Key: $RELAY_API_KEY"
    echo ""
    echo "Update Render environment variables:"
    echo "  EMAIL_RELAY_URL=$URL"
    echo "  EMAIL_RELAY_KEY=$RELAY_API_KEY"
    echo "======================================"
    
    # Save the tunnel URL for reference
    echo "$URL" > /home/z/my-project/email-relay/current-tunnel-url.txt
    
    break
  fi
done

# Keep script running to maintain tunnel
wait $TUNNEL_PID
