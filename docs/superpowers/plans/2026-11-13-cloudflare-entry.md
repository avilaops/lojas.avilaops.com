# Entrada Cloudflare — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Publicar Lojas nos hosts existentes pelo Cloudflare com runtime TypeScript no Render.

**Architecture:** Worker com origem fixa e host lógico; normalização de headers
no proxy Next; domínios e TLS gerenciados na Cloudflare. Backup PostgreSQL com
snapshot paralelo será medido antes de adoção, sem remover o gate de migração.

**Tech Stack:** Cloudflare Workers REST, Next.js 16, Node 22, PostgreSQL 18, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-13-cloudflare-entry-design.md`.

## Restrições e revisão

- Backend em TypeScript; banco isolado e chaves originais preservados.
- Builds/testes no GitHub CI; nenhum dado de cliente no Git ou logs.
- Verificar redirects OAuth, múltiplos Set-Cookie, cookies privados e streaming.
- Custom Domain base com certificado ativo e SAN wildcard conferido antes de
  associar a rota/DNS wildcard. DNS externo depende de acesso próprio.
- Manifesto de backup nunca representa exportação incompleta; preservar snapshot.

## Tarefas

- [x] Adicionar regressões Worker e SSO por host encaminhado; observar RED no CI.
- [x] Implementar `deploy/cloudflare/entry-worker.mjs` e header lógico em `src/proxy.ts`.
- [x] Medir backup directory paralelo; validar pg_restore e registrar o formato.
- [ ] CI completo, revisão e merge; disponibilizar release aprovada no R2/Render.
- [ ] Publicar Worker, configurar domínios Cloudflare e conferir TLS/SSO/lojas.
- [ ] Conferir backup, migração e entrega; atualizar Linear e evidências sanitizadas.

## Evidências antes da promoção

- RED de Worker/SSO: execução 43466631869; RED adicional de cache, marcador
  forjado e confirmação de deploy: execução 43469601937.
- Backup integral: execução 43470010503 aprovada em cerca de 100 segundos,
  snapshot sincronizado, leitura de todos os itens por pg_restore e manifesto
  imutável por último no R2. Isso não equivale a um ensaio completo de restore.
- Exceção autorizada pelo proprietário: até cinco minutos para backup e
  confirmação; os demais limites permanecem iguais.
- Canary Cloudflare: certificado ativo, SAN wildcard literal e HTTPS verificado
  em slug novo sem Custom Domain individual. A produção exige a mesma conferência
  no seu próprio certificado; evidência do canário não substitui essa validação.
- Inter/Poppins empacotadas localmente no CI 43480516679, com OFL, hashes e
  equivalência de glifos/métricas; preparo isolado da entrega de produção.
- Revisão sem Critical/Important até 3796bb1. CI final, release da main e
  domínios de clientes ainda aguardam aprovação/promoção.

Registro operacional atualizado: documento Linear
`8765b0b9-0131-41c6-a04f-dc86198cb8d7` e evidências sanitizadas em
`outputs/lojas-cloudflare-recovery-20261113` no workspace.
