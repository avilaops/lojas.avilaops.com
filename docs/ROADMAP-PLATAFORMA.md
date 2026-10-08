# Roadmap da plataforma Lojas

Documento vivo para evoluir a plataforma multi-tenant sem criar exceções por
loja. A regra é: comportamento de cliente vira dado em `Tenant`, `Produto` ou
configuração; o código continua compartilhado.

## Tranche 1 — fundação (concluída em 17/09/2026)

- [x] Consolidar o template `automotivo-premium` e seus assets na árvore principal.
- [x] Manter o template selecionável por `Tenant.tema.layout`.
- [x] Expor healthcheck sem cache, com estado do banco e latência para o deploy
  (`src/lib/saude.ts`, `/api/health`, contrato preso em `src/lib/saude.test.ts`).
- [x] Adicionar smoke test HTTP do healthcheck no pipeline
  (`scripts/smoke-publicacao.mjs`, job `fumaca`), e a mesma conferência de CSS
  dentro do `deploy/deploy.sh`, onde ela ainda dá tempo de reverter.

O smoke não se limita ao healthcheck porque `/api/health` não sabe se a folha
de estilo existe: ele baixa o HTML da vitrine e segue o `<link>`, que é a
falha real de 02/09/2026 (pacote sem `.next/static`, tudo 200, loja sem CSS).

Antes de publicar não faltava nada: `npx prisma generate && npm run typecheck
&& npm test && npm run build` já roda no estágio `build` do `Dockerfile`, e
em pull request também (a imagem é construída e não publicada). Um job
separado para os mesmos comandos seria a mesma verificação duas vezes, sem
ganho de tempo — o build já falha em cerca de um minuto quando um teste cai.
`npm run lint` entrou no bloqueio em 08/10/2026 (`Dockerfile`, entre o
typecheck e os testes). Os erros herdados não foram escondidos: `require` em
script `.cjs` é legítimo e foi liberado só neles; os nove pontos das regras do
compilador do React (busca e listas do painel, formulário de cartão) viraram
aviso, arquivo por arquivo, em `eslint.config.mjs`. Quem mexer num deles
resolve e tira o arquivo da lista.

## Tranche 2 — fábrica de templates

- [x] Extrair tokens e blocos comuns (cabeçalho, hero, categorias, produto,
  carrinho e rodapé) para contratos de template versionados
  (`src/lib/templates.ts`, contrato preso em `src/lib/templates.test.ts`).
- [x] Criar o template `catalogo-tecnico` reutilizando dados de compatibilidade,
  medidas e código original, sem lista de lojas no código
  (`src/lib/catalogo-tecnico.ts`, `src/components/home/CatalogoTecnico.tsx`,
  preso em `src/lib/catalogo-tecnico.test.ts`; compõe a home, `escopo: "home"`).
- [x] Criar preview seguro no painel, com dados de demonstração e sem alterar a
  loja publicada até salvar. O tema premium preenchido inteiro já está em
  `tests/fixtures/tema-premium-completo.json`, e serve de ponto de partida.
  (`/painel/previa` em `src/app/plataforma/(previa)/painel/previa/page.tsx`: o
  rascunho do formulário viaja em `?t=` e a página só lê; `src/lib/previa-tema.ts`
  codifica, valida e traz o catálogo de demonstração; a home sai de
  `src/components/home/composicao.tsx`, o mesmo mapa da loja publicada; o link
  "Ver prévia" está em `src/components/painel/Marca.tsx`; preso em
  `src/lib/previa-tema.test.ts`. Só a home, sem navegação.)
- [x] Validar cada template em viewport móvel, desktop, tema claro/escuro e
  preferência de movimento reduzido.
  (Rodada de 2026-10-06: 96/96. A matriz e o julgamento estão em
  `src/lib/validacao-templates.ts`, presos em `src/lib/validacao-templates.test.ts`;
  o script é `scripts/validar-templates.mts` e o roteiro, com o que a rodada
  achou e corrigiu, `docs/VALIDACAO-TEMPLATES.md`.)

## Tranche 3 — infraestrutura para o cliente

- [x] Onboarding orientado por checklist: identidade, domínio, catálogo,
  recebimento, entrega e publicação. (Checklist de seis passos na visão geral do
  painel, derivado do que a loja já tem gravado, sem coluna nem migração: a
  regra é `src/lib/checklist-onboarding.ts`, presa em
  `src/lib/checklist-onboarding.test.ts`; quem desenha é
  `src/components/painel/ChecklistOnboarding.tsx`. Ver `docs/ONBOARDING.md`,
  "Checklist no painel".)
- [x] Instrumentar métricas por tenant (latência, erros, conversão e pedidos),
  sem registrar tokens ou dados sensíveis.
  (`src/lib/metricas-tenant.ts`, `/api/admin/metricas`; latência e erros das
  rotas de venda e da API, em memória, zeram no deploy; conversão e pedidos do
  banco. Latência de página fica para o log do Caddy. Ver `docs/METRICAS.md`.)
- [ ] Melhorar isolamento operacional: limites de upload, timeout de integrações,
  idempotência e alertas n8n acionáveis.
  (Entraram limite de upload e tempo-limite: `src/lib/limites-upload.ts`, 413
  antes de ler o corpo em `/api/painel/imagens` e `/api/painel/produtos/planilha`,
  5 MB também no `?tratar=1`, leitura com teto em `importarImagemDeUrl` e
  tempo-limite nas três chamadas de `packages/checkout/src/providers/mercadopago.ts`.
  Idempotência e o evento de alerta entraram em 08/10/2026: chave do fato em
  `emitir`, reivindicação antes de avisar e `operacao.alerta` com loja, o que
  quebrou e o que fazer. Falta o ramo desse evento no fluxo do n8n, que se
  publica fora deste repositório. Ver `docs/ISOLAMENTO-OPERACIONAL.md`.)
- [ ] Backup, migração e rollback documentados como rotina verificável do deploy.
  (Documentado e conferido em produção em 08/10/2026: `docs/BACKUP-E-ROLLBACK.md`
  diz quem faz o deploy de verdade, o que ele garante, onde está o dump e como
  voltar. O job de deploy passou a recusar publicar quando um run mais novo já
  passou na frente. O procedimento virou comando: `npm run banco:ensaio`
  (`scripts/ensaio-banco.mts`, regras em `src/lib/ensaio-banco.ts`) faz dump,
  migração, volta ao dump e migração de novo no Postgres descartável; em
  08/10/2026, 62 migrações, 44 tabelas, zero divergências. O `npm test` prende
  a ordem do `deploy/deploy.sh` e os caminhos citados no documento. Falta
  instalar no servidor o dump antes de migração pendente, que está em
  `avilaops/infra#8`: o `avila-deploy` de produção está atrás do repositório,
  e instalar é decisão do Nicolas.)

## Pendências menores

Baixa prioridade: entram depois da Tranche 3, ou antes, de carona em tarefa que
já mexa nos mesmos arquivos.

- [ ] Prévia do tema sem pré-carregamento de páginas da loja. Abrir
  `/painel/previa` dispara de 5 a 16 requisições `?_rsc=` que respondem 404
  (`/produtos`, `/categoria/<slug>`: páginas da loja, que não existem no domínio
  do painel). Não quebra nada; é ruído no console e no servidor. Desligar o
  `prefetch` dos `next/link` só quando a home é desenhada pela prévia, num ponto
  único e não link a link; a loja publicada continua pré-carregando como hoje.
  Feito quando a abertura da prévia não gera nenhum `_rsc` fora de
  `/painel/previa` e a exceção do `_rsc` (`preCarregamentosIgnorados`) sai de
  `scripts/validar-templates.mts` e de `docs/VALIDACAO-TEMPLATES.md`, com a
  rodada ainda em 96/96.

## Critérios de entrega

Toda tranche precisa de `npm run typecheck`, testes relevantes e verificação
visual/HTTP proporcional ao risco. Publicação e funcionamento em produção só
serão declarados após evidência no ambiente correspondente.
