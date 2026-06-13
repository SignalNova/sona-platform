#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# SONA Email Relay - Gist URL Updater
# Updates the GitHub Gist with the current tunnel URL
# so the Next.js app can discover it automatically.
#
# Called by tunnel-manager.sh when the tunnel URL changes.
# ═══════════════════════════════════════════════════════════════

GITHUB_TOKEN="${GIST_GITHUB_TOKEN:-}"
GIST_ID="${GIST_ID:-c4c89af78e5f073912160edcea45a61b}"
RELAY_KEY="${RELAY_API_KEY:-sk-sona-relay-2024-secure}"

TUNNEL_URL="${1:-}"

if [ -z "$TUNNEL_URL" ]; then
  # Try to get URL from current-tunnel-url.txt
  TUNNEL_URL=$(cat /home/z/my-project/email-relay/current-tunnel-url.txt 2>/dev/null)
fi

if [ -z "$TUNNEL_URL" ]; then
  # Try to get from pm2 logs
  TUNNEL_URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' /home/z/.pm2/logs/cloudflared-tunnel-error.log 2>/dev/null | tail -1)
fi

if [ -z "$TUNNEL_URL" ]; then
  echo "ERROR: No tunnel URL found"
  exit 1
fi

# Verify the tunnel is actually working
HEALTH=$(curl -s --connect-timeout 10 "$TUNNEL_URL/health" 2>/dev/null)
if [[ "$HEALTH" != *"ok"* ]]; then
  echo "WARNING: Tunnel $TUNNEL_URL is not responding. Updating gist anyway but marking as inactive."
  STATUS="inactive"
else
  STATUS="active"
  echo "Tunnel $TUNNEL_URL is working!"
fi

# Update the GitHub Gist
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

curl -s -X PATCH "https://api.github.com/gists/$GIST_ID" \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"files\": {
      \"relay-config.json\": {
        \"content\": \"{\\\"relayUrl\\\":\\\"$TUNNEL_URL\\\",\\\"relayKey\\\":\\\"$RELAY_KEY\\\",\\\"updatedAt\\\":\\\"$TIMESTAMP\\\",\\\"status\\\":\\\"$STATUS\\\"}\"
      }
    }
  }" > /dev/null 2>&1

if [ $? -eq 0 ]; then
  echo "GitHub Gist updated successfully!"
  echo "  URL: $TUNNEL_URL"
  echo "  Status: $STATUS"
  echo "  Updated: $TIMESTAMP"
else
  echo "ERROR: Failed to update GitHub Gist"
  exit 1
fi
