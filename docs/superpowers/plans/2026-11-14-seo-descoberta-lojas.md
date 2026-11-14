# SEO e descoberta do Lojas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar módulo nativo de SEO e descoberta no painel com metadados da home, prévia e seleção de destaques em llms.txt por loja.

**Architecture:** Contrato puro + configuração JSON por tenant + API existente + adaptador único de metadados da home + interface na seção descoberta. Os geradores públicos existentes continuam responsáveis pelos documentos.

**Tech Stack:** TypeScript, Next.js, React, Prisma/PostgreSQL, Zod, Playwright e GitHub CI existentes.

**Spec:** `docs/superpowers/specs/2026-11-14-seo-descoberta-lojas.md`

## Global Constraints

- Separador textual •; preservar sintaxe técnica.
- Builds e testes somente no GitHub CI; não usar banco local ou produção como fixture.
- Novas configurações não alteram lojas existentes antes de uma escolha explícita.
- Preservar identidade, permissões, isolamento, políticas de publicação e treinamento de IA.
- Nenhuma dependência de AIOSEO, chamadas pagas de IA, pontuação inventada ou modal automático.

## Review Focus

- PATCH parcial deve preservar campos não enviados e jamais salvar no tenant indicado pelo corpo.
- Campo vazio restaura a redação automática, sem título duplicado no template do Next.
- Configuração legada malformada não derruba a home e não libera conteúdo privado.
- Desativar destaques afeta apenas o resumo da própria loja, não o catálogo ou treinamento.
- Interface deve funcionar em393px, com rótulos, estado de salvamento e erros acessíveis.

### Task 1: Contrato e persistência

Files: `src/lib/seo-config.ts`, `src/lib/seo-config.test.ts`, `prisma/schema.prisma`, nova migração, `src/lib/admin-schemas.ts`, `src/lib/admin-tenants.ts`.

- [x] Escrever casos de padrão, merge, limites, títulos/descrições e seleção de destaques.
- [x] Registrar RED no CI antes da implementação.
- [x] Implementar contrato, migração aditiva e merge por loja na escrita existente.
- [ ] Verificar contrato e persistência/isolamento no CI.

### Task 2: Saída pública

Files: `src/lib/seo-inicio.ts`, `src/app/page.tsx`, `src/app/llms.txt/route.ts`.

- [x] Compartilhar resolução automática entre prévia e home, preservando as regras existentes.
- [x] Aplicar título absoluto e descrição somente à home; manter canonical e políticas.
- [x] Usar configuração de destaques no resumo, preservando os demais documentos e limites.
- [ ] Verificar metadados e resumo de duas lojas no servidor compilado.

### Task 3: Painel e entrega

Files: `src/components/painel/SeoDescoberta.tsx` substitui o componente Descoberta privado, navegação/cabeçalhos de configurações, `scripts/qa-seo-descoberta.mts`, workflow de CI existente, registros de equipe/MLOps e documentação.

- [x] Criar formulário, prévia, orientações e atalhos com a identidade do painel.
- [x] Integrar sessão e permissão; salvar pelo endpoint existente.
- [ ] Conferir navegação, persistência, erro/negação de acesso, desktop/mobile e ausência de vazamento entre lojas no CI.
- [ ] Revisar diff, checks e artefatos; integrar e acompanhar publicação normal.
- [ ] Conferir defaults em produção sem alterar configurações de clientes e registrar evidências.
