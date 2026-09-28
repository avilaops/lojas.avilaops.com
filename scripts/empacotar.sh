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
if [ ! -d "$APP" ] && [ -f ".next/standalone/server.js" ]; then
  # Quando o build roda dentro da pasta do app, o Next escreve o standalone
  # direto na raiz. Em monorepo ele mantém a pasta lojas.avilaops.com.
  APP=".next/standalone"
fi

[ -d "$APP" ] || { echo "!! falta $APP; rode 'npm run build' antes" >&2; exit 1; }

# O build do Next continua escrevendo em `.next` por alguns segundos depois de
# o `npm run build` devolver o prompt. Empacotar nessa janela dá
# "tar: file changed as we read it", e o tar sai com erro **depois** de já ter
# escrito um .tgz truncado — em 02/09/2026 sobrou um arquivo de 45 KB no lugar
# de 80 MB. Esperar a árvore parar de mudar é mais barato que descobrir isso
# no deploy.
echo "==> esperando o build assentar"
for _ in $(seq 1 45); do
  quantos=$(find .next -newermt '-8 seconds' -type f 2>/dev/null | wc -l)
  [ "$quantos" -eq 0 ] && break
  printf "\r    %s arquivo(s) ainda sendo escritos…" "$quantos"
  sleep 4
done
printf "\r\033[K"
if [ "${quantos:-0}" -ne 0 ]; then
  # Mensagem específica: "ainda mudando" mandava a pessoa procurar o problema
  # no lugar errado. O que resolve é ver qual processo está escrevendo.
  echo "!! $quantos arquivo(s) de .next mudaram nos últimos 8 s após 3 min de espera." >&2
  echo "   Há outro 'npm run build' rodando? Feche-o e rode este script de novo." >&2
  exit 1
fi

echo "==> juntando static, public e prisma no standalone"
rm -rf "$APP/.next/static" "$APP/public" "$APP/prisma"
cp -r .next/static "$APP/.next/static"
cp -r public "$APP/public"
cp -r prisma "$APP/prisma"
# O ONNX é externalizado pelo Next, mas o binário standalone não copia a
# biblioteca Linux que o binding carrega em runtime. Sem ela, /uploads retorna
# 500 ao tentar otimizar imagens, embora o health check simples siga verde.
onnx_lib=$(find node_modules/onnxruntime-node/bin -path '*/linux/x64/libonnxruntime.so.1' -print -quit 2>/dev/null || true)
[ -n "$onnx_lib" ] || { echo "!! falta libonnxruntime.so.1 para o runtime Linux" >&2; exit 1; }
mkdir -p "$APP/node_modules/onnxruntime-node/bin/napi-v6/linux/x64"
cp "$onnx_lib" "$APP/node_modules/onnxruntime-node/bin/napi-v6/linux/x64/"

echo "==> empacotando"
rm -f "$SAIDA"
# Empacota num temporário e só promove no fim: tar que falha no meio deixa
# arquivo truncado, e um .tgz de 45 KB com nome certo é pior que nenhum —
# o deploy só descobre ao descompactar, com o container já parando.
tmp="$SAIDA.parcial"
rm -f "$tmp"
# O /tmp do servidor é tmpfs. Montar o estágio ao lado de .next evita duplicar
# 180 MB temporários na RAM e preserva espaço para o runtime dos containers.
stage=$(mktemp -d ".next/lojas-stage.XXXXXX")
mkdir -p "$stage/lojas.avilaops.com"
cp -a "$APP/." "$stage/lojas.avilaops.com/"
if ! tar --force-local \
  --exclude='./lojas.avilaops.com/output' --exclude='./lojas.avilaops.com/output/**' \
  --exclude='./output' --exclude='./output/**' \
  -czf "$tmp" -C "$stage" .; then
  rm -rf "$stage"
  rm -f "$tmp"
  echo "!! tar falhou; nada foi gerado" >&2
  exit 1
fi
rm -rf "$stage"
gzip -t "$tmp" || { rm -f "$tmp"; echo "!! gzip corrompido" >&2; exit 1; }
mv "$tmp" "$SAIDA"

# Conferir o pacote, e não a pasta de origem: o erro de 02/09 foi exatamente um
# .tgz que parecia certo do lado de fora.
echo "==> conferindo o pacote"
# A listagem é feita uma vez e conferida em memória: encadear vários
# `tar tzf | grep -q` sob `set -o pipefail` faz o tar morrer de SIGPIPE quando o
# grep fecha o pipe, e a conferência acusa ausente o que está presente.
lista=$(mktemp)
# --force-local: com saída em "C:/…" o tar do Git Bash toma "C:" por servidor
# remoto, a listagem falha e o pacote bom é dado por incompleto (11/09/2026).
tar --force-local -tzf "$SAIDA" > "$lista"

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
