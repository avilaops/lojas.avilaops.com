# API para desenvolvedores (`/api/v1`)

A loja acessível por código: o lojista (ou o desenvolvedor dele) integra ERP,
PDV e planilha pela chave **secreta**, e monta um site ou app próprio sobre o
catálogo pela chave **publicável**. Esta é a fundação: autenticação, escopos,
contrato de resposta, limite e as primeiras rotas de leitura de cada lado.

`/v1` (sem `/api`) **não** é esta API: é o contrato da plataforma com o plano de
controle (`src/lib/gapp.ts`), e responde só no domínio da plataforma.

## Peças, e onde cada regra mora

| Arquivo | O que decide |
|---|---|
| `src/lib/api-chaves.ts` | Formato da chave, hash, catálogo de escopos, que plano tem qual tipo |
| `src/lib/api-rotas.ts` | `rotaDaApi`: autentica, confere escopo, limita, trata erro, CORS. **Única porta** |
| `src/lib/api-resposta.ts` | Formato de sucesso/erro, códigos de erro, paginação e leitura de filtros |
| `src/lib/api-recursos.ts` | O que cada recurso mostra (projeção explícita, campo a campo) |
| `src/lib/api-limite.ts` | Limite por chave, janela de 1 minuto |
| `src/app/api/v1/**` | As rotas: declaram o escopo e devolvem o corpo, nada mais |
| `src/app/api/painel/chaves` | Criar, listar e revogar chaves no painel (seção "IA e API") |

Rota nova da API **não** autentica, não monta erro e não põe CORS por conta
própria: usa `rotaDaApi({ escopo }, ...)`. É isso que garante que "chave
publicável só lê a vitrine" vale em toda rota, inclusive na que ainda não existe.

## Chaves

| | Secreta `lojas_sk_…` | Publicável `lojas_pk_…` |
|---|---|---|
| Onde mora | Servidor do lojista | Pode ir no JavaScript de site/app |
| Escopos | Os que o lojista marcar + `vitrine:ler` | `vitrine:ler`, e `vitrine:comprar` se o lojista marcar |
| Plano | Loja Pro (mesma regra do MCP) | Qualquer plano |
| CORS | Não (navegador não chama) | `*` nas rotas de vitrine |
| Limite | 120 req/min | 600 req/min (compartilhada por todos os visitantes) |
| Na URL (`?chave=`) | Recusada (vaza em log e Referer) | Aceita |

- O banco guarda **sha256 da chave**, nunca a chave (`ChaveApi.hash`). A chave
  inteira aparece uma vez, na resposta da criação. Diferente do token de
  gateway (`cofre.ts`), que precisamos decifrar, a chave só precisa ser
  reconhecida — dump do banco não devolve chave que funcione.
- Uma loja tem várias chaves (uma por integração, até 20 ativas). Revogar
  marca `revogadaEm` e a API passa a responder `chave_revogada`.
- Plano rebaixado desliga a chave secreta sem revogá-la (`plano_sem_api`);
  voltar ao Loja Pro a religa.
- Loja fora do ar (`PROVISIONANDO`, `CANCELADA`) responde `loja_fora_do_ar`.
  `SUSPENSA` continua respondendo, como a vitrine.
- A chave antiga do MCP (`Tenant.apiKeyEnc`, `lojas_live_…`) continua valendo
  só no `/api/mcp`, e não é mais emitida (08/10/2026). Não é chave desta API.
- A chave secreta com o escopo `mcp:usar` entra também no conector MCP, dentro
  dos outros escopos dela. Os escopos `loja:escrever`, `pedidos:escrever`,
  `clientes:ler`, `promocoes:*` e `analises:ler` só têm efeito lá: não há rota
  de `/api/v1` que os exija. Ver `docs/MCP.md`.

## Escopos

Escopo novo entra em `ESCOPOS` **junto com a rota que o exige**. Declarar escopo
sem rota faria uma chave criada hoje ganhar poder no deploy em que a rota
chegasse, sem ninguém ter decidido isso.

| Escopo | Libera |
|---|---|
| `loja:ler` | `GET /api/v1/loja` |
| `catalogo:ler` | `GET /api/v1/produtos`, `GET /api/v1/produtos/{id}` |
| `catalogo:escrever` | `PATCH /api/v1/ofertas` |
| `produtos:escrever` | `POST /api/v1/produtos`, `PATCH /api/v1/produtos/{id}` |
| `pedidos:ler` | `GET /api/v1/pedidos`, `GET /api/v1/pedidos/{id}` |
| `pedidos:escrever` | `PATCH /api/v1/pedidos/{id}` |
| `vitrine:ler` | `GET /api/v1/vitrine/loja`, `GET /api/v1/vitrine/produtos`, `GET /api/v1/vitrine/produtos/{id}`, `POST /api/v1/vitrine/frete` |
| `vitrine:comprar` | `POST /api/v1/vitrine/cupom`, `POST /api/v1/vitrine/checkout`, `GET /api/v1/vitrine/pedidos/{referencia}` |

`GET /api/v1` (sem chave) devolve esta lista como dado.

## Contrato de resposta

```
200 { "dados": { … } }
200 { "dados": [ … ], "paginacao": { "pagina", "porPagina", "total", "totalPaginas" } }
4xx { "erro": { "codigo": "escopo_insuficiente", "mensagem": "…" }, "requisicao": "<uuid>" }
```

- `codigo` é estável e é o que o cliente compara. Lista em `CODIGOS_DE_ERRO`.
- Toda resposta traz `X-Requisicao-Id`; o 500 loga o erro com esse id e
  devolve só o id.
- Paginação: `?pagina=` (desde 1) e `?porPagina=` (1–100, padrão 50). Fora da
  faixa é `parametro_invalido`, não correção silenciosa.
- Filtro com valor desconhecido (`status=pago`, `ativo=sim`) é
  `parametro_invalido`.
- Dinheiro em centavos inteiros (`*Centavos`), moeda BRL.
- Cabeçalhos `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`; no 429,
  `Retry-After`.

## As duas visões do produto

- **Secreta** (`produtoDaApi`): o cadastro do painel, com estoque, SKU, GTIN,
  inativos e variações.
- **Publicável** (`produtoDaVitrine`): o que a página do produto já mostra.
  Sem contagem de estoque (só `ultimasUnidades`), preço sob consulta sai
  `null` (não zero), e a ação de venda já vem resolvida em `venda.acao` —
  inclusive `somente-na-loja` para medicamento de controle especial (RDC
  44/2009). Front feito por terceiro não precisa conhecer a regra da farmácia
  para não oferecer o botão. A listagem é a mesma consulta da vitrine
  (`paginaDeProdutos`).

## Preço e estoque pelo ERP (`PATCH /api/v1/ofertas`)

```
PATCH /api/v1/ofertas
{ "itens": [ { "sku": "6205-2RS", "precoCentavos": 2990, "precoDeCentavos": 3490, "estoque": 14 } ] }
```

- Por **SKU**, que é a chave que o ERP conhece. Vale para o produto simples
  (a apresentação única) e para cada variação da grade.
- Até 100 itens por chamada. Cada item é aplicado sozinho por
  `ajustarOfertaNoCatalogo` (`catalogo-escrita.ts`): a mesma trava, histórico
  e evento do painel. Um item recusado não desfaz os outros; a resposta traz
  `situacao` por item (`atualizado`, `sem_mudanca`, `erro`) e os totais.
- Valores **absolutos** ("estoque 14", não "mais 2"): reenviar o mesmo lote
  depois de uma queda de rede não muda nada, por isso a rota não precisa de
  `Idempotency-Key`. Item igual ao gravado volta `sem_mudanca` e não cria
  versão no histórico — o ERP pode mandar o catálogo inteiro a cada passada.
- `estoque` é o saldo **físico**. O que a leitura devolve é o disponível
  (físico menos reservado por pedidos em andamento). Saldo abaixo do reservado
  é recusado com `recusado`. `null` = a loja não controla estoque daquele SKU.
- Se o cadastro trocar o SKU de uma variação enquanto o lote é gravado, o
  item volta `erro` com código `conflito` e nada é alterado: o preço do SKU
  antigo nunca é aplicado à apresentação que ganhou outro SKU. Basta reenviar.
- Lote mal formado é recusado inteiro (400) antes de gravar: SKU repetido no
  mesmo lote, centavos com vírgula e **campo desconhecido** — `preco: 49.9` em
  reais, ignorado em silêncio, seria o ERP achando que atualizou o preço.
- O histórico do produto grava `origem = api:<id da chave>`: o lojista que vê
  um preço mudar sozinho sabe qual integração mexeu.

## Cadastro de produto (`POST /api/v1/produtos`, `PATCH /api/v1/produtos/{id}`)

A escrita é a do painel (`salvarProdutoNoCatalogo`); o contrato de entrada e a
tradução dos erros ficam em `src/lib/api-produtos.ts`.

- **Escopo próprio, `produtos:escrever`.** Não é `catalogo:escrever`: a chave
  que o lojista criou para o ERP acertar preço e estoque não pode amanhecer
  podendo criar produto.
- **Produto criado nasce inativo**, a menos que venha `ativo: true`. A foto
  entra pelo painel, e produto sem foto na vitrine é o que o lojista descobre
  pelo cliente.
- **Sem imagem pela API.** Aceitar URL de fora poria na vitrine de um cliente
  uma imagem que a loja não controla.
- **Edição não mexe em preço nem estoque.** Isso é de `/ofertas`. Dois caminhos
  para o mesmo número é como o ERP e o cadastro passam a brigar.
- **`categoria` é o slug de uma categoria que já existe.** A API não cria
  categoria: erro de digitação viraria categoria nova na vitrine.
- Slug ou SKU já em uso responde `conflito` (409). Reenviar o mesmo cadastro
  depois de um erro de rede não cria um segundo produto.
- Só produto simples. Variações continuam sendo cadastradas pelo painel.

## Pedido (`GET` e `PATCH /api/v1/pedidos/{id}`)

`{id}` aceita o id ou a referência. O `PATCH` avança o pedido: `status`
(`EM_SEPARACAO`, `ENVIADO`, `ENTREGUE`, `CANCELADO`) e `rastreio`.

- É a mesma função do painel e do conector MCP (`mudarStatusDoPedido`,
  `src/lib/pedidos-status.ts`): mesma regra, mesmo aviso ao comprador.
- O aviso sai **uma vez por virada**, mesmo com duas integrações marcando
  "enviado" ao mesmo tempo. A resposta traz `mudou: false` quando o pedido já
  estava naquele status.
- Pedido que não foi pago só pode ser cancelado (`conflito`, 409, nos outros).
- **Pagamento não muda por aqui.** `PAGO` e `ESTORNADO` vêm do gateway.

## Compra pela chave publicável

O site ou o app do lojista fecha a compra com a chave `lojas_pk_`. Glue em
`src/lib/api-checkout.ts`; quem cobra é `criarCobranca`
(`src/lib/checkout-cobranca.ts`), a mesma função do checkout da loja.

O fluxo de um front próprio:

1. `GET /vitrine/loja`: meios de pagamento, a chave pública do Mercado Pago
   (para tokenizar cartão no navegador), pedido mínimo, retirada.
2. `GET /vitrine/produtos` e `/vitrine/produtos/{id}`: catálogo e variações. O
   `id` da variação é o que vai no carrinho.
3. `POST /vitrine/frete`: opções para o CEP e o carrinho.
   `POST /vitrine/cupom`, se a loja usa cupom: o desconto para mostrar.
4. `POST /vitrine/checkout`: cria o pedido e a cobrança. Devolve `referencia`
   e o Pix, o boleto ou o resultado do cartão.
5. `GET /vitrine/pedidos/{referencia}`: o andamento, para a tela do Pix.

Regras:

- **Vender é opt-in por chave.** O escopo `vitrine:comprar` só existe na chave
  em que o lojista marcou "permitir compra". Chave publicável criada antes
  continua só lendo a vitrine: é a regra de escopo que não ganha poder em
  silêncio.
- **Origens.** A chave guarda os sites de onde pode comprar
  (`ChaveApi.origens`). Requisição com `Origin` fora da lista responde
  `origem_nao_permitida`; a resposta só é legível pela origem conferida.
  Requisição **sem** `Origin` (app nativo, servidor) passa: a lista impede
  outro site de usar a chave pelo navegador de um visitante, não impede
  script, e não finge que impede.
- **Limite por endereço**, por minuto, além do da chave: 6 compras e 30
  cotações. A chave é compartilhada por todos os visitantes, e cada compra
  cria reserva de estoque e cobrança de verdade. O endereço fica um minuto na
  memória do limitador e em mais lugar nenhum.
- **A referência nasce no servidor** (128 bits). É o segredo da página do
  pedido e a chave de idempotência no gateway.
- **`Idempotency-Key`** (16 a 120 caracteres): repetir a requisição devolve a
  mesma cobrança, com `repetida: true`, sem cobrar de novo.
- **Preço e frete saem do servidor.** O corpo é estrito: `preco`, `referencia`
  ou qualquer campo desconhecido é erro. `totalCentavos` é opcional e só serve
  para recusar a compra se o front mostrou outro valor.
- **Cupom tem uma recusa só.** `POST /api/v1/vitrine/cupom` (`codigo`, `itens`
  e, para frete grátis, `cep`) devolve `codigo`, `tipo` e `descontoCentavos`;
  a compra aceita `cupom`. Não existir, ter vencido, esgotado ou faltar mínimo
  dão a mesma resposta: `pedido_invalido` com `detalhe: cupom_invalido`. Na
  compra, cupom que não vale **recusa o pedido**, não cobra sem desconto.
- **Erro de cupom conta.** 5 por endereço e 100 por chave a cada 10 minutos,
  somando a rota de cupom e a compra; depois disso é `limite_excedido` (429)
  até a janela virar, mesmo para cupom certo. Cupom certo não gasta tentativa.
  O teto por chave existe porque endereço se troca; o preço é que alguém pode
  deixar o site do lojista sem cupom por dez minutos (`src/lib/api-cupom.ts`).
- **Sem carrinho abandonado**: por chave pública seria um jeito de mandar
  e-mail e WhatsApp a terceiros.
- **O status não traz dado pessoal.** Quem tem a referência é quem digitou os
  dados.
- Loja suspensa ou sem recebimento responde `loja_nao_vende`: a chave ainda
  autentica, porque a vitrine continua no ar.

Erros próprios: `pedido_invalido` (422, com `detalhe`: `item_indisponivel`,
`frete_invalido`, `total_divergente`, `meio_indisponivel`…), `gateway_recusou`
(502, nada foi cobrado), `pagamento_a_confirmar` (503, com a referência em
`detalhe`: consulte o pedido antes de tentar de novo).

## Webhooks

O lojista cadastra no painel (IA e API) o endereço do sistema dele e escolhe os
eventos de pedido. Regras em `src/lib/webhooks-api.ts`, fila e envio em
`src/lib/webhooks-entrega.ts`.

- **Lista fechada de eventos**, só de pedido (`EVENTOS_DE_WEBHOOK`). Evento
  interno (mensalidade, SEO, alerta) não é contrato com ninguém.
- **O corpo é a projeção da API**: `{ id, tipo, criadoEm, dados: { pedido } }`,
  com o mesmo `pedido` de `GET /api/v1/pedidos/{id}`. Nada do envelope interno
  do evento, que carrega contato do lojista.
- **Enfileira junto do evento, envia depois.** `emitir` grava a entrega; a
  rotina `webhooks.entregar` (de minuto em minuto) envia. O checkout não espera
  o servidor de ninguém.
- **Pelo menos uma vez.** A chave (`webhookId`, `eventId`) impede o mesmo fato
  de entrar duas vezes na fila, e cada entrega é reivindicada antes do envio;
  ainda assim o receptor pode ver o mesmo `id` de novo e tem de reconhecer.
- **Assinatura**: `x-lojas-assinatura: t=<segundos>,v1=<hmac>`, HMAC-SHA256 de
  `<t>.<corpo>` com o segredo do webhook. O segredo fica **cifrado** (não em
  hash: é preciso o valor para assinar) e aparece uma vez, na criação.
- **O endereço é do lojista e quem requisita somos nós.** Só `https`, em domínio
  público, sem usuário e senha, sem IP escrito. Na hora do envio o nome é
  resolvido de novo e recusado se apontar para rede interna, e redirecionamento
  não é seguido. Sem isso o campo serviria para alcançar o que está atrás do
  nosso firewall.
- **Novas tentativas**: 7 ao todo, com esperas de 1, 5, 30, 120, 480 e 960
  minutos. Vinte entregas esgotadas em sequência desligam o webhook; o painel
  mostra o motivo e o lojista religa.
- Entrega encerrada some em 30 dias. Recurso do Loja Pro, até 5 por loja.

Limite conhecido: entre resolver o nome e conectar há uma janela em que o DNS
pode mudar. Fechar isso exige conectar pelo IP conferido, e não foi feito.

## Limite em memória

O limitador conta na memória do processo: a plataforma roda num container só.
Com mais de uma réplica, o limite efetivo vira N vezes o declarado; aí a
contagem muda de lugar (Postgres ou Redis) sem mudar o contrato.

## Provas

- `src/lib/api-chaves.test.ts` (entra no `npm test`): formato, escopos, plano,
  paginação, limitador e a projeção da vitrine.
- `tests/integration/api-v1.test.ts` (`npm run test:integracao`): as rotas de
  verdade contra o Postgres 18 — revogação, escopo, rebaixamento de plano e
  isolamento entre lojas.

## Próximos passos (fora desta fundação)

1. ~~Mais escrita pela chave secreta~~ feito em 08/10/2026: criar e editar
   produto (`produtos:escrever`) e avançar pedido (`pedidos:escrever`). Falta
   variação e imagem pela API.
2. ~~Webhooks para o desenvolvedor~~ feito em 08/10/2026 (seção "Webhooks").
   Falta reenviar uma entrega à mão pelo painel e eventos de catálogo.
3. ~~Carrinho e checkout pela chave publicável~~ feito em 08/10/2026 (seção
   "Compra pela chave publicável"), e o cupom em seguida, com resposta única e
   limite de erros.
4. ~~MCP aceitar a chave secreta nova~~ feito em 08/10/2026 (`mcp:usar`). Falta
   apagar `Tenant.apiKeyEnc` quando as lojas com chave antiga migrarem.
5. ~~Página pública de documentação~~ feito em 08/10/2026: `/developers` e
   `GET /api/v1` saem do mesmo dado (`src/lib/api-indice.ts`), e o teste
   `api-indice.test.ts` recusa rota fora do índice ou com escopo diferente.
