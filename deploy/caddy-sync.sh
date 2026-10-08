#!/usr/bin/env bash
#
# Sincroniza os domínios próprios das lojas com o Caddy do host.
#
# O Caddy só aceita um `ask` global e o bloco `https://` pega-tudo já é do
# Comandeiro; então cada domínio de loja precisa de bloco explícito. Este
# script pergunta à plataforma quais são (GET /api/admin/dominios), escreve
# /etc/caddy/lojas.d/dominios.caddy e recarrega o Caddy só quando mudou.
#
# Instalação (uma vez):
#   cp caddy-sync.sh /opt/lojas/ && chmod +x /opt/lojas/caddy-sync.sh
#   mkdir -p /etc/caddy/lojas.d && echo 'import /etc/caddy/lojas.d/*.caddy' >> /etc/caddy/Caddyfile
#   systemd: lojas-caddy-sync.service + .timer (a cada 2 min) — ver deploy/lojas-caddy-sync.*
set -euo pipefail

ENV=/opt/lojas/.env
ALVO=/etc/caddy/lojas.d/dominios.caddy
TOKEN=$(grep -E '^LOJAS_ADMIN_TOKEN=' "$ENV" | cut -d= -f2-)
[ -n "$TOKEN" ] || { echo "LOJAS_ADMIN_TOKEN ausente em $ENV" >&2; exit 1; }

# brilhax.com e www.brilhax.com ganham bloco proprio em lojas.d/brilhax.caddy
# (redirects de SEO da virada do Medusa); excluidos aqui para nao colidir.
HOSTS=$(curl -fsS -m 10 -H "authorization: Bearer $TOKEN" http://127.0.0.1:3080/api/admin/dominios | tr -d '\r' | grep -E '^[a-z0-9.-]+$' | grep -vE '^(brilhax\.com|www\.brilhax\.com)$' || true)

NOVO=$(mktemp)
{
  echo "# Gerado por /opt/lojas/caddy-sync.sh — NÃO editar à mão. $(date -Is)"
  if [ -n "$HOSTS" ]; then
    echo "$(echo "$HOSTS" | paste -sd, - | sed 's/,/, /g') {"
    echo "	tls {"
    echo "		on_demand"
    echo "	}"
    echo "	encode zstd gzip"
    echo "	import lojas_vitrine_cache"
    echo "	import lojas_log"
    echo "	import lojas_teto_corpo"
    echo "	reverse_proxy 127.0.0.1:3080"
    echo "}"
  fi
} > "$NOVO"

mkdir -p "$(dirname "$ALVO")"
if [ -f "$ALVO" ] && diff -q <(grep -v '^#' "$ALVO") <(grep -v '^#' "$NOVO") >/dev/null; then
  rm -f "$NOVO"; exit 0
fi

if caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1; then :; fi
# mktemp cria 0600 e o `cp` herda o modo quando o alvo nao existe: em
# 10/09/2026 o reload do Caddy morreu com "permission denied" no arquivo
# gerado, e so nao derrubou nada porque reload que falha mantem a config
# anterior. O usuario caddy precisa ler.
cp "$NOVO" "$ALVO"; rm -f "$NOVO"; chmod 644 "$ALVO"
if caddy validate --config /etc/caddy/Caddyfile >/dev/null 2>&1; then
  systemctl reload caddy && echo "caddy recarregado: $(echo "$HOSTS" | wc -l) domínio(s)"
else
  echo "Caddyfile inválido depois da sincronização — revertendo" >&2
  echo "# inválido, revertido $(date -Is)" > "$ALVO"
  exit 1
fi
