#!/bin/sh
# Builds the small files in dist/ from src/. Needs esbuild (npm i -g esbuild).
set -e
for f in form select phone video-unlock; do
  esbuild "src/$f.js" --minify --charset=ascii --legal-comments=inline --log-level=warning > "dist/$f.min.js"
done
echo "Built dist/"
