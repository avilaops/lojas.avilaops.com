# Recuperação no padrão de Auth e webmail

O Lojas preserva Next.js/TypeScript e PostgreSQL. O runtime é Node 22 no Render,
o DNS continua na Cloudflare e o armazenamento durável fica no R2. Não usa D1.

## Build e entrega

Builds, testes, navegador e validação do runtime ONNX rodam exclusivamente no
GitHub Actions. `runtime_render` recebe o contexto já aprovado da imagem e
produz um runtime gzip com manifesto e partes de até 32 MiB. Cada parte, o
arquivo completo e o manifesto têm SHA-256. O namespace inclui SHA da fonte,
run e tentativa: uma reexecução não sobrescreve uma release anterior.

O serviço Render usa runtime `node`, versão indicada no manifesto, build command
`node --version` e start command `node deploy/render/start.mjs`. Não executar
`npm install`, `next build` ou testes em Render. O bootstrap valida os hashes,
extrai o runtime aprovado em `/tmp` e inicia `server.js`. Todo estado durável
fica no PostgreSQL ou R2; arquivos temporários e caches podem ser descartados.
OpenSSL é conferido antes da inicialização. A fonte do bootstrap também deve
ser a versão publicada pelo CI, usando `commitId` na API de deploy.

Variáveis do serviço: `DATABASE_URL` interna e exclusiva do Lojas,
`LOJAS_SECRET` e `LOJAS_CERT_SECRET` originais, `LOJAS_BASE_DOMAIN`,
`LOJAS_STORAGE_URL`, `LOJAS_STORAGE_TOKEN`, `LOJAS_RELEASE_SHA`,
`LOJAS_RELEASE_ID`, `LOJAS_RELEASE_MANIFEST_SHA256`, `LOJAS_BOOTSTRAP_RUN=1`,
`NODE_VERSION` e as integrações cuja configuração foi recuperada e conferida.
Não importar o ambiente inteiro de outro produto. O agendador interno fica
desligado durante a recuperação até conferir a execução de rotinas externas.

O job `render_migracoes` faz backup antes de migrar; `render_publicar` envia
partes, publica o manifesto por último e só então solicita deploy do commit.
O Render faz health check em `/api/health`. O trigger de deploy não comprova
que a release ficou saudável: conferir o deploy real e o smoke HTTP depois.

No GitHub, cadastrar segredos `RENDER_DATABASE_URL` (externa, banco Lojas),
`RENDER_API_KEY` e `LOJAS_STORAGE_PUBLISH_TOKEN`; variáveis `DEPLOY_TARGET=render`,
`DEPLOY_ENABLED=true`, `RENDER_SERVICE_ID` e `LOJAS_STORAGE_URL`. Desativar
`DEPLOY_ENABLED` durante o provisionamento. A entrega SSH é excluída quando
`DEPLOY_TARGET=render`. Pull requests não recebem credenciais nem fazem deploy.

## Armazenamento e privacidade

`deploy/cloudflare/resources.json` declara recursos REST; não é configuração
Wrangler. `lojas-storage` usa bindings de quatro buckets privados. Os tokens
aleatórios ficam apenas no Render e no GitHub; o Worker recebe hashes SHA-256.
Sem autenticação, nenhuma operação acessa bucket. Não habilitar CORS genérico,
domínio público de bucket, listagem de objetos ou fallback à origem antiga.

- O token da aplicação grava e lê uploads e acervo fiscal, exclui uploads e lê
  releases. Não escreve releases, não acessa backups nem exclui acervo fiscal.
- O token do CI publica releases e backups imutáveis. Não lê uploads ou fiscal.
- O gateway nunca é um endereço de imagem do navegador. A rota `/uploads`
  mantém URLs antigas, tipos permitidos e bloqueio a subpastas, inclusive Pix.
- Comprovantes passam pela autorização existente do Lojas antes da leitura.
- Um R2 indisponível gera 503; somente ausência real gera 404. Configuração
  parcial não cai silenciosamente no armazenamento local.
- O acervo fiscal existente continua em `avilaops-fiscal-acervo`. Os demais
  buckets novos são `avilaops-lojas-uploads`, `avilaops-lojas-releases` e
  `avilaops-lojas-backups`.

O backup diário executa às 03:30 UTC e também pode ser disparado manualmente.
O manifesto é escrito após todas as partes. Nenhuma rotina apaga o backup de
origem ou configura expiração destrutiva. Para restaurar, conferir manifesto,
hash de cada parte, hash agregado, gzip e contagens antes da publicação.

## Limites da recuperação de 13/11/2026

O banco foi restaurado da última cópia disponível de `host-lojas-20261113.sql.gz`,
gravada no R2 às 04:00 UTC. As 92 tabelas e 237.098 linhas conferiram antes das
novas migrações. Alterações posteriores ao snapshot não foram recuperadas.
As chaves originais foram preservadas; 22 envelopes cifrados foram autenticados.

O dump não inclui `/opt/lojas/uploads`. 5.664 registros de produtos e seis de
lojas referenciam uploads nessa origem; não afirmar que as mídias estão
recuperadas por apenas publicar o novo armazenamento. A recuperação ou
reconstrução desses arquivos permanece um trabalho separado e explícito.

O PostgreSQL compartilhado de recuperação usa bancos e papéis separados e é
Free: a API informou expiração em 13/12/2026 às 13:50:53 UTC. Planejar destino
permanente antes dessa data. Não anunciar esse ambiente como hospedagem paga
permanente. A capacidade disponível precisa ser acompanhada; nenhum banco ou
recurso de outro produto deve ser apagado para liberar espaço.

Registrar DNS e domínios anteriores antes de promover. Só trocar tráfego após
saúde, vitrine, sessão e armazenamento passarem no destino. Um rollback de
release não desfaz migração nem reconcilia gravações feitas em bancos distintos.
