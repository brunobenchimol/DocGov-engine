#!/usr/bin/env bash
set -euo pipefail

REPO="brunobenchimol/DocGov-engine"
ASSET_NAME="docgov-engine-linux-x64"

# 1. Resolução resiliente do diretório de instalação
SCRIPT_DIR=""
if [ -n "${BASH_SOURCE[0]:-}" ] && [ -f "${BASH_SOURCE[0]}" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
fi

if [ -n "${1:-}" ]; then
  TARGET_DIR="$1"
elif [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/../package.json" ]; then
  TARGET_DIR="$SCRIPT_DIR/../bin"
else
  TARGET_DIR="${HOME}/.docgov/bin"
fi

mkdir -p "$TARGET_DIR"
TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"
DEST="$TARGET_DIR/docgov-engine"
URL="https://github.com/$REPO/releases/latest/download/$ASSET_NAME"

echo "================================================================="
echo "📦 Instalador do docgov-engine (Linux x64)"
echo "================================================================="
echo "Origem:  $URL"
echo "Destino: $DEST"
echo ""
echo "Iniciando download..."

# 2. Download com Fail-Fast
if command -v curl >/dev/null 2>&1; then
  curl -fsSL "$URL" -o "$DEST"
elif command -v wget >/dev/null 2>&1; then
  wget -qO "$DEST" "$URL"
else
  echo "ERRO FATAL: Nem 'curl' nem 'wget' foram encontrados no sistema." >&2
  exit 1
fi

chmod +x "$DEST"

# 3. Sanity check de tamanho do binário
FILE_SIZE=$(wc -c < "$DEST" | tr -d '[:space:]')
MIN_SIZE=$((50 * 1024 * 1024)) # 50 MB

if [ "$FILE_SIZE" -lt "$MIN_SIZE" ]; then
  rm -f "$DEST"
  echo "ERRO FATAL: Binário baixado corrompido ou incompleto ($FILE_SIZE bytes, mínimo esperado: $MIN_SIZE bytes). Arquivo removido." >&2
  exit 1
fi

# 4. Validação funcional imediata (--version)
VERSION_OUTPUT="$("$DEST" --version 2>&1 || true)"
if ! echo "$VERSION_OUTPUT" | grep -qE "docgov-engine[[:space:]]+v"; then
  echo "ERRO FATAL: O binário baixado em $DEST não respondeu corretamente ao teste de execução (--version)." >&2
  echo "Saída obtida: $VERSION_OUTPUT" >&2
  exit 1
fi

echo ""
echo "✅ Sucesso! $VERSION_OUTPUT instalado e validado."
echo "Localização: $DEST"
echo ""
echo "💡 Dicas de Configuração:"
echo "  1. Para usar diretamente no terminal, adicione ao seu PATH se necessário:"
echo "     export PATH=\"$TARGET_DIR:\$PATH\""
echo ""
echo "  2. Para configurar no Claude Desktop ou Antigravity MCP (claude_desktop_config.json):"
echo "     \"docgov-engine\": {"
echo "       \"command\": \"$DEST\","
echo "       \"args\": []"
echo "     }"
echo ""
