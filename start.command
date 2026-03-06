#!/bin/bash
cd "$(dirname "$0")"

LOG_FILE="/tmp/compose-dev-server.log"
: > "$LOG_FILE"
python3 ./dev-server.py > "$LOG_FILE" 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 20); do
  if [ -s "$LOG_FILE" ]; then
    URL=$(head -n 1 "$LOG_FILE")
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
