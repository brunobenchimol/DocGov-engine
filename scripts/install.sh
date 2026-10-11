#!/usr/bin/env bash
set -e

REPO="brunobenchimol/docgov-docx-engine"
ASSET_NAME="docgov-docx-linux-x64"
BIN_DIR="${1:-$(dirname "$0")/../bin}"
mkdir -p "$BIN_DIR"
DEST="$BIN_DIR/docgov-docx"

URL="https://github.com/$REPO/releases/latest/download/$ASSET_NAME"
echo "Baixando docgov-docx para Linux de $URL ..."
curl -fL "$URL" -o "$DEST"
chmod +x "$DEST"
echo "Download concluído e permissão concedida: $DEST"

