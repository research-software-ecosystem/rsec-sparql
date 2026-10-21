#!/usr/bin/env bash
# Copy TTL datasets into ./data and regenerate data/index.json
set -euo pipefail
SRC="${1:-$HOME/content/datasets}"
cd "$(dirname "$0")"
mkdir -p data
cp "$SRC"/*.ttl data/
# Other RDF files placed manually in data/ (e.g. EDAM.owl) are kept and listed too.
# Sizes are used by the loading bar.
( cd data && shopt -s nullglob && printf '%s\n' *.ttl *.owl *.rdf *.nt | python3 -c '
import sys, json, os
files = [{"file": l.strip(), "size": os.path.getsize(l.strip())} for l in sys.stdin]
json.dump(files, open("index.json", "w"), indent=1)
print(f"{len(files)} files listed in data/index.json")' )
