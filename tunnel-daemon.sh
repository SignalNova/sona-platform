#!/bin/bash
# SONA Platform - Persistent Cloudflare Tunnel Daemon
# Automatically maintains a public URL for the platform

URL_FILE="/home/z/my-project/current-tunnel-url.txt"
LOG_FILE="/home/z/my-project/tunnel-daemon.log"
CLOUDFLARED="/tmp/cloudflared"

# Download cloudflared if not present
if [ ! -x "$CLOUDFLARED" ]; then
    echo "[$(date)] Downloading cloudflared..." >> "$LOG_FILE"
    curl -sL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o "$CLOUDFLARED" 2>/dev/null
    chmod +x "$CLOUDFLARED" 2>/dev/null
fi

if [ ! -x "$CLOUDFLARED" ]; then
    echo "[$(date)] ERROR: cloudflared not available" >> "$LOG_FILE"
    exit 1
fi

echo "[$(date)] Tunnel daemon started (PID: $$)" >> "$LOG_FILE"

while true; do
    pkill -f "cloudflared tunnel" 2>/dev/null || true
    sleep 2
    
    rm -f /tmp/cf-daemon.log
    
    echo "[$(date)] Starting new tunnel..." >> "$LOG_FILE"
    
    $CLOUDFLARED tunnel \
        --url http://localhost:81 \
        --protocol http2 \
        --edge-ip-version 4 \
        > /tmp/cf-daemon.log 2>&1 &
    
    CF_PID=$!
    
    URL=""
    for i in $(seq 1 30); do
        sleep 1
        URL=$(grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cf-daemon.log 2>/dev/null | head -1)
        if [ -n "$URL" ]; then
            break
        fi
    done
    
    if [ -z "$URL" ]; then
        echo "[$(date)] Failed to get tunnel URL, retrying in 5s" >> "$LOG_FILE"
        kill $CF_PID 2>/dev/null || true
        sleep 5
        continue
    fi
    
    echo "$URL" > "$URL_FILE"
    sed -i "s|NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=$URL|" /home/z/my-project/.env 2>/dev/null
    echo "[$(date)] TUNNEL ACTIVE: $URL (PID: $CF_PID)" >> "$LOG_FILE"
    
    # Wait for the tunnel process to die
    while kill -0 $CF_PID 2>/dev/null; do
        sleep 2
    done
    
    echo "[$(date)] TUNNEL DIED: $URL" >> "$LOG_FILE"
    sleep 3
done
