# OMNI-0.1 Fontes Canônicas Implementation Plan

<!-- markdownlint-disable MD013 -->

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Versionar a matriz de propriedade e fonte canônica dos dados do Lojas 360.

**Architecture:** Um contrato documental único define autoridade, escritores, réplicas e resolução de conflitos por grupo de campos. Documentos especializados continuam detalhando cada domínio e são referenciados, não duplicados.

**Tech Stack:** Markdown, shell para validação estrutural, Git.

**Spec:** `docs/superpowers/specs/2026-10-18-omni-0-1-fontes-canonicas-design.md`

## Global Constraints

- Cobrir catálogo, preço, estoque, pedido, cliente, fiscal, financeiro, atendimento e logística.
- Não alterar banco, APIs ou telas neste recorte.
- Não tratar conexão como completude da integração.
- Não fazer build, deploy, merge ou publicação em servidor.

## Review Focus

- Estado externo atrasado não pode vencer automaticamente uma decisão local mais nova.
- Fato financeiro ou fiscal confirmado no provedor não pode ser reescrito pelo Lojas.
- Estoque publicado deve ser projeção do saldo disponível, nunca outro saldo mestre.
- Identidades externas ambíguas exigem revisão humana e preservam os registros originais.
- Ausência ou falha do provedor mantém último estado conhecido com sinal de defasagem.

---

### Task 1: Matriz canônica

**Files:**

- Create: `docs/OMNI-FONTES-CANONICAS.md`
- Test: validação estrutural executada no shell

**Interfaces:**

- Consumes: contratos existentes em `docs/` e modelos em `prisma/schema.prisma`.
- Produces: contrato de autoridade de dados que orientará OMNI-0.2 a OMNI-0.7 e os adaptadores de canal.

- [x] **Step 1: Executar validação estrutural antes do artefato**

Run: `test -f docs/OMNI-FONTES-CANONICAS.md`

Expected: FAIL porque o contrato ainda não existe.

- [x] **Step 2: Criar a matriz com políticas globais e os nove domínios**

Cada linha deve informar grupo de campos, fonte canônica, escritores, réplicas e regra de conflito/exceção.

- [x] **Step 3: Validar a estrutura e a cobertura**

Run: `bash -eu -o pipefail -c 'f=docs/OMNI-FONTES-CANONICAS.md; test -s "$f"; for h in Catálogo Preço Estoque Pedido Cliente Fiscal Financeiro Atendimento Logística; do rg -q "^## .*${h}" "$f"; done; rg -q "Fonte canônica" "$f"; rg -q "Escritores autorizados" "$f"; rg -q "Conflito ou exceção" "$f"'`

Expected: PASS sem saída.

- [x] **Step 4: Validar Markdown e whitespace**

Run: `npx --yes markdownlint-cli2@0.23.3 docs/OMNI-FONTES-CANONICAS.md docs/superpowers/specs/2026-10-18-omni-0-1-fontes-canonicas-design.md docs/superpowers/plans/2026-10-18-omni-0-1-fontes-canonicas.md && git add docs/OMNI-FONTES-CANONICAS.md docs/superpowers/specs/2026-10-18-omni-0-1-fontes-canonicas-design.md docs/superpowers/plans/2026-10-18-omni-0-1-fontes-canonicas.md && git diff --cached --check`

Expected: markdownlint sem achados e `git diff --cached --check` sem erros; qualquer falha interrompe o comando.
