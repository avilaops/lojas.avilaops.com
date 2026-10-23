# Funil de catálogo e compra — desenho

## Objetivo

Entregar a AVL-264 dentro do projeto Lojas: medir descoberta, intenção e compra da
vitrine Vedashow com nomenclatura estável, consentimento respeitado, testes e um
dashboard inicial no painel.

## Decisões

- A fonte canônica do funil é `SessaoVitrine`, sempre isolada por `tenantId`.
- O navegador envia somente o nome do evento e identificadores técnicos já
  públicos. O servidor resolve tenant e sessão por host e cookie HttpOnly.
- Não são persistidos IP, user-agent, termo pesquisado, e-mail, telefone ou
  conteúdo da mensagem. Sem consentimento, a sessão continua mensurável, mas
  não é ligada a visitas futuras. O cookie de visitante só existe com aceite.
- O funil usa sessões únicas, não quantidade de cliques. Repetir uma ação na
  mesma sessão não infla a conversão.
- Pagamento e recompra vêm de `Pedido`, a fonte comercial canônica. Um evento
  do navegador jamais declara pagamento aprovado.
- O dashboard fica em `/painel/analises/funil`, reutiliza o período das análises
  e explicita denominadores e limitações.

## Nomenclatura v1

| Evento | Fato medido | Fonte |
| --- | --- | --- |
| `search` | sessão executou busca textual | vitrine |
| `search_no_results` | busca textual retornou zero produtos | vitrine |
| `filter_apply` | sessão aplicou filtro de catálogo | vitrine |
| `view_item` | sessão abriu uma ficha de produto | vitrine |
| `technical_contact` | sessão abriu contato técnico/WhatsApp | vitrine |
| `add_to_cart` | sessão adicionou produto ao carrinho | vitrine |
| `view_cart` | sessão abriu carrinho com itens | vitrine |
| `begin_checkout` | sessão abriu checkout com itens | vitrine |
| `purchase` | pedido pago vinculado à sessão | servidor/pedido |
| `repeat_purchase` | cliente com compra paga anterior comprou novamente | servidor/pedido |

## Métricas

- Conversão de produto: sessões com `view_item` / sessões.
- Conversão de carrinho: sessões com `add_to_cart` / sessões com `view_item`.
- Conversão de checkout: sessões com `begin_checkout` / sessões com `add_to_cart`.
- Conversão de compra: sessões com pedido pago / sessões.
- Busca sem resultado: sessões com `search_no_results` / sessões com `search`.
- Contato técnico: sessões com `technical_contact` / sessões com `view_item`.
- Recompra: clientes que compraram no período e tinham compra paga anterior /
  clientes compradores no período.

Taxas sem denominador são exibidas como indisponíveis, nunca como zero.

## Falhas e limites

- Bloqueio de cookies, robôs e rede podem reduzir sessões medidas.
- Pedidos externos ou legados sem `sessaoId` entram na receita, mas não no
  funil de sessão.
- Recompra usa e-mail normalizado apenas no servidor; o dashboard recebe
  somente contagens agregadas.
- Falha de medição é silenciosa na vitrine e nunca bloqueia compra ou contato.

