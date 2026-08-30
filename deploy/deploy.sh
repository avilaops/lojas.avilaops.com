#!/usr/bin/env bash
# Deploy da plataforma de lojas a partir de um standalone.tgz já enviado.
#
# O standalone NÃO entra mais numa imagem. Antes cada deploy assava um
# `lojas-avilaops` de 667 MB e o disco do Docker (40 GB, compartilhado com
# todos os projetos) chegou a 100% — o que chegou a corromper o snapshot de um
# container em recriação. Agora o container é a própria `lojas-base` com
# `/opt/lojas/app` montado: o código vive em `/` (que tem folga), o deploy não
# cria imagem nenhuma e a troca de versão é um `mv`.
#
# A base ainda é garantida no começo por uma pegadinha real: `docker image
# prune -af` apaga a `lojas-base` (nenhum container a usava, quando ela só
# servia de base de build) e o deploy passava a falhar em silêncio.
set -euo pipefail
cd /opt/lojas

[ -f standalone.tgz ] || { echo "!! falta /opt/lojas/standalone.tgz" >&2; exit 1; }

if ! docker image inspect lojas-base >/dev/null 2>&1; then
  echo "==> imagem base ausente; construindo"
  docker build -q -f Dockerfile.base -t lojas-base . >/dev/null
fi

echo "==> migrações"
DBURL=$(grep ^DATABASE_URL= .env | cut -d= -f2- | sed "s/host.docker.internal/127.0.0.1/")
rm -rf lojas.avilaops.com/prisma
tar xzf standalone.tgz ./lojas.avilaops.com/prisma
DATABASE_URL="$DBURL" npx -y prisma@6 migrate deploy --schema lojas.avilaops.com/prisma/schema.prisma 2>&1 | grep -E "applied|No pending|rror" || true

echo "==> extraindo a nova versão"
rm -rf app.novo
mkdir -p app.novo
tar xzf standalone.tgz -C app.novo

# O build vem do Windows: o sharp de lá não roda aqui, e o Turbopack referencia
# @prisma/client-<hash>. Os dois ajustes rodam dentro da própria base, que é
# quem tem o sharp de linux.
docker run --rm -v /opt/lojas/app.novo:/app lojas-base sh -c '
  set -e
  rm -rf /app/lojas.avilaops.com/node_modules/sharp /app/lojas.avilaops.com/node_modules/@img
  cp -r /opt/sharp/node_modules/sharp /app/lojas.avilaops.com/node_modules/sharp
  cp -r /opt/sharp/node_modules/@img /app/lojas.avilaops.com/node_modules/@img
  cd /app/lojas.avilaops.com/node_modules/@prisma
  for h in $(grep -rhoE "@prisma/client-[0-9a-f]{16}" /app/lojas.avilaops.com/.next/server/chunks | sort -u | sed "s#@prisma/##"); do ln -sfn client "$h"; done
'

echo "==> trocando a versão no ar"
rm -rf app.falhou
[ -d app ] && { rm -rf app.anterior; mv app app.anterior; }
mv app.novo app
mkdir -p app/uploads
docker compose up -d --force-recreate

# O removedor de fundo (odoo-avilaops-recorte-1, FUNDO_URL) vive na rede do
# Odoo; o container das lojas está na bridge padrão (para alcançar o Postgres
# do host). Sem esta ligação o nome não resolve e "Tratar com IA" fica fora.
docker network connect odoo-avilaops_default lojas-avilaops 2>/dev/null || true

for i in $(seq 1 30); do
  sleep 2
  if curl -sf -o /dev/null http://127.0.0.1:3080/api/health; then
    echo "==> saudável na tentativa $i"
    docker image prune -f >/dev/null
    docker buildx prune -af >/dev/null 2>&1 || true
    exit 0
  fi
done

echo "!! não respondeu; voltando para a versão anterior" >&2
docker logs --tail 30 lojas-avilaops 2>&1 | grep -vE "^\s+at " >&2
if [ -d app.anterior ]; then
  mv app app.falhou
  mv app.anterior app
  docker compose up -d --force-recreate
  echo "!! versão anterior restaurada; a que falhou ficou em /opt/lojas/app.falhou" >&2
fi
exit 1
