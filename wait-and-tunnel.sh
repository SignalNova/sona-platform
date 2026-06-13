#!/bin/bash
echo "[$(date)] Waiting 30 minutes for Cloudflare rate limit to clear..." >> /home/z/my-project/tunnel-wait.log
sleep 1800  # 30 minutes

echo "[$(date)] Attempting tunnel creation..." >> /home/z/my-project/tunnel-wait.log

pkill -9 -f cloudflared 2>/dev/null; sleep 5

rm -f /tmp/cf-wait.log
/tmp/cloudflared2 tunnel --url http://127.0.0.1:81 --protocol http2 > /tmp/cf-wait.log 2>&1 &
PID=$!

URL=""
for i in $(seq 1 20); do
  sleep 3
  URL=$(grep -oE "https://[a-z0-9-]+\.trycloudflare\.com" /tmp/cf-wait.log 2>/dev/null | head -1)
  [ -n "$URL" ] && break
done

if [ -n "$URL" ]; then
  echo "$URL" > /home/z/my-project/current-tunnel-url.txt
  sed -i "s|NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=$URL|" /home/z/my-project/.env 2>/dev/null
  echo "[$(date)] TUNNEL ACTIVE: $URL" >> /home/z/my-project/tunnel-wait.log
  
  # Keep the tunnel alive
  while kill -0 $PID 2>/dev/null; do
    sleep 60
  done
  echo "[$(date)] Tunnel process died" >> /home/z/my-project/tunnel-wait.log
else
  ERR=$(grep "429" /tmp/cf-wait.log 2>/dev/null | head -1)
  echo "[$(date)] FAILED: $ERR" >> /home/z/my-project/tunnel-wait.log
fi
