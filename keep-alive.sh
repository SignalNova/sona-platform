#!/bin/bash
# Check if Next.js server is running
if ! pgrep -f "next start" > /dev/null 2>&1; then
  cd /home/z/my-project && nohup npx next start -p 3000 >> /tmp/next-server.log 2>&1 &
fi

# Check if bore tunnel is running
if ! pgrep -f "bore local" > /dev/null 2>&1; then
  cd /home/z/my-project && nohup ./bore local 3000 --to bore.pub >> /tmp/bore.log 2>&1 &
fi
