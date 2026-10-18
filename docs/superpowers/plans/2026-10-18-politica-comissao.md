# Política comercial da comissão Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Formalizar a regra de 5%, alinhar a comunicação pública e registrar aceite versionado antes de ativar novos cadastros.

**Architecture:** A política e a matriz ficam em documentação auditável. A landing consome uma definição textual única e o onboarding exige aceite booleano antes de criar o contrato, cuja referência registra a versão dos termos.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zod, node:test.

**Spec:** `docs/superpowers/specs/2026-10-18-politica-comissao-design.md`

## Global Constraints

- Aplicar 5% somente a novos cadastros ou adesão expressa.
- Não implementar cobrança ou razão neste item.
- Não declarar parecer profissional inexistente.
- Sem commit intermediário; commit e push apenas após todas as verificações.

## Review Focus

- Reenvio do onboarding não pode criar aceite ou contrato duplicado.
- O servidor deve recusar `false`, ausência e texto no campo de aceite.
- Comunicação pública não pode conservar “sem comissão”.
- Canal externo permanece fora da base sem aditivo.
- Termos devem distinguir decisão de produto de validação profissional.

### Task 1: Política e matriz

**Files:**
- Create: `docs/POLITICA-COMISSAO.md`
- Create: `docs/MATRIZ-COMISSAO.md`

- [ ] Documentar base, competência, arredondamento, ajustes, fechamento e contestação.
- [ ] Registrar cenários e resultados esperados.
- [ ] Registrar quatro pareceres pendentes como gate.

### Task 2: Comunicação pública

**Files:**
- Modify: `src/app/plataforma/(site)/page.tsx`
- Modify: `src/app/plataforma/(site)/layout.tsx`
- Modify: `src/app/plataforma/opengraph-image.tsx`
- Modify: `src/app/plataforma/(site)/blog/page.tsx`
- Test: `src/lib/politica-comercial.test.ts`

- [ ] Escrever teste que reprova promessas de comissão zero.
- [ ] Confirmar a falha.
- [ ] Substituir a comunicação por mensalidade mais 5% para novos cadastros.
- [ ] Confirmar o teste.

### Task 3: Aceite no onboarding

**Files:**
- Modify: `src/components/painel/PrimeirosPassos.tsx`
- Modify: `src/app/api/painel/primeiros-passos/route.ts`
- Modify: `src/lib/cadastro.ts`
- Test: `src/lib/cadastro.test.ts`
- Test: `tests/integration/cadastro.test.ts`

- [ ] Escrever testes para ausência, aceite explícito e referência versionada.
- [ ] Confirmar as falhas.
- [ ] Exigir o aceite na tela e no servidor; gravar `termos-comerciais-v1`.
- [ ] Confirmar os testes.

### Task 4: Verificação e entrega

- [ ] Executar lint, typecheck, testes unitários e integração de cadastro.
- [ ] Auditar todas as ocorrências de “sem comissão”.
- [ ] Atualizar Linear com decisões e gates externos.
- [ ] Criar um único commit e PR.
