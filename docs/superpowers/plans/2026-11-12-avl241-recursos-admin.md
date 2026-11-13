# AVL-241 — Configuração administrativa dos recursos de sandbox

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Corrigir o PATCH administrativo que responde 200 enquanto descarta `recursos`.

**Architecture:** Um schema exclusivo da rota administrativa estende o contrato de atualização existente. A lista substitui integralmente os recursos da loja indicada na URL; campo ausente preserva o valor e `[]` revoga todos. O escritor Prisma e a resolução de tenant existentes continuam sendo usados.

**Tech Stack:** TypeScript, Zod 3, Prisma 6, PostgreSQL e node:test no GitHub CI.

**Spec:** Este documento concretiza a falha comprovada durante a preparação da demo, registrada na AVL-241 e no pedido de continuidade de 12/11. Somente códigos de `RECURSOS` são aceitos, sem repetições. O schema compartilhado com o painel não ganha esse campo. Recursos configurados continuam subordinados a `LOJAS_RECURSOS_DESLIGADOS`; configurar a flag não conecta uma conta OAuth.

## Global Constraints

- Builds e testes somente no GitHub CI; dados sintéticos em PostgreSQL isolado `:5548/*_test`.
- Nenhuma mudança de configuração real, conexão OAuth, etiqueta, compra ou publicação integra este incremento.
- Preservar autenticação administrativa, isolamento por slug e exclusão de segredos nas respostas.
- PR separado em rascunho contra `main`; o PR de estoque permanece intacto.
- Reaproveitar os dois arquivos do ajuste de transporte de dependências já validado no PR #236, sem alterar testes, limites ou regras de deploy.

## Review Focus

- O painel do lojista reutiliza `TenantAtualizacaoSchema`; aceitar recursos nele permitiria autoativação.
- Um PATCH sem recursos não pode zerar uma configuração existente, inclusive com códigos legados no banco.
- Lista inválida deve recusar a requisição inteira, inclusive os demais campos enviados.
- O slug no corpo não pode mudar a loja escolhida pela URL.
- O bloqueio global prevalece sobre a lista persistida e respostas não expõem colunas cifradas.
- A resposta administrativa também omite `senhaHash`, que não termina em `Enc`; fixture com hash não nulo e regressão HTTP devem comprovar essa exclusão.

## Task 1: Regressão e correção do contrato administrativo

**Files:** `tests/integration/admin-recursos.test.ts`, `src/lib/admin-schemas.test.ts`, `src/lib/admin-schemas.ts`, `src/lib/admin-tenants.ts`, `src/app/api/admin/tenants/[slug]/route.ts`.

**Interfaces:** Consumir `RECURSOS`, `TenantAtualizacaoSchema`, `atualizarTenant`, `buscarTenantPorHost` e a rota GET/PATCH existente. Produzir `TenantAtualizacaoAdminSchema` e seu tipo inferido somente para escrita administrativa.

- [x] Adicionar testes HTTP/PostgreSQL: persistir/liberar sandbox; omissão preserva; lista vazia revoga; inválidos não alteram nada; autenticação negada; slug/tenant isolados; bloqueio global; leitura sem segredos.
- [x] Acrescentar regressão de unidade comprovando que os schemas de criação e do painel continuam descartando recursos.
- [x] Publicar apenas testes e este contrato; ler a falha real no CI antes de corrigir o produto. CI 43299500617, job 131467418877: cinco falhas de contrato, 66/71 aprovados.
- [x] Criar o schema administrativo com array opcional, limitado a `RECURSOS.length`, enum conhecido e sem duplicatas; tipar o escritor e trocar apenas o parser administrativo.
- [x] Reproduzir a exposição de `senhaHash` com fixture sintético não nulo e excluir esse campo da resposta administrativa. CI 43300715166, job 131471714257: 70/71 aprovados e uma falha exata de presença indevida do campo antes da correção.
- [ ] Executar as suítes completas, tipos, lint, build e navegador no CI; obter revisão independente.

## Task 2: Operação documentada e rastreável

**Files:** `docs/MELHOR-ENVIO-SANDBOX.md`, `.agents/mlops/project.json`, `.agents/equipe/controle.json`.

- [x] Documentar leitura da lista atual, substituição explícita por PATCH e confirmação por GET, sem exemplos com credenciais reais.
- [x] Registrar fontes/testes no módulo de fundação e atualizar a pendência do sandbox sem declarar a correção implantada.
- [ ] Atualizar o PR e a AVL-241 com commit, resultado real e limite da evidência; manter cotação autenticada pendente de OAuth.

## Decisões de execução

Branch exclusiva no checkout limpo, preservando `feat/avl-236-estoque-multilocal`. A lista completa segue a semântica dos demais arrays do PATCH e evita introduzir outro endpoint de configuração. A configuração de `recursos` fica fora do schema do painel por separação explícita de permissões. Duplicatas retornam 422 para evitar listas ambíguas. Registros históricos e alterações de estoque do PR #236 não entram neste PR.
