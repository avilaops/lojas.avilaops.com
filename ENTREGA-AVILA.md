# Entrega — Agente Ávila AVL-236

## Resultado e versão

Incremento implementado e verificado localmente: entradas, saídas e
transferências físicas imediatas por local, com idempotência transacional,
proteção de reservas e razão imutável gerado pelo banco sobre o saldo existente.
A issue completa **não está concluída**.

- Issue: [AVL-236](https://linear.app/avilaops/issue/AVL-236/construir-estoque-multilocal-com-razao-de-movimentacoes).
- Pai consultado: AVL-230. Contrato ERP relacionado consultado: AVL-251.
- Data: 03/11/2026. Ambiente: worktree de desenvolvimento deste lote.
- Branch: `codex/gestor-20261103-urgentes-5-01-avl-236`.
- Base: `45fe4cff9dec3d032f16a8215566044c384cd125`.
- Commit de implementação/testes/contrato/TAP:
  `c4c9f978722a8f54363d47d8af9ac4c2e5f03731`.
- Estes relatórios são registrados em commit local posterior; consultar
  `git log -2 --oneline` para o SHA do registro, sem autorreferência circular.

## Arquivos e contratos

| Arquivo ou grupo | Entrega |
| --- | --- |
| `prisma/migrations/20261103010000_avl236_estoque_multilocal/migration.sql` | Migration aditiva, snapshot inicial, razão/recibos imutáveis e triggers sobre saldo. |
| `prisma/schema.prisma` | Modelos novos `ComandoEstoque` e `RazaoEstoque`; modelos de pagamento/fiscal e tabelas de saldo/reserva existentes preservados. |
| `src/lib/estoque-multilocal-schema.ts` | Contrato estrito Zod de movimento e chave idempotente. |
| `src/lib/estoque-multilocal.ts` | Movimento atômico com trava de produto/locais, recibo, projeção e evento. |
| `src/app/api/v1/estoque/{movimentos,saldos,razao}/route.ts` | POST autenticado e GETs paginados, isolados por tenant. |
| `src/lib/api-chaves.ts` | Escopo explícito novo `estoque:escrever`, sem ampliar chaves anteriores. |
| `src/lib/api-indice.ts` | Descoberta das três rotas no índice existente da API. |
| `src/lib/catalogo-oferta.ts` | Oferta somente do principal, correspondente ao local efetivamente reservado pelo checkout. |
| `src/lib/estoque-multilocal.test.ts` | Validação de entradas e idempotência. |
| `tests/integration/estoque-multilocal.test.ts` | 12 cenários de persistência, concorrência, rollback e HTTP em PostgreSQL real. |
| `tests/sql/avl236-abertura.sql` | Ensaio da migration com saldo preexistente, reserva e remoção. |
| `docs/AVL-236-ESTOQUE-MULTILOCAL.md` | Contrato, autoridade, compatibilidade, riscos e matriz dos critérios de aceite. |
| `evidencias/avl236/{unit,integration}.tap` | TAPs da verificação final aprovada. |

O razão captura também reserva, liberação e alterações de físico dos escritores
legados sem editar seus fluxos. O contexto legado é identificado como tal:
não há atribuição fictícia de autoria/referência comercial. Razão registra
antes/depois; o recibo da nova API identifica o comando e suas duas pernas
quando há transferência.

## Verificações reais

- 22 testes unitários aprovados: contrato novo, chaves e índice da API.
- 22 testes de integração aprovados: 12 novos e 10 de regressão do catálogo.
- Migration aplicada juntamente com as outras 86 migrations numa base nova
  local descartável `avl236_test`, PostgreSQL 18.6.
- Ensaio SQL separado aprovado para snapshot sobre saldo já existente,
  registro de reserva e remoção auditada.
- TypeScript sem erros e ESLint dos arquivos afetados sem erros.
- `git diff --check` aprovado; TAP de integração teve somente espaços finais
  removidos para satisfazer essa verificação. Hash bruto e normalizado estão
  no relatório de evidências.

Comandos, falhas intermediárias, correções e hashes constam de
[EVIDENCIAS-AVILA.md](EVIDENCIAS-AVILA.md). A autorização específica deste lote
permitiu testes locais; build/suítes completas não foram executados.

Não houve push, PR, merge, deploy, escrita no Linear, transação financeira,
operação fiscal ou validação real de ERP/WMS. Não há CI do incremento local.
Consulta de CI da base pelo conector não retornou execuções e não foi tratada
como evidência de aprovação ou falha.

## Preservação e trabalho paralelo

Trabalhei somente nesta worktree e não iniciei outros agentes. AVL-238 cuida de
pagamentos; AVL-240 cuida de fiscal. As worktrees desses agentes e o checkout
original foram consultados somente em leitura para conferir escopos.
Não foram alterados arquivos de pagamentos/fiscal nem
`src/components/painel/Inventario.tsx` do checkout original.

A migration usa identificador exclusivo `avl236`. Os novos modelos ficam em
um bloco isolado do schema compartilhado. Nenhuma colisão de arquivo foi
observada nas consultas das worktrees paralelas. A integração dos commits
deve preservar os hunks de cada agente. Não há dependência de implantação
de AVL-238/AVL-240 para verificar este incremento; a integração ERP real
continua vinculada ao contrato de AVL-251.

O mecanismo de aprovação interrompeu a primeira tentativa de commit por
configuração global inválida; nenhuma ação de Git dessa tentativa foi
executada. Após o gestor informar a correção, a tentativa foi retomada e
o commit local foi criado. Não alterei configuração global nem Hindsight.

## Pendências e estado recomendado

Estado recomendado para AVL-236: **In Progress**. No Linear consultado a issue
continuava em Backlog; não foi modificada por instrução do lote.

Permanecem pendentes:

1. Cadastro/autorização de depósitos e filiais, condições bloqueado,
   quarentena/avariado e estoque em trânsito.
2. Lotes, validade e série conforme configuração do produto.
3. Reservas e alocação multi-origem; checkout continua reservando no principal.
4. Expedição de transferência e recebimento parcial; transferência desta
   entrega pressupõe recebimento físico já conferido.
5. Inventário, aprovação de ajuste, segurança, backorder e promessa.
6. Contrato e fila de divergências ERP/WMS, reconciliação e prova externa real
   com AVL-251; contexto comercial completo dos escritores legados no razão.
7. CI do incremento, revisão e eventuais gates de publicação em outra etapa
   autorizada. Verificar/recalcular projeções de cadastros que já tenham
   múltiplos locais antes de ativar a mudança em qualquer ambiente publicado.

Próximo passo concreto para o gestor: revisar o commit local
`c4c9f978722a8f54363d47d8af9ac4c2e5f03731` e consolidar as evidências na AVL-236,
mantendo a issue em implementação. A próxima parte funcional é cadastro de
depósitos/condições e transferência com trânsito/recebimento parcial sobre o
mesmo saldo e razão, antes de disponibilizar reserva multi-origem.

Status do incremento: **COMPLETED**. Status da issue: **PARTIALLY COMPLETED**.
Confiança no incremento verificado: 94/100; sem aprovação de produção.
