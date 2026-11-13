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
- Custom Domains por hostname; não prometer wildcard nem DNS externo migrado.
- Manifesto de backup nunca representa exportação incompleta; preservar snapshot.

## Tarefas

- [ ] Adicionar regressões Worker e SSO por host encaminhado; observar RED no CI.
- [ ] Implementar `deploy/cloudflare/entry-worker.mjs` e header lógico em `src/proxy.ts`.
- [ ] Medir backup directory paralelo; validar pg_restore e registrar o formato.
- [ ] CI completo, revisão e merge; disponibilizar release aprovada no R2/Render.
- [ ] Publicar Worker, configurar domínios Cloudflare e conferir TLS/SSO/lojas.
- [ ] Conferir backup, migração e entrega; atualizar Linear e evidências sanitizadas.
