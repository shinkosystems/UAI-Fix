#!/usr/bin/env bash
# Script de Instalação Automática do Universal Systems Squad em qualquer Repositório

TARGET_DIR="$1"

if [ -z "$TARGET_DIR" ]; then
  echo "Erro: Forneça o caminho do repositório destino."
  echo "Uso: ./install.sh /caminho/do/projeto"
  exit 1
fi

SQUAD_SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DESTINATION="$TARGET_DIR/squads/universal-systems-squad"

echo "🚀 Instalando Universal Multiplatform & AI Systems Squad em: $DESTINATION"

mkdir -p "$TARGET_DIR/squads"
cp -r "$SQUAD_SOURCE_DIR" "$TARGET_DIR/squads/"

echo "✅ Squad instalado com sucesso!"
echo "📋 Execute no projeto: /opensquad run universal-systems-squad"
