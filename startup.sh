#!/bin/sh
# Restart contract: probe preview, start only if down, return fast.
set -eu
cd /workspace
if curl -sf -o /dev/null --max-time 1 http://127.0.0.1:8080/; then
  exit 0
fi
npm run dev > /tmp/lve-dev.log 2>&1 &
for i in $(seq 1 40); do
  if curl -sf -o /dev/null --max-time 1 http://127.0.0.1:8080/; then
    exit 0
  fi
  sleep 0.25
done
exit 0
