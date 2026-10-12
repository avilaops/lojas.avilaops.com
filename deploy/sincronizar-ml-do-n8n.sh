#!/usr/bin/env bash
# Leva o aplicativo do Mercado Livre da credencial do n8n para o Lojas.
#
# A fonte é a credencial "Mercado Livre Avila Ops Marketplace BR (client id e
# secret)" do n8n (tipo httpCustomAuth, corpo com client_id e client_secret).
# Quem troca a chave troca lá, na tela do n8n, e roda este script: ele grava
# ML_APP_ID e ML_APP_SECRET em /opt/lojas/.env, recria o container (env_file só
# é lido na criação) e confere as credenciais no Mercado Livre.
#
# Roda no servidor applications, como root. Nenhum valor secreto vai para a
# saída: só o ID do aplicativo, que é público, e o resultado da conferência.
#
# Uso: sincronizar-ml-do-n8n.sh [id-da-credencial]
set -euo pipefail
umask 077

credencial=${1:-tmCn4vuIaDwLCXHn}
pasta=/opt/lojas
env_do_lojas=$pasta/.env
marcador=COLE_AQUI_A_CHAVE_SECRETA

temp=$(mktemp -d)
trap 'rm -rf "$temp"' EXIT
chown n8n "$temp"

# O n8n decifra a própria credencial; o arquivo fica no diretório temporário e some no fim.
( set -a; . /opt/n8n/n8n.env; set +a
  cd /var/lib/n8n
  runuser -u n8n --preserve-environment -- /usr/bin/node /opt/n8n/app/node_modules/n8n/bin/n8n \
    export:credentials --id="$credencial" --decrypted --output="$temp/credencial.json" >/dev/null 2>&1 ) \
  || { echo "ERRO: o n8n não exportou a credencial $credencial"; exit 1; }

node - "$temp/credencial.json" "$temp/valores" "$marcador" <<'JS'
const fs = require("node:fs");
const [arquivo, saida, marcador] = process.argv.slice(2);
const lista = JSON.parse(fs.readFileSync(arquivo, "utf8"));
const dados = (Array.isArray(lista) ? lista[0] : lista)?.data ?? {};
const corpo = (typeof dados.json === "string" ? JSON.parse(dados.json) : dados.json)?.body ?? {};
const id = String(corpo.client_id ?? "").trim();
const segredo = String(corpo.client_secret ?? "").trim();
const falha = (m) => { console.error(`ERRO: ${m}`); process.exit(1); };
if (!/^\d{6,20}$/.test(id)) falha("client_id da credencial não é um número de aplicativo.");
if (!segredo || segredo === marcador) falha("a chave secreta ainda não foi colada na credencial do n8n.");
if (!/^[A-Za-z0-9]{16,64}$/.test(segredo)) falha("client_secret tem formato inesperado (espaço, quebra de linha ou símbolo).");
fs.writeFileSync(saida, `${id}\n${segredo}\n`, { mode: 0o600 });
JS

id=$(sed -n 1p "$temp/valores")
segredo=$(sed -n 2p "$temp/valores")

if grep -qx "ML_APP_ID=$id" "$env_do_lojas" && grep -qx "ML_APP_SECRET=$segredo" "$env_do_lojas"; then
  echo "==> .env já está com o aplicativo $id; nada a trocar"
else
  copia=$env_do_lojas.bak-ml-$(date -u +%Y%m%d-%H%M%S)
  cp -p "$env_do_lojas" "$copia"
  echo "==> cópia do .env em $copia"
  grep -v -E '^ML_APP_(ID|SECRET)=' "$env_do_lojas" > "$temp/env"
  printf 'ML_APP_ID=%s\nML_APP_SECRET=%s\n' "$id" "$segredo" >> "$temp/env"
  cat "$temp/env" > "$env_do_lojas"
  echo "==> ML_APP_ID=$id gravado; recriando o container"
  ( cd "$pasta" && docker compose up -d --force-recreate lojas >/dev/null 2>&1 )
fi

for _ in $(seq 1 40); do
  [ "$(docker inspect -f '{{.State.Health.Status}}' lojas-avilaops 2>/dev/null)" = healthy ] && break
  sleep 3
done
echo "==> container: $(docker inspect -f '{{.State.Health.Status}}' lojas-avilaops)"

# O container responde com as credenciais que ele mesmo carregou.
docker exec lojas-avilaops node -e '
fetch("https://api.mercadolibre.com/oauth/token", {
  method: "POST",
  headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ grant_type: "client_credentials", client_id: process.env.ML_APP_ID, client_secret: process.env.ML_APP_SECRET }),
}).then(async (r) => {
  const d = await r.json().catch(() => ({}));
  console.log(`==> Mercado Livre, aplicativo ${process.env.ML_APP_ID}: ${r.status} ${d.access_token ? "credenciais aceitas" : (d.error ?? "recusado") + " " + (d.message ?? "")}`);
  process.exit(d.access_token ? 0 : 1);
})'
