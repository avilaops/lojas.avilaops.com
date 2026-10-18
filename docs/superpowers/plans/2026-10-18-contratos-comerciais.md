# Contratos comerciais versionados Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar contratos comerciais versionados por tenant e vinculá-los aos novos pedidos sem retroagir a comissão.

**Architecture:** Prisma guarda versões imutáveis e pedidos apontam para a versão aplicável. Um serviço central resolve/cria versões; fluxos de cadastro e pedido apenas consomem esse contrato. A faixa antiga permanece como compatibilidade de leitura durante a migração.

**Tech Stack:** Next.js 16, TypeScript, Prisma 6, PostgreSQL, node:test, Zod.

**Spec:** `docs/superpowers/specs/2026-10-18-contratos-comerciais-design.md`

## Global Constraints

- Dinheiro em centavos inteiros; comissão em pontos-base.
- Nenhum cliente legado recebe 5% por fallback.
- Sem commit intermediário; commit e push somente após o módulo inteiro e as verificações.
- Builds e testes pesados permanecem no GitHub Actions.

## Review Focus

- Duas versões cobrindo o mesmo instante devem ser recusadas.
- Lacuna de contrato deixa pedido sem referência e não inventa comissão.
- Mudança de contrato não altera pedidos antigos.
- Vedashow e Bereta são localizadas por slug, não por nome exibido.
- Concorrência de criação deve terminar com apenas uma versão válida.

---

### Task 1: Persistência e migração

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20261018160000_contratos_comerciais/migration.sql`
- Test: `tests/integration/contratos-comerciais.test.ts`

**Interfaces:**
- Produces: `ContratoComercial`, `SituacaoContratoComercial`, `Pedido.contratoComercialId`.

- [x] Escrever teste de migração e relações.
- [x] Confirmar falha antes do schema.
- [x] Adicionar modelos, índices e dados legados.
- [x] Gerar Prisma Client e confirmar teste.

### Task 2: Regras de domínio e API administrativa

**Files:**
- Create: `src/lib/contratos-comerciais.ts`
- Create: `src/app/api/admin/tenants/[slug]/contratos/route.ts`
- Test: `src/lib/contratos-comerciais.test.ts`
- Test: `tests/integration/contratos-comerciais.test.ts`

**Interfaces:**
- Produces: `dadosDoContratoPadrao`, `contratoVigente`, `criarVersaoContrato`.

- [x] Escrever testes de valores, vigência, sobreposição e histórico.
- [x] Confirmar falhas.
- [x] Implementar regras puras, serviço transacional e GET/POST administrativos.
- [x] Confirmar testes.

### Task 3: Novos cadastros e mensalidade

**Files:**
- Modify: `src/lib/cadastro.ts`
- Modify: `src/lib/admin-tenants.ts`
- Modify: `src/lib/faixas-antigas.ts`
- Test: `tests/integration/cadastro.test.ts`
- Test: `tests/integration/admin-assinatura.test.ts`

**Interfaces:**
- Consumes: `dadosDoContratoPadrao`.
- Produces: novos tenants com contrato padrão e mensalidade lida do contrato vigente.

- [x] Escrever testes para cadastro público, administrativo e compatibilidade legada.
- [x] Confirmar falhas.
- [x] Criar contrato aninhado e preferir mensalidade contratual.
- [x] Confirmar testes.

### Task 4: Fixar contrato no pedido

**Files:**
- Modify: `src/lib/pedidos.ts`
- Modify: `src/lib/mercadolivre-pedidos.ts`
- Test: `tests/integration/checkout.test.ts`
- Test: `src/lib/mercadolivre-pedidos.test.ts`

**Interfaces:**
- Consumes: `contratoVigente(tenantId, instante)`.
- Produces: `Pedido.contratoComercialId` estável.

- [x] Escrever testes de contrato vigente, lacuna e preservação histórica.
- [x] Confirmar falhas.
- [x] Resolver a versão antes da criação idempotente do pedido.
- [x] Confirmar testes.

### Task 5: Verificação e entrega

**Files:**
- Modify: `README.md`
- Modify: `.agents/equipe/controle.json`

- [x] Executar formatação/schema, lint, typecheck e testes unitários.
- [x] Executar integração no banco isolado.
- [x] Revisar diff, segredos, migração e critérios do AVL-252.
- [ ] Atualizar Linear com evidências.
- [ ] Fazer um único commit, push e abrir PR.
