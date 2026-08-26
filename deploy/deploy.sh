#!/usr/bin/env bash
# Deploy da plataforma de lojas a partir de um standalone.tgz já enviado.
#
# Existe por causa de uma pegadinha real: `docker image prune -af` apaga a
# imagem `lojas-base` (ela não é usada por nenhum container, só como base de
# build), e aí `docker compose up --build` passa a falhar tentando baixar
# `lojas-base` do Docker Hub — em silêncio, se a saída estiver filtrada, com o
# container velho seguindo no ar. Este script garante a base antes de tudo e
# confere ao final que o servidor respondeu.
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

echo "==> build e troca do container"
docker compose up -d --build

for i in $(seq 1 30); do
  sleep 2
  if curl -sf -o /dev/null http://127.0.0.1:3080/api/health; then
    echo "==> saudável na tentativa $i"
    # Fica só UMA imagem da aplicação: a que está rodando. As anteriores
    # viram dangling ao perder a tag e são apagadas aqui. Nunca use -a: isso
    # levaria junto a lojas-base, que nenhum container usa.
    atual=$(docker inspect -f "{{.Image}}" lojas-avilaops)
    for img in $(docker images lojas-avilaops -q | sort -u); do
      [ "$img" = "$atual" ] || docker rmi -f "$img" >/dev/null 2>&1 || true
    done
    docker image prune -f >/dev/null
    docker builder prune -f --filter until=24h >/dev/null 2>&1 || true
    exit 0
  fi
done

echo "!! não respondeu; últimos logs:" >&2
docker logs --tail 30 lojas-avilaops 2>&1 | grep -vE "^\s+at " >&2
exit 1
