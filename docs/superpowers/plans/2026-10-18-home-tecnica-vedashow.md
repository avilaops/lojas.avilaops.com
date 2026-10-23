# Homepage técnica da VedaShow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a homepage técnica responsiva da AVL-265 no layout industrial do Lojas.

**Architecture:** O servidor monta uma projeção genérica com categorias, marcas e identidade pública. Componentes pequenos cuidam das duas buscas; o layout industrial apenas compõe dados reais e reaproveita logística, catálogo e analytics existentes.

**Tech Stack:** Next.js 16, React 19, TypeScript, Prisma, CSS global, Node test runner via `tsx`.

**Spec:** `docs/superpowers/specs/2026-10-18-home-tecnica-vedashow-design.md`

## Global Constraints

- Sem condicionais por tenant.
- Sem conteúdo ou métricas inventadas.
- Sem dependências novas.
- Sem commit, push ou publicação até o módulo inteiro, testes e screenshots estarem concluídos.

## Review Focus

- Marcas vazias ou duplicadas não podem produzir uma faixa vazia ou repetida.
- Contato inválido não pode vazar para a página.
- Busca dimensional inválida não pode navegar nem registrar conversão.
- Formulários precisam manter navegação compartilhável e acessível.
- Outros layouts precisam continuar aceitando `DadosHome` sem novos campos obrigatórios.

---

### Task 1: Projeção de dados da homepage

**Files:**
- Create: `src/lib/home-industrial.ts`
- Test: `src/lib/home-industrial.test.ts`
- Modify: `src/components/home/tipos.ts`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Produces: `dadosDaHomeIndustrial(categorias, marcas)` com listas limitadas, limpas e estáveis.

- [ ] Escrever testes para prioridade, limite, deduplicação e entradas vazias.
- [ ] Executar o teste e confirmar falha pela função ausente.
- [ ] Implementar a projeção e alimentar `DadosHome` com marcas e identidade pública.
- [ ] Executar o teste e confirmar sucesso.

### Task 2: Buscas técnicas e analytics

**Files:**
- Create: `src/components/home/BuscaTecnica.tsx`
- Modify: `src/components/home/BuscaPorMedida.tsx`
- Test: `src/lib/home-industrial.test.ts`

**Interfaces:**
- Produces: `urlDaBuscaPorMedida(valores)` e formulários que registram `search`/`filter_apply`.

- [ ] Escrever testes para URL dimensional válida e rejeição de valores inválidos.
- [ ] Executar e confirmar falha.
- [ ] Implementar os formulários e eventos usando o contrato existente.
- [ ] Executar e confirmar sucesso.

### Task 3: Composição visual e contatos públicos

**Files:**
- Modify: `src/components/home/Industrial.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: projeção, buscas e `IdentidadePublica` das tasks anteriores.

- [ ] Compor o posto de identificação, famílias, marcas, logística, produtos e contato validado.
- [ ] Verificar typecheck e lint.
- [ ] Executar toda a suíte e build.
- [ ] Gerar e revisar screenshots desktop e mobile.
- [ ] Registrar evidências na AVL-265 e movê-la para In Review.

## Self-review

As três tasks cobrem os dados, comportamento e renderização da especificação. Os novos campos são opcionais para preservar todos os layouts. A validação inclui entradas vazias, valores inválidos, regressão completa e inspeção visual. Passos de commit foram omitidos pela restrição explícita do usuário.
