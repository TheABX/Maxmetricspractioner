#!/bin/bash
# Copy QCBandSDK.framework into both project copies.
# Usage:
#   bash scripts/vendor-qc-sdk.sh
#   bash scripts/vendor-qc-sdk.sh /path/to/QCBandSDK.framework
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DESTS=(
  "$ROOT/mobile/modules/qc-band/ios/Frameworks"
  "/Users/deonkenzie/dev/MAXMetrics/MAXMetrics/mobile/modules/qc-band/ios/Frameworks"
)

FOUND="${1:-}"
if [ -n "$FOUND" ]; then
  if [ ! -d "$FOUND" ]; then
    echo "Not a folder: $FOUND"
    exit 1
  fi
else
  SEARCH_PATHS=(
    "$HOME/Downloads/QCBandSDKDemo"
    "$HOME/Downloads"
    "$HOME/Desktop"
    "$HOME/Documents"
  )
  for base in "${SEARCH_PATHS[@]}"; do
    [ -d "$base" ] || continue
    hit="$(find "$base" -maxdepth 6 \( -name 'QCBandSDK.framework' -o -name 'QCBandSDk.framework' \) -type d 2>/dev/null | head -n 1 || true)"
    if [ -n "$hit" ]; then
      FOUND="$hit"
      break
    fi
  done
fi

if [ -z "$FOUND" ]; then
  echo "QCBandSDK.framework is not on this Mac in Downloads/Desktop/Documents."
  echo "Unzip the QC iOS SDK (the package that contains a .framework, not only the PDF)."
  echo "Then run:"
  echo "  bash $ROOT/scripts/vendor-qc-sdk.sh /full/path/to/QCBandSDK.framework"
  exit 1
fi

NAME="$(basename "$FOUND")"
echo "Using $FOUND"
for dest in "${DESTS[@]}"; do
  mkdir -p "$dest"
  rm -rf "$dest/$NAME"
  cp -R "$FOUND" "$dest/"
  echo "Copied -> $dest/$NAME"
done
echo "Next: in Xcode, Product → Run onto the iPad so the library is compiled in."
