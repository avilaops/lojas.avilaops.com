#!/usr/bin/env bash
# Monta o standalone.tgz do jeito certo, e confere antes de entregar.
#
# Existe porque o `output: standalone` do Next **não copia `.next/static` nem
# `public/`**: quem empacota só a pasta standalone sobe uma aplicação que
# responde 200 em tudo e serve as páginas sem CSS nenhum. Aconteceu em
# 02/09/2026 e o healthcheck passou verde, porque `/api/health` não sabe se a
# folha de estilo existe.
#
# A receita estava só no README. Script existe para não depender de alguém
# lembrar de um passo que falha em silêncio.
#
#   bash scripts/empacotar.sh            # gera /tmp/lojas-standalone.tgz
set -euo pipefail
cd "$(dirname "$0")/.."

SAIDA="${1:-/tmp/lojas-standalone.tgz}"
APP=".next/standalone/lojas.avilaops.com"

[ -d "$APP" ] || { echo "!! falta $APP; rode 'npm run build' antes" >&2; exit 1; }

echo "==> juntando static, public e prisma no standalone"
rm -rf "$APP/.next/static" "$APP/public" "$APP/prisma"
cp -r .next/static "$APP/.next/static"
cp -r public "$APP/public"
cp -r prisma "$APP/prisma"

echo "==> empacotando"
rm -f "$SAIDA"
tar --force-local -czf "$SAIDA" -C .next/standalone .

# Conferir o pacote, e não a pasta de origem: o erro de 02/09 foi exatamente um
# .tgz que parecia certo do lado de fora.
echo "==> conferindo o pacote"
# A listagem é feita uma vez e conferida em memória: encadear vários
# `tar tzf | grep -q` sob `set -o pipefail` faz o tar morrer de SIGPIPE quando o
# grep fecha o pipe, e a conferência acusa ausente o que está presente.
lista=$(mktemp)
tar tzf "$SAIDA" > "$lista"

falta=0
tem() { grep -q "$1" "$lista" || { echo "  !! $2" >&2; falta=1; }; }

css=$(grep -c '\.next/static/chunks/.*\.css$' "$lista" || true)
[ "$css" -gt 0 ] || { echo "  !! nenhum CSS em .next/static" >&2; falta=1; }
tem 'lojas\.avilaops\.com/public/'            'public/ ausente'
tem 'lojas\.avilaops\.com/prisma/schema\.prisma' 'prisma/ ausente'
tem 'lojas\.avilaops\.com/server\.js'         'server.js ausente'

rm -f "$lista"
[ "$falta" -eq 0 ] || { echo "!! pacote incompleto; NAO suba" >&2; exit 1; }

echo "  $css arquivo(s) CSS · $(du -h "$SAIDA" | cut -f1) · $SAIDA"
echo "==> pronto para subir"
