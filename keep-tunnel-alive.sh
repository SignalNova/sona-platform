#!/bin/bash
while true; do
  # Kill any existing cloudflared
  pkill -f "cloudflared tunnel" 2>/dev/null
  sleep 2
  
  # Start fresh
  cloudflared tunnel --url http://localhost:3000 --no-autoupdate --protocol http2 --edge-ip-version 4 > /tmp/cf-daemon.log 2>&1 &
  CF_PID=$!
  
  # Wait for tunnel URL
  sleep 20
  TUNNEL_URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' /tmp/cf-daemon.log | head -1)
  if [ -n "$TUNNEL_URL" ]; then
    echo "$TUNNEL_URL" > /home/z/my-project/current-tunnel-url.txt
    echo "$(date): Tunnel active: $TUNNEL_URL" >> /tmp/tunnel-daemon.log
  fi
  
  # Wait for process to die
  wait $CF_PID 2>/dev/null
  echo "$(date): Tunnel died, restarting..." >> /tmp/tunnel-daemon.log
  sleep 10
done
