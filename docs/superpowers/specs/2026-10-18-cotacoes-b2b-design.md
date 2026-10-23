# Cotações B2B — design

## Escopo

Implementar a AVL-234: cotação assistida ou iniciada pelo comprador, negociação
versionada, aprovação por alçada, expiração/cancelamento e conversão idempotente
em pedido.

## Agregado

- `CotacaoB2B` guarda identidade, empresa, unidade, comprador, vendedor,
  centro de custo, pedido de compra, estado, validade e o pedido convertido.
- `VersaoCotacaoB2B` é um snapshot imutável de itens, frete, desconto,
  condições comerciais e totais. Uma contraproposta sempre cria outra versão.
- `EventoCotacaoB2B` é histórico append-only de criação, contraproposta,
  submissão, aprovação, recusa, cancelamento, expiração e conversão.
- `AnexoCotacaoB2B` guarda metadados e URL de um arquivo já armazenado; a URL
  não é interpretada nem buscada pelo servidor.

Toda chave de negócio é composta com `tenantId`. O banco impede mutação de
versões e eventos e impede vínculos entre tenants ou empresas diferentes.

## Estados

`RASCUNHO -> EM_NEGOCIACAO -> AGUARDANDO_APROVACAO -> APROVADA -> CONVERTIDA`.
`RASCUNHO`, `EM_NEGOCIACAO` e `AGUARDANDO_APROVACAO` podem ir para
`CANCELADA` ou `EXPIRADA`; aprovação pode resultar em `RECUSADA`.

Uma contraproposta parte da última versão e não altera a anterior. Submissão
congela a versão corrente. Aprovação exige papel `APROVADOR` ou
`ADMINISTRADOR`, escopo compatível e alçada suficiente. Exceção comercial
exige `ADMINISTRADOR` e justificativa.

## Preço, validade e estoque

Na criação da versão, cada item é validado pelo resolvedor do catálogo B2B e
gravado com produto, variante, nome, SKU, quantidade e preço unitário. A
conversão usa exatamente o snapshot aprovado, sem recalcular preço.

Cotação não reserva estoque. A conversão reserva o saldo pelo mecanismo atual,
na mesma transação lógica de criação do pedido. Falha de saldo não cria pedido
nem marca a cotação como convertida. Cancelamento e expiração, portanto, não
deixam reserva pendurada.

## Conversão e recompra

A conversão aceita chave de idempotência e produz no máximo um `Pedido` por
cotação. O pedido preserva a cotação, versão aprovada, pedido de compra, centro
de custo, preços e condições. Repetições devolvem o mesmo pedido.

Recompra cria nova cotação em rascunho, copia itens e referências da versão
anterior e resolve os preços comerciais vigentes; nunca reutiliza aprovação ou
preço vencido. Pedido assistido usa o mesmo fluxo, mudando apenas o ator.

## Interfaces HTTP

Rotas protegidas por `LOJAS_ADMIN_TOKEN`:

- `GET/POST /api/admin/tenants/:slug/cotacoes-b2b`
- `GET /api/admin/tenants/:slug/cotacoes-b2b/:id`
- `POST .../:id/contrapropostas`
- `POST .../:id/submeter`
- `POST .../:id/aprovar`
- `POST .../:id/cancelar`
- `POST .../:id/converter`
- `POST .../:id/recomprar`

As operações recebem ator explícito porque a credencial administrativa é de
sistema; ator, papel e comprador são auditados.

O painel autenticado expõe criação, consulta, contraproposta, submissão,
cancelamento, conversão e recompra em `/api/painel/cotacoes-b2b`. A conta do
comprador expõe criação, consulta, contraproposta, submissão, aprovação,
recusa, cancelamento e recompra em `/api/conta/cotacoes-b2b`. As duas superfícies
derivam tenant e ator da sessão, sem aceitar essas identidades no corpo.

## Fora deste issue

Tela visual do portal corporativo e armazenamento binário de anexos. Este
módulo entrega domínio, persistência e API completos para esses consumidores.
