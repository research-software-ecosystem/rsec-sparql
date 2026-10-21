#!/usr/bin/env python3
"""Add gzip copies of indexed datasets, keeping originals for plain-file clients.

Usage: python3 scripts/compress-data.py DATA_DIR
"""
import gzip
import json
from pathlib import Path
import shutil
import sys

data_dir = Path(sys.argv[1])
index = data_dir / "index.json"
files = json.loads(index.read_text())

for entry in files:
    source = data_dir / entry["file"]
    compressed = source.with_name(source.name + ".gz")
    with source.open("rb") as src, compressed.open("wb") as dst:
        # Omit filename and timestamp so unchanged data produces identical gzip bytes.
        with gzip.GzipFile(filename="", mode="wb", fileobj=dst, compresslevel=9, mtime=0) as out:
            shutil.copyfileobj(src, out)
    entry["gzip"] = entry["file"] + ".gz"
    entry["gzipSize"] = compressed.stat().st_size

index.write_text(json.dumps(files, indent=1) + "\n")
print(f"Compressed {len(files)} datasets; original files and sizes retained")
