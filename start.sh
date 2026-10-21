#!/usr/bin/env bash
# Run the site locally with its data: download the data first if data/ has none (or with
# --refresh, to update it), then serve the repository on http://localhost:PORT (default 8000).
#
# Usage: ./start.sh [--refresh]
set -euo pipefail
cd "$(dirname "$0")"
PORT="${PORT:-8000}"

if [ "${1:-}" = "--refresh" ] || [ ! -f data/index.json ]; then
  echo "Fetching the data used by the published site…"
  scripts/fetch-data.sh data
fi

echo "Serving on http://localhost:$PORT/ (Ctrl+C to stop)"
exec python3 -m http.server "$PORT" --bind 127.0.0.1
