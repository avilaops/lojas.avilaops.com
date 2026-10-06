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
| Escopos | Os que o lojista marcar + `vitrine:ler` | Sempre e só `vitrine:ler` |
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
  só no `/api/mcp`. Não é chave desta API.

## Escopos

Escopo novo entra em `ESCOPOS` **junto com a rota que o exige**. Declarar escopo
sem rota faria uma chave criada hoje ganhar poder no deploy em que a rota
chegasse, sem ninguém ter decidido isso.

| Escopo | Libera |
|---|---|
| `loja:ler` | `GET /api/v1/loja` |
| `catalogo:ler` | `GET /api/v1/produtos`, `GET /api/v1/produtos/{id}` |
| `catalogo:escrever` | `PATCH /api/v1/ofertas` |
| `pedidos:ler` | `GET /api/v1/pedidos` |
| `vitrine:ler` | `GET /api/v1/vitrine/loja`, `GET /api/v1/vitrine/produtos` |

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

1. Mais escrita pela chave secreta: criar e editar produto (campos editoriais,
   por `salvarProdutoNoCatalogo`) e `pedidos:escrever` (status e rastreio).
2. Webhooks para o desenvolvedor, saindo do mesmo `emitir` de `eventos.ts`.
3. Carrinho e checkout pela chave publicável, passando por
   `montarPedidoSeguro` + `resolverItensDoCatalogo` (preço nunca do navegador).
4. MCP aceitar a chave secreta nova e aposentar `Tenant.apiKeyEnc`.
5. Página pública de documentação gerada a partir de `GET /api/v1`.
