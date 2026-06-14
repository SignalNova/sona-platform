#!/bin/bash
set -e
echo "=== Starting Build ==="
echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"
echo "Memory: $(free -m | head -2)"

echo "=== Installing dependencies ==="
npm install --legacy-peer-deps 2>&1 | tail -5

echo "=== Generating Prisma Client ==="
npx prisma generate 2>&1 | tail -5

echo "=== Building Next.js ==="
NODE_OPTIONS="--max-old-space-size=460" next build 2>&1 | tail -30

echo "=== Build Complete ==="
