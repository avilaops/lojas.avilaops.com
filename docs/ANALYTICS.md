# Análises e inteligência comercial

## Estado da implementação

### Fase 0 - auditoria e contrato

- Pedidos pagos são a fonte confiável para receita histórica.
- Status considerados venda: `PAGO`, `EM_SEPARACAO`, `ENVIADO` e `ENTREGUE`.
- `CANCELADO` e `ESTORNADO` não entram na receita.
- Dinheiro permanece em centavos inteiros.
- O período é interpretado em `America/Sao_Paulo`; o banco continua em UTC.
- A rota autenticada resolve o tenant pela sessão. Nenhuma consulta aceita
  `tenantId` do navegador.
- O contrato first-party v1 está em `src/lib/analytics-contrato.ts`.

### Primeira fatia visível

`/painel/analises` lê pedidos existentes diretamente do Postgres e entrega:

- hoje, 7, 30, 90 dias ou intervalo personalizado na URL;
- comparação com janela anterior de mesmo tamanho;
- receita recebida, pedidos, ticket, compradores e itens;
- composição de receita, desconto e frete;
- série diária e ranking de produtos.

Esta fatia não depende do n8n para abrir. O n8n continua sendo o motor de
processamento e automação fora do request.

## Definições atuais

| Métrica | Definição |
|---|---|
| Receita bruta de itens | `subtotalCentavos + descontoCentavos` dos pedidos considerados venda |
| Descontos | `descontoCentavos` |
| Frete | `freteCentavos` |
| Receita recebida | `totalCentavos` |
| Pedidos pagos | quantidade nos quatro status de venda |
| Ticket médio | receita recebida / pedidos pagos |
| Clientes compradores | e-mails únicos em pedidos pagos; não é conta cadastrada |

Reembolso ainda não é exibido como valor porque o modelo atual informa o
estado `ESTORNADO`, mas não guarda valor e instante confiáveis do reembolso.

## Contrato first-party v1

Entrada do navegador: `eventId`, `version`, `sessionId`, `event`, `timestamp`,
`path`, dimensões derivadas e IDs opcionais. `tenantId` é deliberadamente
proibido: será resolvido pelo host no servidor.

Eventos iniciais: `session_start`, `page_view`, `view_home`, `view_category`,
`search`, `view_item`, `add_to_cart`, `remove_from_cart`, `view_cart`,
`coupon_apply`, `begin_checkout`, `checkout_contact`, `checkout_shipping`,
`checkout_payment`, `order_created`, `payment_approved`, `payment_refused`,
`purchase` e `cart_abandoned`.

Eventos financeiros nunca serão aceitos como verdade a partir do navegador.
Compra e pagamento serão materializados pelo backend a partir do pedido e do
webhook do gateway.

## Fluxo alvo

```text
vitrine -> API first-party -> Postgres bruto
                         -> n8n agrega de forma idempotente
                         -> Postgres agregado -> painel
```

Se o n8n parar, a captação continua. Ao voltar, ele reprocessa uma janela por
chave `tenant + período + dimensão`, usando `upsert`.

## Retenção e LGPD

- sem fingerprint;
- sem IP completo persistido;
- sem user-agent bruto permanente;
- dispositivo armazenado como dimensão derivada;
- referenciador e UTMs limitados ao necessário para atribuição;
- eventos brutos terão retenção definida antes da migração de produção;
- agregados podem permanecer por prazo maior por não identificarem a pessoa.

## n8n auditado em 12/09/2026

Existem cinco fluxos com nome Lojas. O fluxo vivo
`p063mxq8dQijjBDL` concentra onboarding, pedidos, carrinho abandonado,
cobrança, SEO e relatório semanal. Ainda não existe agregador de analytics.
Ele não deve receber os novos ramos antes de os endpoints e a migração estarem
publicados no Lojas.

## Próximas fases

1. Persistência bruta e sessão anônima first-party.
2. Eventos confiáveis do backend para pedido e pagamento.
3. Agregações horárias/diárias idempotentes e reprocessamento.
4. Funil, produtos, categorias e buscas.
5. Aquisição, clientes, abandono e receita recuperada.
6. Insights, alertas, CSV, estados parciais, acessibilidade e QA visual.
7. Deploy da aplicação; depois publicação e teste dos fluxos n8n.
