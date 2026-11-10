#!/bin/sh
# Builds the small files in dist/ from src/. Needs esbuild (npm i -g esbuild).
# geo.js is shared: it is bundled into phone and locale.
set -e
for f in form select phone video-unlock locale; do
  esbuild "src/$f.js" --bundle --format=iife --minify --charset=ascii --legal-comments=inline --log-level=warning > "dist/$f.min.js"
done
echo "Built dist/"
