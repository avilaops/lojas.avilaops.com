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

# A versão anterior só existe durante o deploy, para o rollback automático, e
# é apagada quando a nova passa nas verificações. Se sobrou uma (deploy
# interrompido), liberar antes da extração, que precisa de espaço para a nova
# versão completa, sem remover a aplicação que está respondendo agora.
rm -rf app.anterior

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
# O pacote pode trazer `./` com permissão 700, herdada de um mktemp; o processo
# Node (uid 1000) precisa atravessar a raiz montada em /app.
chmod 755 app.novo

# O build vem do Windows: o sharp de lá não roda aqui, e o Turbopack referencia
# @prisma/client-<hash>. Os dois ajustes rodam dentro da própria base, que é
# quem tem o sharp de linux.
docker run --rm -v /opt/lojas/app.novo:/app lojas-base sh -c '
  set -e
  rm -rf /app/lojas.avilaops.com/node_modules/sharp /app/lojas.avilaops.com/node_modules/@img
  cp -r /opt/sharp/node_modules/sharp /app/lojas.avilaops.com/node_modules/sharp
  cp -r /opt/sharp/node_modules/@img /app/lojas.avilaops.com/node_modules/@img
  # As dependencias do sharp tambem. O `import("sharp")` e dinamico, entao o
  # rastreio de arquivos do Next nao leva `semver` para o standalone, e o
  # sharp quebra no require com "Cannot find module semver/functions/coerce".
  # Foi assim, em silencio, de 02/09 a 10/09/2026: a rota /uploads caia no
  # "sem otimizacao" e todo card de produto recebia o original de 1000 px
  # no lugar da miniatura de 480. O standalone pode conter pastas parciais
  # (por exemplo, semver/package.json sem functions/coerce.js), entao copia
  # o conteudo da base Linux por cima, em vez de testar apenas a pasta.
  for dep in semver detect-libc @emnapi; do
    mkdir -p "/app/lojas.avilaops.com/node_modules/$dep"
    cp -r "/opt/sharp/node_modules/$dep/." "/app/lojas.avilaops.com/node_modules/$dep/"
  done
  cd /app/lojas.avilaops.com/node_modules/@prisma
  for h in $(grep -rhoE "@prisma/client-[0-9a-f]{16}" /app/lojas.avilaops.com/.next/server/chunks | sort -u | sed "s#@prisma/##"); do ln -sfn client "$h"; done
  # O sharp recebe o mesmo tratamento: o Turbopack externaliza como
  # require("sharp-<hash>"), e sem o symlink o import dinamico cai no catch e
  # a rota /uploads serve o original no lugar da miniatura (10/09/2026).
  cd /app/lojas.avilaops.com/node_modules
  for h in $(grep -rhoE "\"sharp-[0-9a-f]{16}\"" /app/lojas.avilaops.com/.next/server/chunks | tr -d "\"" | sort -u); do ln -sfn sharp "$h"; done
  # O ONNX tambem e externalizado com hash; o wrapper nativo precisa da biblioteca
  # Linux (incluida pelo empacotador) junto ao pacote e deste alias no runtime.
  for h in $(grep -rhoE "\"onnxruntime-node-[0-9a-f]{16}\"" /app/lojas.avilaops.com/.next/server/chunks | tr -d "\"" | sort -u); do ln -sfn onnxruntime-node "$h"; done
  # Falhar antes da troca se o pacote não carregar os módulos de imagem Linux.
  # Health e CSS isolados não detectam esse erro na rota de uploads.
  node -e "require(\"/app/lojas.avilaops.com/node_modules/onnxruntime-node\"); require(\"/app/lojas.avilaops.com/node_modules/sharp\")"
'

echo "==> trocando a versão no ar"
rm -rf app.falhou
[ -d app ] && { rm -rf app.anterior; mv app app.anterior; }
mv app.novo app
mkdir -p app/uploads

# O container roda como uid 1000 (CT-07 do Padrao Oficial v1), e cada deploy
# troca a pasta app inteira: sem este chown o processo nao-root perde a escrita
# no cache de imagem do Next e as fotos de produto param de ser otimizadas.
mkdir -p app/lojas.avilaops.com/.next/cache
chown -R 1000:1000 app/lojas.avilaops.com/.next/cache uploads 2>/dev/null || true
docker compose up -d --force-recreate

# O removedor de fundo (odoo-avilaops-recorte-1, FUNDO_URL) vive na rede do
# Odoo; o container das lojas está na bridge padrão (para alcançar o Postgres
# do host). Sem esta ligação o nome não resolve e "Tratar com IA" fica fora.
docker network connect odoo-avilaops_default lojas-avilaops 2>/dev/null || true

# `/api/health` responde 200 com o pacote sem `.next/static`: em 02/09/2026 a
# loja ficou no ar sem CSS nenhum e o deploy declarou sucesso. Então, antes de
# declarar, o deploy faz o que o navegador faria: baixa o HTML da vitrine e
# segue o <link> da folha de estilo. O mesmo par de verificações roda no
# pipeline contra o domínio público, em `scripts/smoke-publicacao.mjs`.
conferir_estilo() {
  local html folha bytes
  html=$(curl -sf -H "host: lojas.avilaops.com" http://127.0.0.1:3080/) || {
    echo "!! a vitrine não respondeu" >&2; return 1; }
  folha=$(printf '%s' "$html" | grep -oE '/_next/static/(css|chunks)/[^"]+\.css' | head -1)
  [ -n "$folha" ] || { echo "!! a vitrine não referencia folha de estilo própria (pacote sem .next/static?)" >&2; return 1; }
  bytes=$(curl -sf -o /dev/null -w '%{size_download}' -H "host: lojas.avilaops.com" "http://127.0.0.1:3080$folha") || {
    echo "!! $folha não foi servida; a loja abriria sem CSS" >&2; return 1; }
  [ "$bytes" -gt 1000 ] || { echo "!! $folha veio com $bytes bytes" >&2; return 1; }
  echo "==> folha de estilo servida ($folha, $bytes bytes)"
}

# A rota /uploads serve as fotos de todas as lojas. Em 28/09/2026 ela passou a
# responder 500 em qualquer caminho (o módulo não carregava porque o binding
# Linux do ONNX faltava no pacote), com health e CSS verdes, e a vitrine ficou
# sem foto fora do cache da borda. Um arquivo que não existe precisa voltar
# 404: 500 aqui significa que a rota nem chegou a rodar. Não depende do
# conteúdo do volume.
conferir_uploads() {
  local codigo
  codigo=$(curl -s -o /dev/null -w '%{http_code}' -H "host: lojas.avilaops.com" \
    "http://127.0.0.1:3080/uploads/conferencia-deploy/nao-existe.webp") || true
  [ "$codigo" = "404" ] || { echo "!! /uploads respondeu $codigo para arquivo inexistente (esperado 404)" >&2; return 1; }
  echo "==> rota de fotos carregando (/uploads → 404 para inexistente)"
}

for i in $(seq 1 30); do
  sleep 2
  if curl -sf -o /dev/null http://127.0.0.1:3080/api/health; then
    echo "==> saudável na tentativa $i"
    if ! conferir_estilo; then
      echo "!! respondeu, mas sem a folha de estilo; tratando como versão quebrada" >&2
      break
    fi
    if ! conferir_uploads; then
      echo "!! respondeu, mas a rota de fotos não carrega; tratando como versão quebrada" >&2
      break
    fi
    # Versão aprovada: a anterior só servia para o rollback acima. Quem guarda
    # versões é o GitHub; no servidor ela e o pacote ocupavam ~600 MB de uma
    # raiz de 38 GB, que chegou a 97% em 28/09/2026.
    rm -rf app.anterior standalone.tgz
    docker image prune -f >/dev/null
    docker buildx prune -af >/dev/null 2>&1 || true
    exit 0
  fi
done

echo "!! deploy não passou nas verificações; voltando para a versão anterior" >&2
docker logs --tail 30 lojas-avilaops 2>&1 | grep -vE "^\s+at " >&2
if [ -d app.anterior ]; then
  mv app app.falhou
  mv app.anterior app
  docker compose up -d --force-recreate
  echo "!! versão anterior restaurada; a que falhou ficou em /opt/lojas/app.falhou" >&2
fi
exit 1
