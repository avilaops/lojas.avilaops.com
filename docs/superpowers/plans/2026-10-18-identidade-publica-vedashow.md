# VedaShow Public Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish confirmed commercial identity and channels consistently across every public surface.

**Architecture:** A pure tenant projection validates and normalizes public identity. Contact, footer, `llms.txt`, and Store JSON-LD consume that projection instead of independently interpreting raw tenant fields.

**Tech Stack:** Next.js 16, React 19, TypeScript, Node test runner, Prisma 6.

**Spec:** `docs/superpowers/specs/2026-10-18-identidade-publica-vedashow-design.md`

## Global Constraints

- Do not mutate production data.
- Do not hard-code VedaShow data in runtime code.
- Do not publish incomplete address or unconfirmed opening hours.
- Do not send messages, calls, or e-mails.
- Do not commit, push, or deploy automatically.

## Review Focus

- Formatted CNPJ and telephone must normalize without losing their display form.
- Malformed e-mail, CNPJ, telephone, and WhatsApp must be omitted.
- Legal address requires completeness; the visit invitation also requires `enderecoPublico`.
- JSON-LD must not contain empty strings or incomplete `PostalAddress` data.
- Existing tenants with partial data must render without throwing.

---

### Task 1: Validated public identity projection

**Files:**

- Create: `src/lib/identidade-publica.ts`
- Create: `src/lib/identidade-publica.test.ts`

**Interfaces:**

- Produces: `identidadePublica(tenant): IdentidadePublica`.
- Consumes: tenant contact, legal identity, address, and hours fields.

- [ ] Write failing tests for the confirmed VedaShow fixture, malformed values, private address, and partial address.
- [ ] Run focused tests and confirm the missing-module failure.
- [ ] Implement the minimal pure projection.
- [ ] Run focused tests and confirm pass.

### Task 2: Public consumers and structured data

**Files:**

- Modify: `src/app/layout.tsx`
- Modify: `src/app/contato/page.tsx`
- Modify: `src/components/Footer.tsx`
- Modify: `src/app/llms.txt/route.ts`
- Modify: `.agents/equipe/controle.json`

**Interfaces:**

- Consumes: `identidadePublica(tenant): IdentidadePublica` from Task 1.
- Produces: consistent page, footer, text discovery, and Store JSON-LD output.

- [ ] Write failing tests for the Store schema projection.
- [ ] Run focused tests and confirm failure.
- [ ] Replace raw public identity reads with the validated projection.
- [ ] Run focused tests, TypeScript, ESLint, full tests, and build in series.
- [ ] Record evidence in Linear and the team ledger; screenshots are required only if rendered layout changes materially.

## Retomada — AVL-261 — 03/11/2026

- [x] Conferir a implementação já versionada e preservar o checkout com alterações de outras demandas.
- [x] Auditar home, catálogo, contato, quatro políticas, rodapé, JSON-LD e `llms.txt` públicos.
- [x] Reproduzir falhas de canal malformado, WhatsApp nacional sem DDI, endereço JSON inválido, políticas e descrição de contato.
- [x] Aplicar validação compartilhada aos consumidores e incluir CNPJ em `llms.txt`.
- [x] Corrigir regressão de DDI estrangeiro explícito encontrada na revisão independente, com teste RED → GREEN e normalização idempotente.
- [x] Aprovar 47 testes direcionados.
- [ ] Aprovar suíte geral, tipos, lint e CI da branch.
- [ ] Publicar pelo workflow do repositório e conferir produção.

Decisão: a implementação anterior já está na main; esta retomada corrige as
lacunas verificadas, sem repetir o módulo nem alterar dados cadastrais.
O usuário autorizou expressamente o deploy em 03/11/2026, substituindo para esta
entrega a restrição histórica de commit, push e publicação automática acima.

A auditoria pública confirmou WhatsApp `551634413180`, telefone
`(16) 3441-3180`, e-mail `vendas@vedashow.com.br` e CNPJ `58.392.666/0001-12`
consistentes no HTML e no schema. Endereço, horário e razão social não estavam
publicados. A confirmação textual do usuário foi “Correto”; ela não fornece
os campos ausentes nem comprova emissão fiscal ou recebimento de atendimento.
Esses pontos permanecem pendentes de evidência operacional.

Os primeiros comandos gerais locais sofreram falta de espaço/memória:
TypeScript foi encerrado pelo sistema; a suíte registrou 166 cancelamentos
por event loop encerrado. A validação é repetida em série, com um worker,
e a publicação depende da CI obrigatória. Esses comandos interrompidos não
constituem evidência de aprovação.
