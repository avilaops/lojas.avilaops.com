# MRG Configurador 3D Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Entregar um configurador paramétrico 3D tenant-safe que salva solicitações estruturadas de orçamento.

**Architecture:** Um módulo de domínio Zod é a única fonte de validação e resumo. A página server-side aplica a feature flag e entrega a configuração inicial a um componente cliente. A API revalida, limita por tenant/IP e persiste uma revisão JSON imutável em PostgreSQL.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zod 3, Prisma 6, CSS 3D, node:test.

**Spec:** `docs/superpowers/specs/2026-10-31-mrg-configurador-3d-design.md`

## Global Constraints

- Não inventar preço, capacidade, peso, tolerância ou viabilidade fabril.
- Toda leitura/escrita usa o tenant resolvido pelo host.
- Teste deve falhar antes de cada implementação correspondente.
- Não modificar as mudanças do checkout principal.

### Task 1: Contrato paramétrico e feature flag

**Files:**
- Modify: `src/lib/recursos.ts`
- Test: `src/lib/recursos.test.ts`
- Create: `src/lib/configurador-sob-medida.ts`
- Create: `src/lib/configurador-sob-medida.test.ts`

1. Escrever testes que recusam dimensões/quantidade inválidas, exigem contato e consentimento, normalizam textos e geram resumo estável.
2. Executar os testes e confirmar RED por símbolos ausentes.
3. Implementar schemas, tipos, opções e resumo; registrar `configurador_sob_medida` em `RECURSOS`.
4. Executar os testes e confirmar GREEN.

### Task 2: Persistência tenant-safe

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20261031140000_configurador_sob_medida/migration.sql`

1. Adicionar `SolicitacaoSobMedida` e relação no tenant.
2. Gerar o cliente Prisma e validar o schema.

### Task 3: API pública

**Files:**
- Create: `src/lib/solicitacoes-sob-medida.ts`
- Create: `src/lib/solicitacoes-sob-medida.test.ts`
- Create: `src/app/api/configurador/route.ts`

1. Escrever testes do serviço cobrindo referência, payload persistido e isolamento de tenant com uma função de persistência injetável.
2. Confirmar RED.
3. Implementar criação validada e rota com feature flag e rate limit.
4. Confirmar GREEN.

### Task 4: Experiência 3D pública

**Files:**
- Create: `src/app/configurador/page.tsx`
- Create: `src/app/configurador/ConfiguradorClient.tsx`
- Create: `src/app/configurador/configurador.css`

1. Criar página server-side com metadata, canonical e bloqueio por recurso.
2. Implementar formulário acessível, preview CSS 3D responsivo, estados de envio e resumo.
3. Integrar resposta com referência e WhatsApp da loja.

### Task 5: Verificação e entrega

**Files:**
- Modify: `.agents/equipe/controle.json`

1. Atualizar controle da equipe e documentação do ticket.
2. Executar testes focados, suíte completa, lint, typecheck, Prisma validate e build.
3. Revisar diff integral contra spec, corrigir achados importantes e repetir verificações.
4. Criar commits, publicar branch e abrir PR; mover AVL-400 para In Review com evidências.

### Review fix: fila operacional

**Files:**
- Modify: `src/components/painel/NavPainel.tsx`
- Modify: `src/app/plataforma/(admin)/layout.tsx`
- Create: `src/app/plataforma/(admin)/painel/sob-medida/page.tsx`
- Create: `src/lib/nav-painel-configurador.test.ts`

1. Expor a fila apenas quando o recurso estiver ativo no tenant autenticado.
2. Listar as 100 solicitações mais recentes sem misturar tenants.
3. Exibir ficha, observações e canais de resposta sem colocar PII em URLs internas.

## Review Focus

- Bypass de tenant ou feature flag.
- PII em URLs, logs ou WhatsApp.
- Medidas tratadas como aprovação fabril.
- Entrada inválida chegando ao Prisma.
- Layout/controles inutilizáveis no celular ou sem transformações 3D.

