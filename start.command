#!/bin/bash
cd "$(dirname "$0")"

LOG_FILE="/tmp/compose-dev-server.log"
: > "$LOG_FILE"
npm run dev -- --host 127.0.0.1 > "$LOG_FILE" 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 100); do
  if [ -f "$LOG_FILE" ]; then
    URL=$(grep -Eo 'http://127\.0\.0\.1:[0-9]+' "$LOG_FILE" | head -n 1)
    if [ -n "$URL" ]; then
      open "$URL"
      wait "$SERVER_PID"
      exit $?
    fi
  fi
  sleep 0.2
done

cat "$LOG_FILE"
wait "$SERVER_PID"
