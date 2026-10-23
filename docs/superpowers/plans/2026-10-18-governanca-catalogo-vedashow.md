# VedaShow Catalog Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a tenant-scoped catalog quality report per SKU with family requirements, duplicates, price conflicts, and measurable coverage.

**Architecture:** A pure aggregate analyzer reuses the existing per-product diagnostic and adds cross-product rules. A read-only authenticated admin route loads the complete tenant catalog and returns the report.

**Tech Stack:** Next.js 16, TypeScript, Prisma 6, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-18-governanca-catalogo-vedashow-design.md`

## Global Constraints

- Do not mutate production data.
- Do not hard-code the VedaShow tenant in runtime code.
- Do not infer missing measurements from product names.
- Do not commit, push, or deploy automatically.

## Review Focus

- Product and default variant may repeat one SKU without becoming a duplicate.
- SKU normalization must catch case, whitespace, punctuation, and separators.
- Null stock means uncontrolled stock, not zero stock.
- Coverage denominator must count required fields per SKU and family.
- The API must include the entire selected tenant and no other tenant.

---

### Task 1: Pure catalog governance report

**Files:**

- Create: `src/lib/catalogo-governanca.ts`
- Create: `src/lib/catalogo-governanca.test.ts`

**Interfaces:**

- Consumes: `ProdutoCatalogo[]` and `diagnosticarProduto(produto)`.
- Produces: `relatorioDeGovernanca(produtos): RelatorioGovernancaCatalogo`.

- [ ] Write failing tests for rows per SKU, technical family requirements, normalized duplicates, price conflicts, null stock, and coverage.
- [ ] Run `npx tsx --test src/lib/catalogo-governanca.test.ts` and confirm missing-module failure.
- [ ] Implement the minimal pure analyzer.
- [ ] Run the focused test and confirm pass.

### Task 2: Complete tenant-scoped administrative endpoint

**Files:**

- Create: `src/app/api/admin/tenants/[slug]/catalogo/qualidade/route.ts`
- Create: `src/lib/catalogo-governanca-api.test.ts`
- Modify: `.agents/equipe/controle.json`

**Interfaces:**

- Consumes: `relatorioDeGovernanca(produtos)`.
- Produces: authenticated `GET /api/admin/tenants/[slug]/catalogo/qualidade`.

- [ ] Write failing source-contract tests for authentication, tenant predicate, complete query, and report projection.
- [ ] Run the focused tests and confirm failure.
- [ ] Implement the read-only route without `take` or cross-tenant queries.
- [ ] Run focused tests, TypeScript, ESLint, full tests, and build in series.
- [ ] Record evidence in Linear and the team ledger; screenshots are not applicable to this API-only increment.
