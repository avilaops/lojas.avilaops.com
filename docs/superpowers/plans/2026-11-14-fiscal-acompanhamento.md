# P004 • plano de acompanhamento fiscal

> Execução: skill superpowers:executing-plans, tarefa por tarefa nesta sessão.

**Goal:** tornar XML pendente acionável e mostrar recebimentos registrados.

**Architecture:** coletor NSU único, conciliação por evidência fiscal e relógio
restrito ao fiscal; projeções por tenant/chave sobre documentos e recibos existentes.

**Tech Stack:** TypeScript, Next.js, Prisma/PostgreSQL e GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-14-fiscal-acompanhamento-design.md`.

## Restrições globais

• Testes e builds exclusivamente no GitHub CI; sem documentos reais nos artefatos.
• Sem eventos fiscais automáticos, escrita de estoque de teste real ou ativação global.
• Preservar isolamento, autoridade P003 e intervalo de consulta por CNPJ.
• Textos novos usam • como separador. Preservar dependências, limites e guards de produção da CI.

Ruling de verificação: o disparo manual em branch marcou `PUBLISH=true` e
falhou no guard, após todos os checks funcionais. A expressão de publicação
passa a exigir a branch principal, como os jobs de implantação já exigem;
o guard permanece e o disparo manual valida a branch sem publicar.

## Foco da revisão

• Resultado incerto sem evento completo permanece pendente, sem repetição de envio.
• Evento de outro autor, ambiente, sequência ou chave nunca confirma a intenção.
• Recibo precisa aparecer também quando o resumo e o completo têm NSUs diferentes.
• Cancelamento posterior exige revisão e conserva a entrada auditável.
• Habilitar somente fiscal não executa nenhuma rotina comercial.

## Tarefa 1 • regressões e RED

Arquivos: `src/lib/rotinas-agendador-config.test.ts`,
`tests/integration/fiscal-acompanhamento.test.ts`.

• [ ] Escrever regressões de configuração do relógio, estado por chave e conciliação.
• [ ] Commit/push e PR em rascunho; observar falhas esperadas no CI.

## Tarefa 2 • estado e conciliação

Arquivos: `src/lib/fiscal-acompanhamento.ts`,
`src/lib/fiscal-manifestacao-conciliacao.ts`, `src/lib/fiscal-manifestacao.ts`,
`src/lib/fiscal-loja.ts`, `src/lib/fiscal-entrada.ts`.

Interfaces: `consultarAcompanhamentoFiscal(tenantId, chaves, db?)` retorna mapa
por chave com estado, completoId, manifestação e recibo resumido;
`reconciliarManifestacoesFiscais(db, tenantId)` confirma somente intenções
com evidência completa válida. Usar o mesmo cliente transacional do cursor.

• [ ] Implementar projeções e conciliação; leitura não produz efeitos fiscais.
• [ ] Reutilizar `sincronizarNotas` após aceitação e em atualização explícita.

## Tarefa 3 • sincronização restrita

Arquivos: `src/lib/rotinas-agendador-config.ts`, `src/lib/rotinas-agendador.ts`,
`src/lib/rotinas-executor.ts`, `src/app/api/painel/fiscal/route.ts`.

Interface: `configuracaoAgendador(env)` retorna modo e nomes permitidos;
`executarRotinasDevidas(agora?, nomes?)` cria/reivindica somente a seleção.

• [ ] Acrescentar modo fiscal explícito e expor saúde real no monitor.
• [ ] Documentar ativação independente sem alterar o ambiente de produção.

## Tarefa 4 • interface e jornada

Arquivos: `src/components/painel/Fiscal.tsx`,
`src/components/painel/ConferenciaEntradaFiscal.tsx`, `scripts/qa-fiscal-entry.mts`.

• [ ] Mostrar ciência confirmada, atualização e próximo horário no resumo.
• [ ] Mostrar estado/recibo na lista e atualizar após confirmação.
• [ ] Verificar no navegador CI resumo sem efeitos e entrada sem duplicidade.

## Tarefa 5 • GREEN e entrega

• [ ] CI completo, revisão do diff e correções necessárias.
• [ ] Atualizar registro da equipe, fontes MLOps, evidência e descrição do PR.
• [ ] Manter PR em rascunho para revisão; informar separadamente ativação pendente.
