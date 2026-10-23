# OMNI-0.3 Central de Conexões Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar uma Central de Conexões que mostre e teste a saúde real dos canais por loja, com histórico e alertas acionáveis.

**Architecture:** Um serviço server-side deriva retratos de saúde das tabelas canônicas existentes e de um novo log imutável de eventos sanitizados. A página renderiza o retrato sem rede externa; um endpoint autorizado executa testes explícitos por canal e grava o resultado no histórico.

**Tech Stack:** Next.js 16, React 19, TypeScript, Prisma/PostgreSQL, Node test runner e CSS/Tailwind existentes.

**Spec:** `docs/superpowers/specs/2026-10-18-omni-0-3-central-conexoes-design.md`

## Global Constraints

- Nenhum segredo, token, corpo bruto ou erro sensível chega ao navegador ou ao histórico.
- Toda consulta e mutação é isolada pelo tenant da sessão.
- Abrir a página não consulta provedores externos.
- Testar/reconectar exige permissão `configuracoes` no backend.
- Canais somente conexão não podem aparecer como operação completa.
- Leitura é permitida a qualquer operador autenticado; teste e reconexão exigem `configuracoes`.
- Uma execução de teste por tenant/canal a cada 60 segundos, inclusive entre processos.
- UI deve funcionar em 390 px e 1440 px sem rolagem horizontal.

## Review Focus

- Conta com access token vencido e refresh válido deve aparecer em atenção, não saudável nem desconectada; refresh vencido é erro.
- Canal conectado sem operação de domínio deve dizer “somente conexão” e não inventar atraso.
- Erro do provedor deve virar código/mensagem de allowlist antes de persistir ou responder, mesmo quando contém segredo em mensagem, `cause`, URL ou JSON.
- Evento de outra loja nunca pode aparecer no histórico do tenant atual.
- Webhook desativado por falhas e entrega esgotada devem gerar alerta acionável.

---

### Task 1: Contrato de saúde e histórico imutável

**Files:**

- Create: `prisma/migrations/20261018230000_central_conexoes/migration.sql`
- Modify: `prisma/schema.prisma`
- Create: `src/lib/saude-canais.ts`
- Create: `src/lib/saude-canais.test.ts`

**Interfaces:**

- Produces: `EstadoSaudeCanal`, `RetratoSaudeCanal`, `avaliarSaudeCanal(entrada, agora)` e `mensagemSegura(erro)`.
- Produces: modelo append-only `EventoSaudeCanal` com tenant, canal, tipo, resultado, código/mensagem, ator, chave de deduplicação e data.

- [ ] Escrever testes falhos para precedência, expiração, atraso, canal somente conexão, múltiplos webhooks e sanitização recursiva.
- [ ] Executar `npx tsx --test src/lib/saude-canais.test.ts` e confirmar falha pela ausência do módulo.
- [ ] Implementar tipos e função pura mínima; executar o teste até passar.
- [ ] Criar migração e schema com limites, índices por tenant/canal/data, unicidade da reserva e triggers contra `UPDATE`/`DELETE`.

### Task 2: Coleta server-side e teste autorizado

**Files:**

- Modify: `src/lib/saude-canais.ts`
- Create: `src/app/api/painel/conexoes/[canal]/testar/route.ts`
- Create: `src/lib/saude-canais-integracao.test.ts`

**Interfaces:**

- Consumes: `avaliarSaudeCanal` e `EventoSaudeCanal` da Task 1.
- Produces: `saudeDosCanais(tenantId, agora)` e `testarCanal(tenantId, canal, ator, agora)`.

- [ ] Escrever testes falhos de isolamento com ID de outro tenant, canal desconhecido, fontes por canal, todas as credenciais de pagamento, gravação de sucesso/falha, cooldown, concorrência, timeout e permissão da rota.
- [ ] Implementar consultas agregadas sem chamadas externas na leitura.
- [ ] Implementar testadores com `AbortController`, reserva transacional e clientes existentes; renovar token rotativo somente pelo caminho que persiste o novo par antes da validação seguinte.
- [ ] Executar testes direcionados e migração num PostgreSQL isolado.

### Task 3: Central responsiva e navegação

**Files:**

- Create: `src/app/plataforma/(admin)/painel/conexoes/page.tsx`
- Create: `src/components/painel/CentralConexoes.tsx`
- Modify: `src/components/painel/NavPainel.tsx`
- Modify: `src/app/plataforma/(admin)/painel.css`
- Create: `src/lib/central-conexoes-ui.test.ts`

**Interfaces:**

- Consumes: `saudeDosCanais` da Task 2.
- Produces: rota `/painel/conexoes`, ação de teste e links contextuais de conexão/reconexão.

- [ ] Escrever teste falho de navegação, rótulos de estado, alertas, links exatos por canal e estados OAuth recusado/indisponível/sem permissão.
- [ ] Implementar página server-side e componente cliente com detalhes expansíveis e feedback acessível.
- [ ] Aplicar layout de mesa operacional usando apenas tokens visuais existentes.
- [ ] Validar com Playwright em 390 px e 1440 px: largura real, foco por teclado, expansão, estado de carregamento e anúncio acessível; salvar capturas em `docs/revisao-telas/omni-0-3-central-conexoes/`.

### Task 4: Registro, documentação e gates

**Files:**

- Modify: `.agents/equipe/controle.json`
- Modify: `docs/OMNI-INVENTARIO-INTEGRACOES.md`

**Interfaces:**

- Consumes: resultados e evidências das Tasks 1–3.
- Produces: registro de OMNI-0.3 pronto para revisão.

- [ ] Registrar tarefa, decisão arquitetural, evidências e estado sem atribuir membro inexistente.
- [ ] Atualizar o inventário com o caminho da Central e a política de teste explícito.
- [ ] Executar testes direcionados, suíte geral, integração, TypeScript, ESLint, build, markdownlint e `git diff --check`.
- [ ] Revisar capturas desktop/mobile e o diff completo; então fazer um commit, push e PR sem deploy manual.
