# Google Merchant Center

O que a plataforma entrega sozinha para toda loja, e o que precisa ser feito na
conta do Google de cada loja. Nada aqui é por loja em código: sai de colunas do
`Tenant`.

## O que já sai pronto

| Sinal | De onde vem |
|---|---|
| Catálogo | `/feed/merchant.xml` (`src/lib/catalogo-merchant.ts`), até 10 fotos por oferta |
| Imagem grande na busca | `max-image-preview:large` em toda página indexável (`src/app/layout.tsx`) |
| Política de devolução | `MerchantReturnPolicy` na loja, lida de `regrasDevolucao` (`src/lib/politicas.ts`) |
| Frete grátis | `shippingDetails` e `g:shipping`, só quando o produto sozinho passa do `freteGratisAcima` (`src/lib/envio-declarado.ts`) |
| Avaliações do Consumidor | convite no pedido pago e selo opcional (`src/lib/avaliacoes-google.ts`) |

## O que se faz na conta, uma vez por loja

1. **Fonte de dados**: cadastrar `https://<domínio>/feed/merchant.xml`. Sem isso o
   Google só enxerga o que rastreou sozinho (a Brilhax aparecia com 5 produtos e
   1,6 foto por oferta com 79 itens no feed).
2. **Política de devolução**: em Entregas e devoluções, informar prazo e custo
   iguais aos de `/politicas/devolucao`. O padrão da plataforma é 7 dias, grátis.
3. **Frete**: configurar o serviço de envio da conta. O feed não declara preço de
   frete cotado por CEP.
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
