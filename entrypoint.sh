#!/bin/sh
set -e

echo "========================================="
echo "  SONA Platform - Hugging Face Spaces"
echo "========================================="

# Push schema to database (creates tables automatically)
echo "[SONA] Setting up database..."
MAX_RETRIES=10
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if npx prisma db push --accept-data-loss 2>&1; then
        echo "[SONA] Database schema pushed successfully!"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "[SONA] Database not ready, retrying in 5s... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 5
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "[SONA] WARNING: Could not push schema. Starting anyway..."
fi

# Start Next.js standalone server
echo "[SONA] Starting Next.js server on port $PORT..."
exec node .next/standalone/server.js
