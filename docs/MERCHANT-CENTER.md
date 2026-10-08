# Google Merchant Center

O que a plataforma entrega sozinha para toda loja, e o que precisa ser feito na
conta do Google de cada loja. Nada aqui é por loja em código: sai de colunas do
`Tenant`.

## O que já sai pronto

| Sinal | De onde vem |
|---|---|
| Catálogo | `/feed/merchant.xml` (`src/lib/catalogo-merchant.ts`), até 10 fotos por oferta |
| Descrição do anúncio | A da página: descrição curta e longa, em texto puro e com parágrafos (`descricaoMerchant`). Antes só a curta saía quando existia |
| Preço por litro (`unit_pricing_measure` + `unit_pricing_base_measure`) | Só quando o cadastro tem `atributos.volumeMl` numérico; base sempre 1 l (`unidadeDePrecoMerchant`) |
| Especificações (`product_detail`) | A ficha técnica visível (`fichaDoProduto`), em pares nome/valor; chave interna (`_*`, `grupoLegado`) não sai |
| Eventos para o GTM | `view_item`, `add_to_cart`, `begin_checkout` e `purchase` entram no `dataLayer` como `{ event, ecommerce }` (formato GA4) quando a loja tem GTM; sem GTM vão por `gtag` (`src/lib/eventos-loja.ts`) |
| Imagem grande na busca | `max-image-preview:large` em toda página indexável (`src/app/layout.tsx`) |
| Política de devolução | `MerchantReturnPolicy` na loja, lida de `regrasDevolucao` (`src/lib/politicas.ts`) |
| Frete grátis | `shippingDetails` e `g:shipping`, só quando o produto sozinho passa do `freteGratisAcima` (`src/lib/envio-declarado.ts`) |
| Pedido mínimo | `Tenant.pedidoMinimoCentavos` (painel, aba Entrega): não aparece na vitrine nem na ficha (espanta quem ainda está olhando); aparece no carrinho (com o que falta e o botão travado), no texto padrão de `/politicas/envio` e no `llms.txt`; o `/api/checkout` recusa abaixo dele (`avaliarPedidoMinimo` em `packages/checkout/src/core/pedido-minimo.ts`). Conta o subtotal de produtos, sem frete e antes do cupom |
| Avaliações do Consumidor | convite no pedido pago e selo opcional (`src/lib/avaliacoes-google.ts`) |

## Quem entra no feed

- **Só loja que vende.** `/feed/merchant.xml` sai vazio enquanto `lojaVende` for
  falso (plano Site, loja não ativa ou sem pagamento conectado). O Merchant exige
  que o produto seja comprado na página de destino; catálogo com pedido por
  telefone ou WhatsApp não é oferta do Shopping.
- **Foto própria, com duas exceções do Google.** Imagem `representativa` ou
  ilustrada bloqueia a oferta (`foto_representativa`), menos quando a prateleira
  Google do produto fica em **Ferragens (632)** ou **Veículos e peças (888)**:
  a especificação de `image_link` aceita ilustração nesses dois ramos, e ali a
  ocorrência vira aviso (`categoriaAceitaIlustracao` em
  `src/lib/google-product-taxonomy.ts`). Fora deles continua erro.

## O que se faz na conta, uma vez por loja

1. **Fonte de dados**: cadastrar `https://<domínio>/feed/merchant.xml`. Sem isso o
   Google só enxerga o que rastreou sozinho (a Brilhax aparecia com 5 produtos e
   1,6 foto por oferta com 79 itens no feed).
2. **Política de devolução**: em Entregas e devoluções, informar prazo e custo
   iguais aos de `/politicas/devolucao`. O padrão da plataforma é 7 dias, grátis.
3. **Frete**: configurar o serviço de envio da conta. O feed não declara preço de
   frete cotado por CEP. Loja com pedido mínimo repete o valor em **"valor mínimo
   do pedido"** do serviço de frete: o feed não leva esse dado, e o Google exige
   que o mínimo informado na conta seja o mesmo que a loja mostra e cobra.
4. **Avaliações do Consumidor**: ativar o programa em Qualidade da loja e gravar
   o ID da conta no painel, em Anúncios.

## Avaliações do Consumidor

- O convite só entra com `googleMerchantId`, pedido pago, canal `loja` e
  `Pedido.fretePrazoDiasUteis` gravado. Pedido anterior a 06/10/2026 não tem o
  prazo e não gera convite.
- A data estimada é a criação do pedido mais `despachoDiasUteis` mais o prazo do
  frete, em dias úteis.
- Convite e selo são scripts do Google: só carregam depois do "aceito" no aviso
  de cookies, e ter o ID gravado já faz a loja mostrar o aviso.
- O selo (`googleSeloAvaliacoes`) é escolha da loja e nasce desligado.
