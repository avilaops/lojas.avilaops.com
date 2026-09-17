# Mercado Livre

Integração de canal: a loja publica no ML e o ML devolve as vendas.

## O que existe

| Etapa | Onde | Estado |
|---|---|---|
| Conectar a conta (OAuth, token de 6 h com refresh rotacionado e cifrado) | `src/lib/mercadolivre.ts`, `/ml/callback` | pronto |
| Preparar o catálogo (categoria prevista, atributos exigidos, veredito) | `src/lib/mercadolivre-preparo.ts` | pronto |
| Aprovar produto a produto no painel | `Canais.tsx`, `/api/painel/canais/mercadolivre/anuncios` | pronto |
| Publicar (`/items/validate` antes de `/items`) | `src/lib/mercadolivre-publicacao.ts` | pronto |
| Empurrar preço e estoque para os anúncios | idem, rotina `rodar` | pronto |
| **Sincronizar conteúdo (título, fotos e descrição)** | idem, `conteudoDoAnuncio` | pronto (17/09/2026) |
| **Receber a venda como pedido da loja** | `src/lib/mercadolivre-pedidos.ts` | pronto (17/09/2026) |
| **Processar a fila de notificações** | `src/lib/mercadolivre-avisos.ts`, rotina `avisos` | pronto (17/09/2026) |
| **Perguntas do comprador** | `src/lib/mercadolivre-perguntas.ts`, painel → Canais | pronto (17/09/2026) |
| Mensagens do pós-venda | — | não tratado: o aviso é marcado `IGNORADO` com o motivo |
| Faturamento (nota fiscal), catálogo do ML, Mercado Envios Flex, métricas de reputação | — | não começado |

## A venda voltando

O webhook `/ml/notifications` responde 200 em segundos — o ML desliga a
notificação de quem demora — e só enfileira em `AutomacaoEvento`, com o
envelope inteiro, porque é ele que diz **qual** recurso mudou. Quem age é a
rotina `avisos`, chamada pelo n8n:

1. reivindica o aviso (a linha só sai de `EMITIDO` uma vez, então duas
   execuções simultâneas não baixam o mesmo estoque duas vezes);
2. relê o recurso na API do ML, porque a notificação diz que algo mudou,
   nunca o que mudou;
3. aplica o efeito e fecha o evento como `PROCESSADO`, `IGNORADO` ou
   `FALHOU` com o motivo.

O pedido entra como `Pedido` com `canal = "mercadolivre"` e
`canalPedidoId = order.id`. O par `(tenantId, canal, canalPedidoId)` é único:
é ele que impede a mesma venda de virar dois pedidos quando o ML reenvia o
aviso. Os itens casam com o catálogo pelo `mlbId` do anúncio, e a baixa usa o
mesmo caminho do checkout (`baixarEstoqueDoPedido`), que sabe abater sem
reserva prévia.

A **referência é sorteada** (`crypto.randomUUID()`), como a do checkout
próprio, e não derivada do número da ordem. `/pedido/[referencia]` é página
pública — mostra nome, e-mail, itens, total e rastreio sem pedir sessão —, e o
que separa o comprador de um estranho é a referência ser impossível de
adivinhar. O `order.id` do ML é um número sequencial que o comprador vê e que
se enumera: ele vive em `canalPedidoId`, que nenhuma rota pública alcança.

## O catálogo, depois de publicado

Publicar não é o fim. Até 17/09/2026 só preço e estoque subiam: quem trocava a
foto errada ou corrigia o nome do produto na loja via o anúncio continuar com
o conteúdo do dia em que nasceu. E a **descrição nunca subiu**, porque no ML
ela não vai no corpo do item — é `PUT /items/{id}/description`, endpoint
próprio, e ninguém o chamava.

Agora o ciclo compara uma impressão digital (`conteudoHash`) do título, das
fotos e da descrição. Igual, não faz nada; diferente, reescreve o anúncio.
Preço e estoque ficam de fora dessa impressão de propósito: quem cuida deles é
o outro caminho, que confirma o valor lendo o item de volta.

Duas regras do ML que o código respeita em vez de ignorar:

- **Título de anúncio que já vendeu não muda.** O ML recusa, e isso não é
  falha do lojista: as fotos vão assim mesmo, e o motivo fica escrito no
  anúncio em vez de a atualização inteira falhar. Como a recusa é definitiva,
  a impressão digital é gravada mesmo assim — insistir de hora em hora
  gastaria duas chamadas por ciclo, para sempre, contra uma resposta que não
  muda. A pendência fica só para o que o próximo ciclo pode resolver: uma foto
  que não subiu, uma descrição recusada.
- **Descrição é texto puro.** HTML mandado cru aparece como texto na tela do
  comprador, então sai daqui limpo — inclusive sem o espaço antes da
  pontuação que a limpeza de tags deixava para trás.

## Perguntas

No Mercado Livre quem pergunta costuma estar decidindo naquele minuto, e a
pergunta aparece na página do anúncio para todo mundo ver. Até 17/09/2026 o
aviso `questions` caía na fila e virava `IGNORADO`: o lojista só via a
pergunta se abrisse o app do ML.

Agora ela entra no banco da loja (`PerguntaMercadoLivre`), emite
`canal.pergunta-recebida` — o n8n avisa o lojista — e aparece no painel, em
Configurações → Canais, com a mais antiga no topo e **o tempo desde que
chegou** em vez da data: "há 3 h" cobra o que "17/09 09:12" não cobra.

O prefixo do evento é `canal.` e não `mercadolivre.` de propósito: esse outro
prefixo é da fila de **entrada** que o webhook grava, e um evento de saída com
ele seria reprocessado como se fosse aviso do ML.

### A resposta é validada aqui, antes de ir

O ML recusa resposta com telefone, e-mail, link ou convite para conversar
fora da plataforma — e devolve um erro genérico, que não ensina nada a quem
escreveu. A validação acontece antes da chamada: o lojista lê *"o Mercado
Livre recusa resposta com um telefone"* em vez de *"400 Bad Request"*, e não
gasta a tentativa. O limite de 2.000 caracteres é cobrado no mesmo lugar.

Resposta dada pelo app do ML não é sobrescrita: a pergunta chega com
`ANSWERED` e o painel para de cobrá-la. Quem responde pelo painel fica
registrado — numa loja com operadores, "quem respondeu isso" é a primeira
pergunta quando a resposta sai errada.

## O que a integração não inventa

- **Contato do comprador.** O ML não entrega mais e-mail, telefone e documento
  na ordem. Os campos ficam vazios, e o `pedido.pago` sai com
  `canal: "mercadolivre"` para o n8n não tentar falar por fora com quem
  comprou lá dentro — a conversa com esse comprador acontece no ML. **O fluxo
  do n8n precisa testar esse campo**: sem isso, a confirmação de compra sai
  contra um e-mail vazio e vira automação falhada a cada venda do canal.
  Evento sem `canal` é venda da loja, como sempre foi.
- **Item que não casa com o catálogo.** Entra no pedido (a venda existe) com
  um aviso, e sem baixar estoque de um produto que não é dele.
- **Entrega.** Só `delivered` fecha o pedido como entregue; etiqueta emitida
  não é entrega. E entrega e cancelamento são finais: o aviso de envio chega
  fora de ordem no ML, e um `shipped` atrasado não desfaz um pedido entregue.

## Limites conhecidos

- **Variação do ML.** O preparo publica o produto, não a variação. Se uma
  ordem vier com `variation_id`, o pedido registra o aviso e a baixa usa a
  apresentação padrão do produto. Enquanto não houver mapa de variação, loja
  com muitas apresentações deve conferir antes de separar.
- **Nota fiscal.** O ML exige NF em boa parte das categorias; a plataforma
  ainda não emite. Hoje isso é trabalho do lojista, fora daqui.
- **Frete.** `shipping_cost` vem do pagamento. Quando o comprador usa frete
  grátis bancado pelo ML, o valor chega zerado e o pedido reflete isso.
