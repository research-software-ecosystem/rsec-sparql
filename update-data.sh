#!/usr/bin/env bash
# Copy TTL datasets into ./data and regenerate data/index.json
set -euo pipefail
SRC="${1:-$HOME/content/datasets}"
cd "$(dirname "$0")"
mkdir -p data
cp "$SRC"/*.ttl data/
# Other RDF files placed manually in data/ (e.g. EDAM.owl) are kept and listed too
( cd data && shopt -s nullglob && printf '%s\n' *.ttl *.owl *.rdf *.nt | python3 -c 'import sys,json; print(json.dumps([l.strip() for l in sys.stdin], indent=1))' ) > data/index.json
echo "Copied TTL files; $(grep -c '"' data/index.json) files listed in data/index.json"
