#!/bin/bash
# Watchdog: keeps signal service alive
cd /home/z/my-project/mini-services/signal-service/dist
while true; do
  echo "[$(date)] Starting signal service..." >> /tmp/sig-watchdog.log
  node index.js >> /tmp/sig.log 2>&1
  EXIT_CODE=$?
  echo "[$(date)] Signal service exited with code $EXIT_CODE, restarting in 3s..." >> /tmp/sig-watchdog.log
  sleep 3
done