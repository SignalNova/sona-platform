#!/bin/bash
cd /home/z/my-project
while true; do
  echo "Starting Next.js dev server..."
  NODE_OPTIONS='--max-old-space-size=512' node node_modules/next/dist/bin/next dev -p 3000 --webpack 2>&1
  echo "Server crashed/exited. Restarting in 3 seconds..."
  sleep 3
done
