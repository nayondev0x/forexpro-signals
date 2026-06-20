#!/bin/bash
# Signal Service Launcher — reads .env.local and passes as env vars
# Auto-restarts on crash

export $(grep -v '^#' /home/z/my-project/.env.local | xargs)
cd /home/z/my-project/mini-services/signal-service/dist

while true; do
  echo "[$(date '+%H:%M:%S')] Signal service starting..." >> /tmp/sig-watchdog.log
  node index.js >> /tmp/sig.log 2>&1
  CODE=$?
  echo "[$(date '+%H:%M:%S')] Exited code=$CODE, restart in 2s" >> /tmp/sig-watchdog.log
  sleep 2
done