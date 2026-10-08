#!/usr/bin/env bash
# Builds the Chrome Web Store upload: dist/wa-group-number-exporter-<version>.zip
# containing only the files the extension needs (no tests, docs or tools).
set -euo pipefail
cd "$(dirname "$0")/.."

npm test --silent >/dev/null || { echo "Tests failed; not packaging." >&2; exit 1; }

VERSION=$(python3 -c "import json;print(json.load(open('manifest.json'))['version'])")
OUT="dist/wa-group-number-exporter-$VERSION.zip"
mkdir -p dist
rm -f "$OUT"
zip -qr -X "$OUT" manifest.json icons src -x '*.DS_Store'
echo "Built $OUT"
unzip -l "$OUT" | tail -n +4 | sed '$d' | sed '$d' | awk '{print "  " $4}'
