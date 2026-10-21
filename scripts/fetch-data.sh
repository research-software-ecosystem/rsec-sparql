#!/usr/bin/env bash
# Download the data the published site uses into a data folder: datasets/*.ttl from
# research-software-ecosystem/content (shallow, sparse clone kept in a cache folder) and the
# latest EDAM.owl, then write the folder's index.json.
#
# Usage: scripts/fetch-data.sh [DATA_DIR]   (default: data/ at the repository root)
# Env:   CONTENT_DIR — where to keep the clone of the content repository (default: .cache/content)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${1:-$ROOT/data}"
CONTENT="${CONTENT_DIR:-$ROOT/.cache/content}"
REPO=https://github.com/research-software-ecosystem/content.git

if [ -d "$CONTENT/.git" ]; then
  echo "Updating $CONTENT"
  git -C "$CONTENT" fetch -q --depth 1 origin master
  git -C "$CONTENT" reset -q --hard FETCH_HEAD
else
  echo "Cloning datasets/ of $REPO into $CONTENT"
  git clone -q --depth 1 --filter=blob:none --sparse --branch master "$REPO" "$CONTENT"
  git -C "$CONTENT" sparse-checkout set datasets
fi

# TEMPORARY: bioconda-dump.ttl writes identifiers as unexpanded <biotools:XYZ> / <bioconda:XYZ>
# IRIs, which breaks links to bio.tools records
# (https://github.com/research-software-ecosystem/content/issues/4783). Expand them as the previous
# dumps did; this is a no-op once the dump is fixed upstream, then remove it. The clone is reset on
# every run, so rewriting it in place is safe.
grep -c -E '<(biotools|bioconda):' "$CONTENT"/datasets/*.ttl | grep -v ':0$' || echo "No prefixed IRIs to expand"
sed -i -E \
  -e 's#<biotools:#<https://bio.tools/#g' \
  -e 's#<bioconda:#<https://github.com/bioconda/bioconda-recipes/tree/master/recipes/#g' \
  "$CONTENT"/datasets/*.ttl

mkdir -p "$DEST"
echo "Downloading EDAM.owl"
curl --fail --location --retry 3 -sS -o "$DEST/EDAM.owl" https://edamontology.org/EDAM.owl
"$ROOT/update-data.sh" "$CONTENT/datasets" "$DEST"
