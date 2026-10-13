#!/usr/bin/env bash
# Leva os aplicativos da plataforma das credenciais do n8n para o Lojas.
#
# Mercado Livre, Melhor Envio e Mercado Pago têm, cada um, UM aplicativo da
# plataforma; o lojista só conecta a própria conta nele. A CepCerto é a conta
# da plataforma que cota frete para a loja sem Melhor Envio. As chaves
# moram em credenciais do n8n (tipo httpCustomAuth, corpo JSON).
# Quem troca uma chave troca lá, na tela do n8n, e roda este roteiro: ele grava
# as variáveis em /opt/lojas/.env, recria o container (env_file só é lido na
# criação) e confere o que dá para conferir sem a conta de um lojista.
#
# Roda no servidor applications, como root. Nenhum valor secreto vai para a
# saída.
#
# Uso: sincronizar-apps-do-n8n.sh [todos|mercado-livre|melhor-envio|mercado-pago|cepcerto]
#   todos (padrão): aplicativo cuja credencial ainda tem o marcador é pulado.
#   um nome: credencial com marcador é erro.
set -euo pipefail
umask 077

pedido=${1:-todos}
pasta=/opt/lojas
env_do_lojas=$pasta/.env

# nome | id da credencial no n8n | campo do corpo=VARIÁVEL do .env, separados por vírgula
APPS='
mercado-livre|tmCn4vuIaDwLCXHn|client_id=ML_APP_ID,client_secret=ML_APP_SECRET
melhor-envio|4tVMMl4ZiDxpHyrP|client_id=MELHOR_ENVIO_CLIENT_ID,client_secret=MELHOR_ENVIO_CLIENT_SECRET
mercado-pago|TQmPlfr8XkAfqMSZ|client_id=MP_APP_ID,client_secret=MP_APP_SECRET,webhook_secret=MP_APP_WEBHOOK_SECRET
cepcerto|e6Nn4mafJ916JpbG|public_key=CEPCERTO_PUBLIC_KEY
'

case "$pedido" in todos|mercado-livre|melhor-envio|mercado-pago|cepcerto) ;; *) echo "Uso: $0 [todos|mercado-livre|melhor-envio|mercado-pago|cepcerto]"; exit 2 ;; esac

temp=$(mktemp -d)
trap 'rm -rf "$temp"' EXIT
chown n8n "$temp"
: > "$temp/novas"

# O n8n decifra a própria credencial; o arquivo fica no diretório temporário e some no fim.
exportar() {
  ( set -a; . /opt/n8n/n8n.env; set +a
    cd /var/lib/n8n
    runuser -u n8n --preserve-environment -- /usr/bin/node /opt/n8n/app/node_modules/n8n/bin/n8n \
      export:credentials --id="$1" --decrypted --output="$2" >/dev/null 2>&1 )
}

sincronizados=""
while IFS='|' read -r nome credencial campos; do
  [ -n "$nome" ] || continue
  [ "$pedido" = todos ] || [ "$pedido" = "$nome" ] || continue
  exportar "$credencial" "$temp/$nome.json" || { echo "ERRO: o n8n não exportou a credencial de $nome ($credencial)"; exit 1; }

  # Sai 0 com as linhas VARIÁVEL=valor, 3 se a credencial ainda tem marcador, 1 se o valor é estranho.
  set +e
  node - "$temp/$nome.json" "$campos" > "$temp/$nome.env" <<'JS'
const fs = require("node:fs");
const [arquivo, campos] = process.argv.slice(2);
const lista = JSON.parse(fs.readFileSync(arquivo, "utf8"));
const dados = (Array.isArray(lista) ? lista[0] : lista)?.data ?? {};
const corpo = (typeof dados.json === "string" ? JSON.parse(dados.json) : dados.json)?.body ?? {};
const linhas = [];
for (const par of campos.split(",")) {
  const [campo, variavel] = par.split("=");
  const valor = String(corpo[campo] ?? "").trim();
  if (!valor || valor.startsWith("COLE_AQUI")) process.exit(3);
  if (!/^[A-Za-z0-9_.:=+\/-]{6,200}$/.test(valor)) {
    console.error(`ERRO: ${campo} tem formato inesperado (espaço, quebra de linha ou símbolo).`);
    process.exit(1);
  }
  linhas.push(`${variavel}=${valor}`);
}
process.stdout.write(linhas.join("\n") + "\n");
JS
  saida=$?
  set -e
  if [ "$saida" = 3 ]; then
    [ "$pedido" = todos ] && { echo "==> $nome: a credencial do n8n ainda está com o marcador; pulado"; continue; }
    echo "ERRO: $nome: as chaves ainda não foram coladas na credencial do n8n."; exit 1
  fi
  [ "$saida" = 0 ] || exit 1

  # A chave da CepCerto só entra se a CepCerto estiver cotando de verdade.
  # Com a chave no .env o painel passa a dar a Entrega como pronta para toda
  # loja com CEP de origem; se a cotação falha lá, a loja fica sem frete e o
  # painel diz que está tudo certo. A prova sai deste servidor, que é o IP que
  # a CepCerto precisa ter autorizado.
  if [ "$nome" = cepcerto ]; then
    if ! prova=$(CHAVE=$(cut -d= -f2- "$temp/$nome.env") node -e '
const chave = process.env.CHAVE;
fetch("https://cepcerto.com/widget_frete/api/cotacao", {
  method: "POST",
  headers: { "content-type": "application/json", accept: "application/json", "x-cepcerto-public-key": chave },
  body: JSON.stringify({ public_key: chave, cep_remetente: "01310100", cep_destinatario: "20040002", peso: "0.5", altura: "10", largura: "15", comprimento: "20", valor_encomenda: "50.00" }),
  signal: AbortSignal.timeout(25000),
}).then(async (r) => {
  const d = await r.json().catch(() => ({}));
  const n = Array.isArray(d.cotacoes) ? d.cotacoes.length : 0;
  console.log(`${r.status} ${n ? n + " cotações na prova" : d.mensagem ?? "sem cotação"}`);
  process.exit(n ? 0 : 1);
}).catch((e) => { console.log(`sem resposta (${e.message})`); process.exit(1); });' 2>&1); then
      echo "==> cepcerto: a CepCerto não cotou a prova ($prova); a chave NÃO foi gravada"
      [ "$pedido" = todos ] && continue
      exit 1
    fi
    echo "==> cepcerto: $prova"
  fi

  cat "$temp/$nome.env" >> "$temp/novas"
  sincronizados="$sincronizados $nome"
done <<< "$APPS"

[ -s "$temp/novas" ] || { echo "==> nada a sincronizar"; exit 0; }

# O .env fica com cada variável uma vez só: sai a linha antiga, entra a nova.
variaveis=$(cut -d= -f1 "$temp/novas" | paste -sd'|')
grep -v -E "^($variaveis)=" "$env_do_lojas" > "$temp/env" || true
cat "$temp/novas" >> "$temp/env"
if cmp -s <(sort "$temp/env") <(sort "$env_do_lojas"); then
  echo "==> .env já está igual às credenciais (${sincronizados# })"
else
  copia=$env_do_lojas.bak-apps-$(date -u +%Y%m%d-%H%M%S)
  cp -p "$env_do_lojas" "$copia"
  cat "$temp/env" > "$env_do_lojas"
  echo "==> .env atualizado (${sincronizados# }); cópia do anterior em $copia"
fi

# Recria só se o container ainda não carregou esses valores, e com os mesmos
# arquivos de compose do container que está no ar. O deploy junta três (o base,
# o do GitHub e o da imagem publicada); um `docker compose up` só com o base
# subiria a imagem legada.
no_container=$(docker exec lojas-avilaops sh -c "env | grep -E '^($variaveis)=' | sort" 2>/dev/null || true)
if [ "$no_container" = "$(sort "$temp/novas")" ]; then
  echo "==> container já está com esses valores"
else
  rotulo() { docker inspect lojas-avilaops -f "{{index .Config.Labels \"com.docker.compose.$1\"}}"; }
  arquivos=$(rotulo project.config_files)
  projeto=$(rotulo project)
  servico=$(rotulo service)
  imagem_antes=$(docker inspect lojas-avilaops -f '{{.Config.Image}}')
  [ -n "$arquivos" ] && [ -n "$projeto" ] && [ -n "$servico" ] || { echo "ERRO: o container no ar não diz com que compose foi criado"; exit 1; }
  compose=(docker compose --project-directory "$pasta" -p "$projeto")
  IFS=, read -ra lista <<< "$arquivos"
  for arquivo in "${lista[@]}"; do
    [ -f "$arquivo" ] || { echo "ERRO: falta o arquivo de compose $arquivo"; exit 1; }
    compose+=(-f "$arquivo")
  done
  "${compose[@]}" config --quiet
  echo "==> recriando o container ($servico) com ${#lista[@]} arquivos de compose"
  "${compose[@]}" up -d --no-deps --no-build --pull never --force-recreate "$servico" 2>&1 | tail -3
  imagem_depois=$(docker inspect lojas-avilaops -f '{{.Config.Image}}')
  [ "$imagem_antes" = "$imagem_depois" ] || { echo "ERRO: a imagem mudou na recriação ($imagem_depois)"; exit 1; }
fi

for _ in $(seq 1 40); do
  [ "$(docker inspect -f '{{.State.Health.Status}}' lojas-avilaops 2>/dev/null)" = healthy ] && break
  sleep 3
done
echo "==> container: $(docker inspect -f '{{.State.Health.Status}}' lojas-avilaops)"

# Mercado Livre e Mercado Pago aceitam conferir o aplicativo sem conta de
# lojista (client_credentials). O Melhor Envio só responde com a conta de quem
# conecta: a prova dele é o botão no painel e a cotação de teste da loja.
falhou=0
conferir() {
  docker exec -e NOME="$1" -e ENDERECO="$2" -e ID_VAR="$3" -e SEGREDO_VAR="$4" lojas-avilaops node -e '
const { NOME, ENDERECO, ID_VAR, SEGREDO_VAR } = process.env;
fetch(ENDERECO, {
  method: "POST",
  headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ grant_type: "client_credentials", client_id: process.env[ID_VAR], client_secret: process.env[SEGREDO_VAR] }),
}).then(async (r) => {
  const d = await r.json().catch(() => ({}));
  console.log(`==> ${NOME}, aplicativo ${process.env[ID_VAR]}: ${r.status} ${d.access_token ? "credenciais aceitas" : (d.error ?? "recusado") + " " + (d.message ?? "")}`);
  process.exit(d.access_token ? 0 : 1);
}).catch((e) => { console.log(`==> ${NOME}: sem resposta (${e.message})`); process.exit(1); });' || falhou=1
}
for nome in $sincronizados; do
  case "$nome" in
    mercado-livre) conferir "Mercado Livre" https://api.mercadolibre.com/oauth/token ML_APP_ID ML_APP_SECRET ;;
    mercado-pago) conferir "Mercado Pago" https://api.mercadopago.com/oauth/token MP_APP_ID MP_APP_SECRET ;;
    melhor-envio) echo "==> Melhor Envio: variáveis carregadas; confira o botão em Painel, Configurações, Entrega" ;;
    cepcerto) echo "==> CepCerto: chave carregada; a cotação de prova passou antes de gravar" ;;
  esac
done
exit $falhou
