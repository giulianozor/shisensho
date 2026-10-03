#!/bin/sh
#
#    Shisen-sho - a web port of KShisen, the KDE Shisen-Sho game
#    Runs a check page in a headless browser and prints what the page reports.
#
#    SPDX-FileCopyrightText: 2016 Frederik Schwarzer <schwarzer@kde.org>
#
#    SPDX-FileCopyrightText: 2026 Giuliano Zorzi
#    SPDX-License-Identifier: GPL-2.0-or-later
#
# Usage: browser-check.sh <page> <expected result>
# Needs a Chromium based browser. Use CHROME=/path/to/browser to select one.

set -eu

if [ "$#" -ne 2 ]; then
    echo "usage: $0 <page> <expected result>" >&2
    exit 2
fi

page=$1
expected=$2
CHROME=${CHROME:-chromium}
PORT=${PORT:-5175}
TIMEOUT=${TIMEOUT:-40000}

cd "$(dirname "$0")/.."

log="/tmp/kshisen-$(basename "$page" .html).log"

npx vite --port "$PORT" --strictPort </dev/null >"$log" 2>&1 &
server=$!
trap 'kill "$server" 2>/dev/null || true; wait "$server" 2>/dev/null || true' EXIT

i=0
while [ "$i" -lt 50 ]; do
    if curl --silent --fail --output /dev/null "http://localhost:$PORT/$page"; then
        break
    fi
    i=$((i + 1))
    sleep 0.2
done

dom=$("$CHROME" --headless=new --disable-gpu --no-sandbox --disable-dev-shm-usage \
    --autoplay-policy=no-user-gesture-required \
    --virtual-time-budget="$TIMEOUT" \
    --dump-dom "http://localhost:$PORT/$page" 2>/dev/null)

result=$(printf '%s' "$dom" | tr -d '\n' | sed -n 's/.*<pre id="out">\(.*\)<\/pre>.*/\1/p')
printf '%s\n' "$result"

case "$result" in
    "$expected") ;;
    "")
        echo "the check did not report a result, see $log" >&2
        exit 1
        ;;
    *)
        exit 1
        ;;
esac