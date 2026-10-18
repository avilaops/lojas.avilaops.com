# Catálogos Contratuais B2B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar catálogos e preços contratuais versionados por empresa/unidade, preservando o catálogo público B2C.

**Architecture:** Um agregado transacional separa identidade do catálogo, versões, atribuições, itens e componentes de kit. Um resolvedor puro aplica vigência e precedência total; a camada Prisma persiste snapshots rascunho/aprovado e a API administrativa expõe escrita, aprovação, importação e resolução.

**Tech Stack:** Next.js 16, TypeScript, Prisma, PostgreSQL, Zod, `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-18-catalogos-contratuais-b2b-design.md`

## Global Constraints

- Valores financeiros são inteiros em centavos e percentuais em pontos-base.
- Quantidades e conversões comerciais são inteiros ou razões de inteiros positivos; nunca `Float`.
- Todas as relações B2B preservam tenant e empresa com chaves estrangeiras compostas.
- Versões aprovadas e auditoria são append-only.
- Sem regra B2B válida, o preço público B2C permanece inalterado.
- A primeira entrega aceita somente a moeda `BRL`.

## Review Focus

- Duas atribuições igualmente aplicáveis precisam produzir o mesmo resultado em qualquer ordem de leitura; testar desempate total.
- Uma unidade de outra empresa ou tenant nunca pode ser atribuída ao catálogo; testar restrição composta no PostgreSQL.
- Quantidade inválida por mínimo, máximo ou múltiplo deve ser recusada antes do preço; testar cada fronteira.
- Aprovação concorrente ou retry não pode duplicar auditoria nem permitir mutação posterior; testar idempotência e trigger.
- Kit ou conversão racional inválida não pode escrever nem arredondar estoque; testar validação e ausência de mutação em `SaldoEstoque`.

---

### Task 1: Resolver comercial puro

**Files:**
- Create: `src/lib/catalogo-b2b-resolver.ts`
- Test: `src/lib/catalogo-b2b-resolver.test.ts`

**Interfaces:**
- Produces: `resolverOfertaB2B(entrada: EntradaResolucaoB2B): ResultadoResolucaoB2B`.

- [ ] Escrever testes falhos para vigência, escopo unidade/empresa, prioridade, versão e desempate por ID.
- [ ] Executar `npx tsx --test src/lib/catalogo-b2b-resolver.test.ts` e confirmar falha por módulo ausente.
- [ ] Implementar seleção determinística de atribuição e item.
- [ ] Escrever testes falhos para preço fixo, desconto em pontos-base e arredondamento.
- [ ] Implementar cálculo financeiro inteiro.
- [ ] Escrever testes falhos para mínimo, máximo, múltiplo, exclusão e fallback B2C.
- [ ] Implementar validação de quantidade e retorno discriminado.
- [ ] Executar o arquivo e confirmar todos os casos verdes.

### Task 2: Modelo e migração PostgreSQL

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20261018210000_catalogos_b2b/migration.sql`
- Test: `tests/integration/catalogo-b2b-modelo.test.ts`

**Interfaces:**
- Consumes: tipos e precedência definidos na Task 1.
- Produces: modelos `CatalogoB2B`, `VersaoCatalogoB2B`, `AtribuicaoCatalogoB2B`, `ItemCatalogoB2B`, `ComponenteKitCatalogoB2B` e `AuditoriaCatalogoB2B`.

- [ ] Escrever testes de integração falhos para relações válidas e bloqueio cross-tenant/cross-company.
- [ ] Adicionar enums, modelos, relações e campos opcionais `Produto.ncm`/`Produto.cest` ao schema.
- [ ] Escrever migração com checks de valores, índices compostos e FKs compostas.
- [ ] Adicionar triggers de imutabilidade para versões aprovadas e auditoria append-only.
- [ ] Aplicar migração do zero no PostgreSQL `:5548/*_test` e confirmar os testes verdes.

### Task 3: Schema de entrada e agregado transacional

**Files:**
- Create: `src/lib/catalogo-b2b-schema.ts`
- Create: `src/lib/catalogo-b2b.ts`
- Test: `src/lib/catalogo-b2b-schema.test.ts`
- Test: `tests/integration/catalogo-b2b.test.ts`

**Interfaces:**
- Produces: `EntradaCatalogoB2BSchema`, `salvarCatalogoB2B`, `aprovarVersaoCatalogoB2B`, `obterCatalogoB2B`.

- [ ] Escrever testes falhos de validação para moeda, estratégia exclusiva, intervalos, múltiplos e razões.
- [ ] Implementar schema Zod estrito e mensagens estáveis.
- [ ] Escrever testes falhos para criação, retry idempotente, substituição de rascunho e recusa de aprovado.
- [ ] Implementar gravação transacional com resolução de referências de empresa, unidade, produto e variante.
- [ ] Escrever testes falhos para aprovação, hash, auditoria e imutabilidade.
- [ ] Implementar aprovação idempotente e auditoria append-only.
- [ ] Executar testes unitários e de integração do módulo até ficarem verdes.

### Task 4: Resolução persistida

**Files:**
- Modify: `src/lib/catalogo-b2b.ts`
- Test: `tests/integration/catalogo-b2b-resolucao.test.ts`

**Interfaces:**
- Consumes: `resolverOfertaB2B` e modelos Prisma.
- Produces: `resolverCatalogoB2B(tenantId, entrada)`.

- [ ] Escrever testes falhos para resolução por empresa/unidade, vigência futura/expirada e fallback B2C.
- [ ] Carregar apenas versões aprovadas aplicáveis e projetar os dados no resolvedor puro.
- [ ] Escrever testes falhos para variante, preço-base, exclusão e composição de kit.
- [ ] Implementar projeção do produto mestre sem mutar preço ou saldo.
- [ ] Confirmar que `SaldoEstoque` permanece idêntico antes/depois da resolução.

### Task 5: API administrativa e importação em lote

**Files:**
- Create: `src/app/api/admin/tenants/[slug]/catalogos-b2b/route.ts`
- Create: `src/app/api/admin/tenants/[slug]/catalogos-b2b/[catalogoId]/route.ts`
- Create: `src/app/api/admin/tenants/[slug]/catalogos-b2b/[catalogoId]/aprovar/route.ts`
- Create: `src/app/api/admin/tenants/[slug]/catalogos-b2b/importar/route.ts`
- Create: `src/app/api/admin/tenants/[slug]/catalogos-b2b/resolver/route.ts`
- Test: `tests/integration/catalogo-b2b-api.test.ts`

**Interfaces:**
- Consumes: contratos da Task 3 e Task 4.
- Produces: rotas administrativas documentadas na spec.

- [ ] Escrever testes falhos de autenticação, tenant inexistente, CRUD de rascunho, aprovação e resolução.
- [ ] Implementar handlers finos que resolvem tenant pelo slug e nunca aceitam `tenantId` do corpo.
- [ ] Escrever teste falho de lote com um catálogo válido e um inválido.
- [ ] Implementar importação com transação por agregado e resposta `gravados`/`rejeitados`.
- [ ] Confirmar isolamento entre dois tenants em todas as rotas de item.

### Task 6: Documentação, regressão e entrega

**Files:**
- Create: `docs/CONTRATO-CATALOGO-B2B.md`
- Modify: `.agents/equipe/controle.json`

**Interfaces:**
- Consumes: API e regras finais das Tasks 1–5.
- Produces: contrato operacional e evidência de entrega do AVL-233.

- [ ] Documentar payloads, precedência, estados, erros, importação e compatibilidade B2C.
- [ ] Atualizar o controle da equipe com critérios e evidências reais.
- [ ] Rodar `npm test` e exigir zero falhas.
- [ ] Rodar PostgreSQL isolado, migração do zero e `npm run test:integracao`.
- [ ] Rodar `npm run typecheck`, `npm run lint` e `npm run build -- --webpack`.
- [ ] Revisar o diff completo contra cada critério do AVL-233 antes de commit, PR e rollout.
