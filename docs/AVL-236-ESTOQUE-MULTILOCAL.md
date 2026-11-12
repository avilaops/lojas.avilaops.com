# AVL-236 — Estoque multilocal e razão de alterações

Issue: [AVL-236](https://linear.app/avilaops/issue/AVL-236/construir-estoque-multilocal-com-razao-de-movimentacoes).
Ambiente desta entrega: worktree de desenvolvimento; publicação não autorizada.

## Retomada em 12/11/2026

A entrega de 03/11 foi recuperada dos artefatos preservados e conferida contra
o recibo SHA-256 original. Os relatórios `ENTREGA-AVILA.md`, `EVIDENCIAS-AVILA.md`
e os TAPs de `evidencias/avl236` descrevem exclusivamente aquela execução.
Eles não comprovam a versão integrada à base atual.

A retomada está na branch `feat/avl-236-estoque-multilocal`, com plano em
`docs/superpowers/plans/2026-11-12-avl236-retomada.md`. A regressão de oferta
foi reproduzida na CI 43277562248: cinco dos sete casos falharam por estoque
remoto sendo anunciado no checkout que reserva apenas no principal.
Também foi adicionada regressão de reposição após uma zeragem pelo escritor
legado. A CI 43278584323 confirmou as duas falhas de reposição antes da correção:
entrada e transferência recebida tinham saldo, mas a oferta continuava
indisponível. A correção alinha a disponibilidade do principal ao saldo físico,
preservando `backorder` e sem alterar disponibilidade ao movimentar apenas
outros locais. O contrato rápido passou nos sete casos na CI 43278584311.
Um teste concorrente real confirmou HTTP 500 quando a exclusão de produto
vence a disputa pela trava (CI 43279591558). Essa condição agora é traduzida
para `nao_encontrado`/404, com rollback e sem recibo; falhas desconhecidas
continuam seguindo o tratamento de erro interno existente.
As novas evidências serão vinculadas ao commit e ao PR em rascunho;
não houve validação ou ativação em produção.

## Autoridade e compatibilidade

`SaldoEstoque` continua sendo a fonte de físico/reservado por tenant, variante
e local. `MovimentoEstoque`, `ReservaEstoque` e `TentativaCatalogo` permanecem
compatíveis com os consumidores atuais. Não há baixa de pagamento nova.

`RazaoEstoque` registra snapshots antes/depois de cada criação, alteração
efetiva e remoção de saldo. O trigger cobre também escritores existentes:
cadastro, API de ofertas, reservas, liberações e baixa de pedido. A operação
que altera simultaneamente físico e reservado produz um único registro com
ambas as diferenças. O tipo `FISICO` não afirma, sozinho, que houve venda.

Os registros novos da API têm `comandoId`, origem `api:<id da chave>` e motivo.
O recibo imutável em `ComandoEstoque` contém o movimento normalizado e o saldo
resultante. Escritores antigos recebem origem explícita `catalogo:legado`:
este incremento não inventa autor, referência de reserva ou motivo comercial
que esses escritores ainda não fornecem. `MovimentoEstoque` continua contendo
as referências de pedido já registradas pelo fluxo atual.

A migração instala uma abertura para cada saldo existente. Ela representa
somente o snapshot no momento da instalação, sem reconstruir o passado.
O lock de instalação impede intervalo entre snapshot e início da captura.
Razão e recibos rejeitam `UPDATE`, `DELETE` e `TRUNCATE`; saldo rejeita
`TRUNCATE` e mudança de identidade. Exclusão de saldo é auditada. Não há FK
com cascata apagando o razão quando um cadastro é removido. Administrador do
banco ainda pode alterar DDL/triggers: isso exige controles operacionais fora
do escopo deste incremento.

Até existir alocação multi-origem no checkout, somente `principal` participa
da oferta vendável. A versão anterior somava todos os locais, apesar de
reservar apenas em `principal`. Estoque remoto fica consultável e pode ser
transferido fisicamente antes da venda; não constitui promessa automática.
Não há importação automática ou alteração em massa de projeções na migração.
Cadastros que já tenham locais adicionais precisam de recálculo controlado
da projeção antes de uma futura ativação; as novas operações já recalculam.

## API v1

Todas as rotas usam `rotaDaApi`: tenant da chave, plano, revogação, escopos,
limite por chave, `Cache-Control: no-store` e `X-Requisicao-Id` existentes.
São rotas de servidor; não habilitam CORS para uso de segredo no navegador.

| Método e caminho | Escopo | Contrato |
| --- | --- | --- |
| `GET /api/v1/estoque/saldos` | `catalogo:ler` | Lista físico, reservado e disponível por local. Filtros `varianteId`, `local`. |
| `GET /api/v1/estoque/razao` | `catalogo:ler` | Lista snapshots. Filtros `varianteId`, `local`, `comandoId`. |
| `POST /api/v1/estoque/movimentos` | `estoque:escrever` | Entrada, saída ou transferência imediata. |

Leituras usam `{ dados: [], paginacao: { pagina, porPagina, total,
totalPaginas } }`. `pagina` começa em 1; `porPagina` padrão 50, máximo 100.
Razão é ordenado por sequência crescente; `sequencia` sai como string decimal
para preservar a precisão do BIGINT. Sequências podem ter lacunas de rollback
e não representam ordem de commit entre produtos diferentes. Paginação por
offset não é um snapshot de exportação entre requisições.

Escrita exige `Idempotency-Key` de 1–120 caracteres em `[A-Za-z0-9:._-]`.
A chave é por tenant, sem expiração automática. Mesmo corpo normalizado
retorna o mesmo recibo, inclusive em chamadas concorrentes; chave reutilizada
com outro corpo retorna 409. Falha reverte tudo e permite repetir a chave.
O hash é do contrato validado, não da ordem das propriedades JSON.

Exemplo de transferência cuja entrega física já ocorreu:

```json
{
  "tipo": "transferencia",
  "varianteId": "identificador-da-variante",
  "local": "filial-01",
  "destino": "principal",
  "quantidade": 3,
  "motivo": "Recebimento físico conferido"
}
```

`tipo` aceita `entrada`, `saida`, `transferencia`. `destino` é obrigatório
somente para transferência e precisa diferir de `local`. Locais são códigos
em minúsculas, de 1–80 caracteres `[a-z0-9][a-z0-9_-]*`. São endereços lógicos,
sem cadastro/validação de filial ou depósito neste incremento. Local ausente
é criado com saldo controlado zero na mesma transação; falha reverte a criação.

`quantidade` é inteira entre 1 e 10 milhões; o saldo resultante respeita o
limite de Prisma Int. `motivo` tem 3–240 caracteres; não incluir informações
pessoais ou credenciais. Campos desconhecidos, inclusive `tenantId`, são erro.
Saldo físico nulo continua representando estoque não controlado: a API recusa
movimentá-lo em vez de transformá-lo silenciosamente em zero.

Sucesso: `{ dados: { comandoId, varianteId, movimento, saldos } }`, com
`saldos` contendo `local`, `fisico`, `reservado`, `disponivel`. É um recibo da
operação, não uma consulta ao saldo atual em replays. Códigos de erro:

| HTTP | Código | Motivo |
| --- | --- | --- |
| 400 | `parametro_invalido` | JSON, corpo, quantidade, paginação ou chave inválidos. |
| 401/403/429 | Contrato da API existente | Autenticação, plano, escopo ou limite. |
| 404 | `nao_encontrado` | Variante não pertence ao tenant. |
| 409 | `conflito` | Falta de disponível, saldo não controlado, variante inativa, overflow ou replay divergente. |

O novo escopo não é concedido automaticamente a chaves anteriores de
`catalogo:escrever`; chave publicável não o recebe. Limpeza de cache é posterior
ao commit e não transforma uma escrita confirmada em falso erro/repetição.

## Concorrência e verificação

A API serializa a chave com advisory lock transacional e depois usa a mesma
trava de produto do catálogo/checkout. Os locais são travados em ordem estável,
com releitura após `FOR UPDATE`. Saída/transferência somente usa físico menos
reservado. Destino, origem, razão, projeção, evento e recibo confirmam ou
revertem juntos. Não se bloqueia produto adicional nem se chama serviço externo.

Fontes do módulo: `estoque-multilocal-schema.ts`, `estoque-multilocal.ts`,
rotas de estoque, migration `20261103010000_avl236_estoque_multilocal` e modelos
`ComandoEstoque`/`RazaoEstoque`. Verificação automatizada:

- `src/lib/estoque-multilocal.test.ts`: validação de contrato e idempotência.
- `tests/integration/estoque-multilocal.test.ts`: PostgreSQL real, disputa pela
  última unidade, reserva versus saída, replay concorrente, rollback de duas
  pernas, isolamento entre lojas, escopos HTTP e proteção de imutabilidade.
- `tests/integration/catalogo.test.ts`: regressão dos escritores existentes.

Os testes novos são descobertos pelos scripts atuais `test` e
`test:integracao`. Resultados reais desta execução e vínculo com commit estão
nos relatórios `ENTREGA-AVILA.md` e `EVIDENCIAS-AVILA.md`. Não há observação
registrada no Experiments nem prova de staging/produção nesta entrega.

Referência de triggers: [documentação oficial PostgreSQL](https://www.postgresql.org/docs/18/plpgsql-trigger.html).
Uso de transações segue a API Prisma 6 já empregada por `catalogo-escrita.ts`
e `catalogo-reservas.ts`, sem atualização de biblioteca.

## Critérios da issue e continuidade

| Critério | Estado após este incremento |
| --- | --- |
| Físico, disponível, reservado por local | Implementados. Filial/depósito são apenas códigos lógicos. |
| Trânsito, bloqueado, quarentena, avariado | Ausentes; não são simulados por saldos vendáveis. |
| Razão imutável | Captura de snapshots implementada; contexto de escritores legados permanece parcial. |
| Lotes, validade, série | Ausentes; exigem dimensões de rastreabilidade e regras por variante. |
| Reserva concorrente | Checkout principal existente preservado e testado contra saída nova; reserva multi-origem ausente. |
| Transferência | Imediata implementada. Expedição, trânsito e recebimento parcial ausentes. |
| Inventário e aprovação de ajuste | Ausentes; nenhuma API nova de contagem/ajuste sem aprovação. |
| Segurança, backorder, promessa | Ausentes; não há promessa automática sobre locais remotos. |
| API ERP/WMS | Endpoints entregues; integração real e fila de divergências com ERP AVL-251 pendentes. |
| CI e operação | CI do novo commit não executada; sem push, PR, deploy ou operação real. |

AVL-251 exige que divergências entrem em fila e não escolham vencedor
silenciosamente. As novas rotas não implementam sincronização absoluta externa
nem declaram ERP/WMS reconciliado. A API legada de ofertas permanece com seu
contrato atual de saldo absoluto do principal. A issue deve permanecer
`In Progress` até os demais critérios e as evidências globais serem satisfeitos.
