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
`npm run lint` continua fora do bloqueio enquanto os erros herdados (scripts
`.cjs` na raiz, `packages/checkout/src/ui`) não forem limpos.

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

- [ ] Onboarding orientado por checklist: identidade, domínio, catálogo,
  recebimento, entrega e publicação.
- [ ] Instrumentar métricas por tenant (latência, erros, conversão e pedidos),
  sem registrar tokens ou dados sensíveis.
- [ ] Melhorar isolamento operacional: limites de upload, timeout de integrações,
  idempotência e alertas n8n acionáveis.
- [ ] Backup, migração e rollback documentados como rotina verificável do deploy.

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
