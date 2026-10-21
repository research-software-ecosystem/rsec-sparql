#!/usr/bin/env bash
# Copy TTL datasets into a data folder and regenerate its index.json
# Usage: ./update-data.sh [SOURCE_DIR] [DATA_DIR]
#   SOURCE_DIR defaults to ~/content/datasets, DATA_DIR to the data/ folder next to this script
set -euo pipefail
SRC="${1:-$HOME/content/datasets}"
DEST="${2:-$(dirname "$0")/data}"
mkdir -p "$DEST"
cp "$SRC"/*.ttl "$DEST"/
# Other RDF files placed manually in the data folder (e.g. EDAM.owl) are kept and listed too.
# Sizes are used by the loading bar.
( cd "$DEST" && shopt -s nullglob && printf '%s\n' *.ttl *.owl *.rdf *.nt | python3 -c '
import sys, json, os
files = [{"file": l.strip(), "size": os.path.getsize(l.strip())} for l in sys.stdin]
json.dump(files, open("index.json", "w"), indent=1)
print(f"{len(files)} files listed in index.json")' )
