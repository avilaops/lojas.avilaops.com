#!/usr/bin/env bash
# CI e publicação rodando no próprio servidor, sem gastar minuto de Actions.
#
# Existe porque em 19/09/2026 a conta ficou sem alocar runner: os jobs morriam
# em um segundo, sem log, e **tudo** parou — os três PRs abertos e a própria
# `main`. Deploy que depende de um recurso de terceiro precisa de um caminho
# que não dependa dele.
#
# Não é um pipeline novo. É exatamente o que
# `avilaops/infra/.github/workflows/{container,deploy-ssh}.yml` fazem, nos
# mesmos passos e na mesma ordem:
#
#   container.yml   → docker build do Dockerfile (o portão roda DENTRO dele:
#                     prisma generate && typecheck && test && build)
#                   → push para ghcr.io/avilaops/<repo>:sha-<sha>
#   deploy-ssh.yml  → ssh servidor 'deploy <aplicação> <imagem>@<digest>'
#
# A imagem é a mesma, o comando de implantação é o mesmo e o digest é o mesmo
# formato que o `deploy` espera. Nada aqui reimplementa deploy: o `deploy` do
# servidor continua sendo quem troca a versão. Se este script e o pipeline
# divergirem algum dia, é porque alguém mexeu num e esqueceu do outro — por
# isso os dois constroem o mesmo `Dockerfile`, que é onde o portão mora.
#
#   bash deploy/ci-servidor.sh                    # portão + publica + implanta
#   bash deploy/ci-servidor.sh --somente-portao   # só confere, não publica
#   bash deploy/ci-servidor.sh --ref claude/x     # confere outra ref
#
# Precisa, no servidor: docker, git e `docker login ghcr.io` feito uma vez com
# um token de escrita em packages. Ver docs/CI-NO-SERVIDOR.md.
set -euo pipefail

APLICACAO="lojas.avilaops.com"
IMAGEM_BASE="ghcr.io/avilaops/lojas.avilaops.com"
REF=""
SOMENTE_PORTAO=0

while [ $# -gt 0 ]; do
  case "$1" in
    --somente-portao) SOMENTE_PORTAO=1; shift ;;
    --ref) REF="${2:-}"; shift 2 ;;
    -h|--help) sed -n '2,30p' "$0"; exit 0 ;;
    *) echo "!! opção desconhecida: $1" >&2; exit 2 ;;
  esac
done

cd "$(dirname "$0")/.."

for exigido in docker git; do
  command -v "$exigido" >/dev/null || { echo "!! falta $exigido" >&2; exit 1; }
done

if [ -n "$REF" ]; then
  echo "==> buscando $REF"
  git fetch --quiet origin "$REF"
  git checkout --quiet --detach FETCH_HEAD
fi

sha=$(git rev-parse HEAD)
curto=${sha:0:7}
tag="$IMAGEM_BASE:sha-$sha"

# Árvore suja vira imagem que ninguém consegue reproduzir a partir do commit.
# O pipeline nunca tem esse problema (checkout limpo); aqui é a mão humana.
if [ -n "$(git status --porcelain)" ]; then
  echo "!! há alterações não commitadas; a imagem não corresponderia ao commit $curto" >&2
  git status --short >&2
  exit 1
fi

echo "==> commit $curto ($(git log -1 --format=%s | cut -c1-60))"

# ── Antes de tudo: cabe nesta máquina? ──────────────────────────────────
# O README diz, desde 24/08/2026, que "o servidor não builda": um CX23 de 4 GB
# com o disco do Docker sempre perto de 95%. Foi decisão de projeto, não
# esquecimento — e este script a contraria de propósito, para o dia em que o
# Actions não estiver disponível.
#
# Então ele confere antes em vez de descobrir no meio. Encher um disco que já
# está em 95% não dá erro limpo: dá camada corrompida e container que não sobe,
# que é o pior momento possível para descobrir qualquer coisa.
#
# Os pisos vêm do que o build precisa: `next build` sozinho passa de 2 GB, e as
# camadas intermediárias de uma imagem Node com node_modules passam de 3 GB.
PISO_DISCO_GB="${CI_PISO_DISCO_GB:-8}"
PISO_MEMORIA_MB="${CI_PISO_MEMORIA_MB:-3000}"

raiz_docker=$(docker info --format '{{.DockerRootDir}}' 2>/dev/null || echo /var/lib/docker)
[ -d "$raiz_docker" ] || raiz_docker=/
disco_gb=$(df -BG --output=avail "$raiz_docker" 2>/dev/null | tail -1 | tr -dc '0-9' || echo 0)

# Memória útil é a disponível mais a swap: `next build` sobrevive em swap, só
# devagar. Sem contá-la, uma máquina com swap generosa seria recusada à toa.
livre_mb=$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo 2>/dev/null || echo 0)
swap_mb=$(awk '/SwapFree/ {print int($2/1024)}' /proc/meminfo 2>/dev/null || echo 0)
memoria_mb=$(( livre_mb + swap_mb ))

echo "==> recursos: ${disco_gb:-?} GB livres em $raiz_docker · ${memoria_mb} MB de memória útil"

curto_circuito=0
if [ "${disco_gb:-0}" -lt "$PISO_DISCO_GB" ]; then
  echo "!! disco: ${disco_gb} GB livres, abaixo do piso de ${PISO_DISCO_GB} GB." >&2
  curto_circuito=1
fi
if [ "$memoria_mb" -lt "$PISO_MEMORIA_MB" ]; then
  echo "!! memória: ${memoria_mb} MB úteis, abaixo do piso de ${PISO_MEMORIA_MB} MB." >&2
  curto_circuito=1
fi
if [ "$curto_circuito" -eq 1 ]; then
  cat >&2 <<'FIM'

   Esta máquina foi escolhida para NÃO construir (ver README, seção Deploy).
   Antes de baixar os pisos, o caminho barato costuma ser um destes:

     docker builder prune -af          # cache de build acumulado
     docker image prune -f             # imagens órfãs (sem -a: apaga lojas-base)
     docker system df                  # de onde vem o que está ocupando

   Havendo folga de verdade, os pisos são ajustáveis:
     CI_PISO_DISCO_GB=6 CI_PISO_MEMORIA_MB=2500 bash deploy/ci-servidor.sh
FIM
  exit 1
fi

# A limpeza é obrigatória aqui, e não no pipeline, por um motivo já vivido: o
# disco do Docker do servidor tem 40 GB compartilhados com todos os projetos,
# já chegou a 100% e corrompeu o snapshot de um container em recriação (ver
# deploy/deploy.sh). O runner descartável do GitHub não tinha esse problema; o
# servidor tem.
#
# O trap é armado ANTES do build, e não depois: build que falha no meio é
# justamente quando sobra camada órfã, e é a hora em que o disco mais importa.
#
# `image prune` sem `-a`, de propósito: `-af` apaga imagem sem container, e
# `lojas-base` é exatamente isso — já sumiu assim uma vez e o deploy passou a
# falhar sem ninguém entender por quê (deploy/deploy.sh).
limpar() {
  echo "==> liberando disco do Docker"
  docker builder prune --force --filter until=72h >/dev/null 2>&1 || true
  docker image prune --force >/dev/null 2>&1 || true
}
trap limpar EXIT

# ── O portão ────────────────────────────────────────────────────────────
# `docker build` sem `--target`: vai até o estágio de runtime, e para isso
# precisa passar pelo `build`, que roda typecheck, testes e build. Falhou o
# portão, falhou o build, e nada é publicado — que é a garantia inteira.
#
# `--pull` é a única diferença deliberada em relação ao container.yml: lá o
# runner nasce limpo a cada execução e a base vem sempre nova. Aqui a máquina é
# a mesma há meses, e uma `node:22-bookworm-slim` velha em cache seria um
# desvio silencioso entre o que o pipeline testa e o que o servidor assa.
echo "==> construindo a imagem (o portão roda dentro: typecheck, testes, build)"
if ! docker build --pull -t "$tag" -f Dockerfile .; then
  echo "!! o portão reprovou; nada foi publicado nem implantado" >&2
  exit 1
fi
echo "==> portão verde"

if [ "$SOMENTE_PORTAO" -eq 1 ]; then
  echo "==> só o portão foi pedido; a imagem $curto ficou local e nada foi implantado"
  exit 0
fi

# ── Publicação ──────────────────────────────────────────────────────────
# O `deploy` do servidor recebe imagem por digest, não por tag: tag se move,
# digest não, e é o digest que diz qual bit está no ar. O mesmo formato que
# deploy-ssh.yml exige.
echo "==> publicando no GHCR"
if ! docker push "$tag"; then
  echo "!! push recusado. Falta 'docker login ghcr.io' com token de escrita em packages?" >&2
  exit 1
fi

digest=$(docker image inspect --format '{{index .RepoDigests 0}}' "$tag" 2>/dev/null | cut -d@ -f2 || true)
if ! [[ "$digest" =~ ^sha256:[a-f0-9]{64}$ ]]; then
  echo "!! não consegui ler o digest publicado; não implanto sem ele" >&2
  exit 1
fi
imagem="$IMAGEM_BASE@$digest"
echo "==> publicada: $imagem"

# ── Implantação ─────────────────────────────────────────────────────────
# Exatamente o comando que o deploy-ssh.yml roda por SSH. Quem troca a versão,
# confere saúde e desfaz em caso de falha continua sendo o `deploy` do host.
if ! command -v deploy >/dev/null; then
  echo "!! o comando 'deploy' não está no PATH deste usuário." >&2
  echo "   A imagem está publicada; implante com:  deploy $APLICACAO $imagem" >&2
  exit 1
fi

echo "==> implantando"
deploy "$APLICACAO" "$imagem"

# O `deploy` responde pela saúde do container. A fumaça é a pergunta que ele
# não faz: a loja abre com a folha de estilo? Em 02/09/2026 subiu um pacote sem
# `.next/static`, tudo respondeu 200 e a vitrine ficou sem CSS nenhum.
if [ -f scripts/smoke-publicacao.mjs ] && command -v node >/dev/null; then
  echo "==> fumaça"
  node scripts/smoke-publicacao.mjs "${SMOKE_URL:-https://lojas.avilaops.com}"
fi

echo "==> $curto no ar"
