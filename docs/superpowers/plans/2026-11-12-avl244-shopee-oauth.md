# AVL-244 — Conexão Shopee no backend TypeScript

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Completar a autorização Shopee existente com validação de credenciais, configuração coerente dos ambientes e provas de persistência por loja.

**Architecture:** Reutilizar provedor, state assinado, callback com sessão/permissão e ContaCanal cifrada existentes. Endurecer somente o adaptador Shopee; não substituir o protocolo oficial por OAuth2 genérico. Troca de código e renovação usam HMAC e shop_id; a autorização usa a página oficial com state.

**Tech Stack:** TypeScript, Next.js, Prisma6, PostgreSQL e node:test no GitHub CI.

**Spec:** Guia indicado pelo proprietário (Introduction, id4) e os guias oficiais20 (Authorization and Authentication),739 (primeira loja) e644 (Sandbox V2), consultados em12/11/2026. A página pública usa JavaScript; conteúdo obtido pela mesma API pública do portal, com document_id/language_code descobertos no bundle oficial. Evidências e SHA-256 estão em outputs/shopee-oauth-20261112/official no workspace.

## Global Constraints

- O backend do Lojas permanece TypeScript/Next.js, conforme decisão explícita do proprietário em12/11/2026.
- Builds e testes somente no GitHub CI; integrações usam PostgreSQL isolado `:5548/*_test` e respostas Shopee sintéticas.
- Credenciais reais não entram em código, logs, testes ou relatórios. Não criar conta, autorizar loja, publicar anúncios ou operar pedidos sem o acesso e a ação correspondentes do proprietário.
- Preservar state assinado com propósito/expiração, sessão, permissão de configurações, isolamento de tenant e cifragem existente.
- Produção: API `https://partner.shopeemobile.com`; autorização BR `https://open.shopee.com.br/auth` ou global `https://open.shopee.com/auth`.
- Sandbox: API `https://openplatform.sandbox.test-stable.shopee.sg`; autorização BR `https://open.sandbox.test-stable.shopee.com.br/auth` ou global `https://open.sandbox.test-stable.shopee.com/auth`.
- Overrides aceitam somente esses endpoints HTTPS, sem credenciais, porta não padrão, query, fragmento ou caminhos adicionais. API sandbox escolhe autorização sandbox por padrão; ambientes explicitamente misturados são indisponíveis.
- Partner/shop IDs são inteiros positivos representáveis sem perda em JSON Number. Tokens são texto não vazio e validade positiva inteira; resposta HTTP de erro não vira credencial.
- Reutilizar os dois arquivos do transporte de CI já validado; manter limites, testes e regras de entrega. PR separado em rascunho contra main.

## Review Focus

- HTTP400/500 pode conter tokens plausíveis: nunca persistir essas respostas.
- URL de sandbox e autorização de produção não podem ser combinadas; redirects de rede não podem transportar tokens.
- ID maior que Number.MAX_SAFE_INTEGER ou zero não pode mudar silenciosamente a conta/parceiro.
- Corpo não objeto, token vazio e validade ausente/expirada não viram acesso válido por quatro horas.
- Erros externos podem repetir tokens; usar mensagens locais sanitizadas e preservar a conexão anterior quando uma troca falha.

## Task 1: Contrato de autorização e regressões

**Files:** `src/lib/canal-shopee.ts`, `src/lib/canais-oauth.test.ts`, `tests/integration/shopee-conexao.test.ts`.

**Interfaces:** Preservar `shopee: ProvedorDeCanal`, `assinar`, `validadeEmSegundos`, `conectar`, `tokenDoCanal`, `contasDaLoja` e `desconectar`. ContaCanal continua com tokens cifrados e seleção por `(tenantId,canal)`.

- [ ] Criar regressões de unidade para ambientes inválidos, sandbox automático, IDs inválidos, HTTP de erro com tokens, corpos/tokens/validades inválidos, redirecionamentos/cache e mensagens sanitizadas.
- [ ] Criar integração real PostgreSQL: salvar isoladamente, cifrar, renovar refresh, compartilhar renovação concorrente e preservar conta anterior em recusa HTTP.
- [ ] Publicar testes/contrato e ler falhas de asserção reais na CI antes de alterar o produto.
- [ ] Implementar validação e guards no adaptador Shopee, preservando o fluxo oficial já implementado e os demais provedores.
- [ ] Conferir suítes completas, tipos, lint, build, navegador e revisão independente no HEAD final.

## Task 2: Configuração e passagem operacional

**Files:** `AGENTS.md`, `.agents/equipe/CONTEXTO.md`, `.agents/equipe/controle.json`, `.agents/mlops/project.json`, `docs/SHOPEE-OAUTH.md`.

- [ ] Registrar a decisão de manter backend TypeScript/Next.js para trabalhos futuros.
- [ ] Documentar cadastro do app, ambiente, credenciais privadas e callback `https://lojas.avilaops.com/canais/shopee/callback`; a conta de desenvolvedor e consentimento são distintos do código pronto.
- [ ] Vincular fontes e testes ao módulo de fundação; atualizar PR e AVL-244 com evidência por commit.
- [ ] Homologar conta real somente após configuração privada do app e autorização da loja; até lá, declarar a pendência e manter PR em rascunho.

## Decisões

Uma loja Shopee por tenant; conta principal sem shop_id permanece recusada. Não há migração de banco nem alteração dos fluxos Amazon/Magalu. Renovação concorrente continua usando a coordenação existente do processo único; múltiplas réplicas exigem coordenação distribuída em outro incremento. Validade absoluta legada pode ser normalizada, mas valor inválido nunca recebe prazo inventado. A consulta opcional do nome pode falhar sem perder tokens válidos.
