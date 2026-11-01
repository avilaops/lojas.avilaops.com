# MRG Ficha Técnica de Produção Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persistir uma ficha técnica imutável e exibir uma prévia SVG tenant-safe para cada solicitação sob medida da MRG.

**Architecture:** Um módulo de domínio cria e valida o snapshot versionado e gera SVG determinístico sem PII. A criação da solicitação persiste snapshot e versões na mesma inserção. Um serviço privado resolve registros por tenant para a página de detalhe e para a rota autenticada da imagem.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zod 3, Prisma 6, PostgreSQL 18, SVG, node:test.

**Spec:** `docs/superpowers/specs/2026-11-01-mrg-ficha-tecnica-producao-design.md`

## Global Constraints

- Não gerar arquivo de máquina nem afirmar liberação para fabricação.
- Não calcular preço, capacidade, peso, desempenho térmico ou viabilidade.
- Não aceitar SVG, HTML ou imagem enviados pelo cliente.
- Toda leitura privada deve incluir o `tenantId` da sessão.
- Solicitações antigas não podem ser alteradas por backfill silencioso.
- Cada comportamento novo começa por um teste que falha pelo motivo esperado.

## Review Focus

- Registro antigo com JSON inválido deve falhar fechado sem quebrar ou vazar detalhes do painel; coberto na Task 3.
- ID válido de outro tenant deve ser indistinguível de ID inexistente; coberto na Task 3.
- Texto livre malicioso não pode entrar no SVG; coberto na Task 1.
- Dimensões extremas válidas não podem produzir viewport inválido ou cota ilegível; coberto na Task 1.
- Snapshot parcial no banco deve ser rejeitado pela migração e pelo parser; coberto nas Tasks 1 e 2.

---

### Task 1: Contrato imutável e gerador SVG

**Files:**
- Create: `src/lib/ficha-tecnica-sob-medida.ts`
- Create: `src/lib/ficha-tecnica-sob-medida.test.ts`

**Interfaces:**
- Consumes: `ConfiguracaoSobMedida`, opções e versão de `src/lib/configurador-sob-medida.ts`.
- Produces: `FichaTecnicaSobMedidaSchema`, `FichaTecnicaSobMedida`, `VERSAO_FICHA_TECNICA_SOB_MEDIDA`, `VERSAO_PREVIA_SOB_MEDIDA`, `criarFichaTecnicaSobMedida(...)` e `gerarPreviaSvgSobMedida(...)`.

- [ ] **Step 1:** Escrever testes com expectativas literais para snapshot, determinismo, mudança geométrica, limites dimensionais e ausência de PII/texto livre no SVG.
- [ ] **Step 2:** Executar `npx tsx --test src/lib/ficha-tecnica-sob-medida.test.ts` e confirmar falha por módulo ausente.
- [ ] **Step 3:** Implementar schemas, criação do snapshot e gerador SVG puro com escape de texto controlado.
- [ ] **Step 4:** Reexecutar o teste focado e confirmar aprovação.

### Task 2: Persistência atômica e migração

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20261101170000_ficha_tecnica_sob_medida/migration.sql`
- Modify: `src/lib/solicitacoes-sob-medida.ts`
- Modify: `src/lib/solicitacoes-sob-medida.test.ts`

**Interfaces:**
- Consumes: `criarFichaTecnicaSobMedida(...)` e constantes de versão da Task 1.
- Produces: os campos `fichaTecnica`, `fichaTecnicaVersao` e `previaVersao` persistidos em toda solicitação nova.

- [ ] **Step 1:** Acrescentar teste que exige snapshot e versões literais no payload de persistência e confirma referência de origem.
- [ ] **Step 2:** Executar o teste focado e confirmar falha pela ausência dos campos.
- [ ] **Step 3:** Adicionar campos Prisma, migração com restrição all-or-none/versões positivas e criação atômica da ficha.
- [ ] **Step 4:** Executar `npx prisma generate`, `npx prisma validate` e os testes de solicitação.

### Task 3: Consulta privada tenant-safe e compatibilidade histórica

**Files:**
- Create: `src/lib/painel-sob-medida.ts`
- Create: `src/lib/painel-sob-medida.test.ts`

**Interfaces:**
- Consumes: schema e construtor da Task 1, configuração histórica e Prisma.
- Produces: `buscarProjetoSobMedidaNoPainel(tenantId, id, buscar?)`, retornando contato, metadados e ficha validada ou `null`.

- [ ] **Step 1:** Escrever testes que exigem filtro composto por tenant, usam snapshot persistido, fazem fallback sem escrita e rejeitam snapshot/JSON inválido.
- [ ] **Step 2:** Executar teste focado e confirmar falha por módulo ausente.
- [ ] **Step 3:** Implementar consulta injetável e normalização fail-closed.
- [ ] **Step 4:** Reexecutar teste focado e confirmar aprovação.

### Task 4: Detalhe, SVG autenticado e impressão

**Files:**
- Create: `src/components/painel/FichaTecnicaSobMedida.tsx`
- Create: `src/components/painel/FichaTecnicaSobMedida.test.tsx`
- Create: `src/components/painel/ImprimirFichaSobMedida.tsx`
- Create: `src/app/plataforma/(admin)/painel/sob-medida/[id]/page.tsx`
- Create: `src/app/api/painel/sob-medida/[id]/previa.svg/route.ts`
- Modify: `src/app/plataforma/(admin)/painel/sob-medida/page.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: `buscarProjetoSobMedidaNoPainel(...)` e `gerarPreviaSvgSobMedida(...)`.
- Produces: página privada imprimível, rota SVG privada e link de detalhe na fila.

- [ ] **Step 1:** Escrever teste SSR do componente exigindo campos, aviso fabril, URL interna da prévia e ausência de hash/chave.
- [ ] **Step 2:** Executar teste e confirmar falha por componente ausente.
- [ ] **Step 3:** Implementar componente, botão de impressão, página e rota com sessão, recurso, tenant e cabeçalhos privados.
- [ ] **Step 4:** Atualizar a fila e estilos de impressão; reexecutar testes focados.

### Task 5: Controle, verificação e entrega

**Files:**
- Modify: `.agents/equipe/controle.json`

**Interfaces:**
- Consumes: entregáveis e evidências das Tasks 1–4.
- Produces: registro AVL-403, branch revisável e PR.

- [ ] **Step 1:** Registrar objetivo, critérios, estado e evidências no controle da equipe sem alterar tarefas alheias.
- [ ] **Step 2:** Executar testes focados, `npm test`, `npm run typecheck`, `npm run lint`, `npx prisma validate` e build no Node 22.
- [ ] **Step 3:** Revisar o diff integral contra a spec, corrigir achados e repetir os gates afetados.
- [ ] **Step 4:** Commitar, publicar a branch e abrir PR; mover AVL-403 para `In Review` e escrever comentário reflexivo.
