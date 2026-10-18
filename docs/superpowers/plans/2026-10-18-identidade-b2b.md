# Identidade empresarial B2B — plano de implementação

**Goal:** Modelar empresas, unidades, compradores, papéis, alçadas e centros de custo com isolamento por tenant e integração estável com Auth/CRM.

**Architecture:** Prisma persiste o domínio comercial e auditoria; um serviço de domínio aplica normalização e idempotência; um adaptador integra o contrato `avila.corporativo.v1`. Papéis e alçadas nunca viram fonte local de autorização.

**Tech Stack:** Next.js 16, TypeScript, Prisma 6, PostgreSQL, node:test.

**Spec:** `docs/superpowers/specs/2026-10-18-identidade-b2b-design.md`

## Restrições globais

- Sem alteração no login B2C atual.
- Toda relação entre agregados usa `tenantId` e chave composta.
- Dinheiro em centavos inteiros.
- Um único commit e push depois de todos os testes e revisão.

### Task 1: Persistência e migração

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20261018173000_identidade_b2b/migration.sql`
- Create: `tests/integration/identidade-b2b.test.ts`

- [x] Escrever testes de entidades, cardinalidades, isolamento e idempotência.
- [x] Confirmar falha antes do schema.
- [x] Adicionar enums, modelos, relações e índices compostos.
- [x] Aplicar migração em PostgreSQL isolado e confirmar testes.

### Task 2: Regras do domínio

**Files:**
- Create: `src/lib/identidade-b2b.ts`
- Create: `src/lib/identidade-b2b.test.ts`

- [x] Escrever testes de normalização, validação e promoção sem duplicação.
- [x] Implementar cadastro transacional e trilha de auditoria.
- [x] Confirmar concorrência e escopo por tenant.

### Task 3: Contrato com Auth

**Files:**
- Create: `src/lib/corporativo-auth.ts`
- Create: `src/lib/corporativo-auth.test.ts`
- Create: `docs/CONTRATO-AUTH-CORPORATIVO.md`
- Create: `docs/CONTRATO-CRM-EMPRESA-B2B.md`
- Modify: `.env.example`

- [x] Escrever testes do payload de provisionamento e parser fechado do contexto.
- [x] Implementar intenção/outbox versionada, provisionar, suspender e parser fechado do contexto com timeout.
- [x] Documentar Auth como fonte de papéis/alçadas e o contrato de eventos do CRM.

### Task 4: API administrativa mínima

**Files:**
- Create: `src/app/api/admin/tenants/[slug]/empresas/route.ts`
- Create: `src/app/api/admin/tenants/[slug]/empresas/[empresaId]/route.ts`
- Create: `tests/integration/identidade-b2b-api.test.ts`

- [x] Testar autenticação, isolamento, validação e idempotência.
- [x] Implementar listar, criar e atualizar o agregado completo.
- [x] Confirmar respostas sem segredos nem tokens.

### Task 5: Verificação e entrega

- [x] Rodar Prisma validate/generate, testes unitários, integração, typecheck, lint e build.
- [x] Revisar migração, contrato, segurança e critérios do AVL-232.
- [x] Atualizar controle da equipe e Linear com evidências.
- [ ] Criar um único commit, push e PR; validar CI e produção antes de concluir.
