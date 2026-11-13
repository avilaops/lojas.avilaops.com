# Downloads fiscais e entrada de estoque — implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans
> to implement this plan task-by-task.

**Goal:** Corrigir download/sincronização e permitir conferência e confirmação
idempotente de entrada por NF-e no Lojas.

**Architecture:** Backend TypeScript reutiliza o razão multilocal. Serviço
privado isolado renderiza DANFE. CNPJs integrados ao ERP mantêm sua autoridade.

**Tech Stack:** Next.js16, Prisma/PostgreSQL18, React, Python/BrazilFiscalReport,
Render, R2 e GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-13-fiscal-entry-design.md`.

## Restrições

- Testes/builds somente no CI; dados sintéticos, sem XML de cliente nos artefatos.
- Não manifestar, confirmar operação fiscal ou movimentar estoque real em teste.
- Preservar migrações, chaves, isolamento, backoff SEFAZ e exclusão da PK.
- Novos jobs continuam com1min; exceção5min anterior só backup/confirmação.

## Tarefas

- [ ] Regressões RED para NSUs de1a15dígitos e valores inválidos; corrigir
  `src/lib/fiscal-distribuicao.ts` normalizando controles e docZip, sem alterar
  XML original, intervalo ou cursor em falhas.
- [ ] Serviço privado `deploy/fiscal/` para DANFE e job de teste1min; observar
  RED por ausência antes de implementar autenticação, validação e renderização.
- [ ] Contratos e parser `src/lib/fiscal-entrada-*`: documento completo,
  destinatário, itens e comando validado. Regressões RED antes do serviço.
- [ ] Expor função transacional do estoque sem mudar o contrato existente;
  serviço de entrada com trava natural da NF-e, ordenação de travas de produtos,
  chave idempotente e recibo. Integrações de duplicidade, concorrência e rollback.
- [ ] API GET/POST de conferência por documento, busca limitada de variantes e
  permissões/origem. Mostrar recibo prévio e aviso de cancelamento posterior.
- [ ] Componente de conferência e seleção visíveis em desktop/mobile; explicar
  resumo versus completo e disponibilidade de arquivos. Jornadas sintéticas no
  navegador verificam seleção, revisão, confirmação e repetição sem duplicação.
- [ ] Revisão, CI completo, merge e deploy; configurar gerador privado no
  Render e conferir downloads reais sem guardar conteúdo fiscal nos logs.
- [ ] Atualizar Linear e evidências; verificar consulta real apenas depois do
  horário elegível, se isso puder ser feito nesta execução.
