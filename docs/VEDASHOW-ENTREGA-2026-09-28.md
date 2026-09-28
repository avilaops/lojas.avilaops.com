# VedaShow — consistência de estoque, filtros na categoria e imagens fora do ar

Rodada de 28/09/2026, a partir das capturas da vitrine publicada (`1ba1eec`).
As correções de dado (categoria, cadastro repetido, imagem) vivem no
repositório `vedashow.com.br`; aqui fica o que é plataforma.

## 1. Toda imagem da plataforma respondia 500

Achado da auditoria, não das capturas: logo, fotos, ilustrações e ícones de
categoria de **todas** as lojas respondiam `500 Internal Server Error` em
`/uploads/...` — inclusive caminho inválido, que devolve 404 antes de tocar
no disco. Isso só acontece quando o módulo da rota não carrega.

A rota que **serve** o arquivo importava `@/lib/uploads`, que também
**processa** o envio e carrega o removedor de fundo (`sharp` +
`onnxruntime-node`, estáticos). A publicação de 27/09 mexeu justamente no
binding ONNX do pacote (`428d215`). Health e CSS continuaram verdes; o smoke
de publicação, rodado contra `https://vedashow.com.br`, reprova:

```
!!  a foto /uploads/vedashow/logo-vedashow.png devolveu 500: o volume de uploads não está servindo
```

Correção: `src/lib/uploads-caminho.ts` guarda só `UPLOADS_DIR` e
`MIME_POR_EXT`, sem dependência nativa; a rota importa dali. Um teste
(`uploads-caminho.test.ts`) impede que a rota volte a importar o módulo de
processamento. `deploy/deploy.sh` passou a exigir 404 para arquivo inexistente
e 200 para um arquivo real do volume antes de declarar sucesso, e volta para a
versão anterior se falhar.

> O log do container não foi lido (sem acesso SSH nesta sessão). A causa é
> inferida do sintoma — 500 antes de qualquer acesso a disco — e do único
> import pesado da rota. Depois de publicar, conferir `docker logs
> lojas-avilaops` e o smoke contra a loja.

## 2. Uma regra de estado de venda para card, página e busca

`estadoDeVenda` (`src/lib/produto-regras.ts`) devolve, para o mesmo produto,
a linha de disponibilidade e a ação do botão. Precedência: esgotado vence
tudo (sem pedido, sem consulta de preço, só aviso de reposição); sem preço com
saldo, consulta; com preço e saldo, carrinho ou WhatsApp conforme a loja
venda. `esgotado` passou a ser o complemento exato de `emEstoque` (saldo
negativo do ERP era "em estoque" no card e `OutOfStock` no JSON-LD).

O que mudou na tela:

| Onde | Antes | Agora |
|---|---|---|
| Card sem preço e sem saldo (Anel 2138, código 2112) | "Esgotado" + "Consultar preço" | "Esgotado" + "Ver disponibilidade" |
| Página do produto | não dizia se havia saldo | linha "Em estoque" / "Indisponível no momento", a mesma do card |
| Página sem preço e sem saldo | "Consultar preço" | aviso de reposição |
| Sugestão da busca | olhava só `disponibilidade` | mesma regra do card |

Código 4919: na publicação atual o card e a página já concordavam entre si
(205 un., R$ 0,20, pedido pelo WhatsApp). A contradição vista vinha dos
cadastros repetidos 307 e 1445, com o mesmo nome e sem saldo, listados ao lado
("Esgotado" e "Em estoque" para a mesma peça). Ver o item 5.

## 3. Filtros na página da categoria

A categoria só listava e mandava filtrar em `/produtos?categoria=`. Agora a
mesma leitura de URL (`src/lib/filtros-url.ts`) serve as duas rotas: busca,
marca, preço, **só disponíveis**, medidas e ordenação, com contagem do
conjunto filtrado e "Página N de M". Marca agrupa as grafias do ERP ("SKF" e
"Skf", "Ibira" e "Ibirá") numa entrada com contagem, e filtrar por ela traz
todas as grafias.

## 4. Card, página e banner mais compactos

- Card sem foto: faixa de 44 px em vez de um quadrado vazio; material
  cadastrado entra na ficha do card; disponibilidade em destaque.
- Página sem foto: faixa baixa no lugar do quadrado; capa de categoria em uma
  linha no celular.
- Banner da distribuidora: altura pela proporção da arte (8:3 no computador,
  4:5 no celular) com teto de 340 px / 42% da tela.
- WhatsApp flutuante some em qualquer página com card de produto ou ficha de
  produto (que já têm a ação), em qualquer largura; nas demais o rodapé ganha
  folga para nada ficar embaixo dele.

## 5. Cadastro repetido fora da vitrine, sem perder o link

Produto inativo com `atributos.equivalenteA` = SKU de outro leva o endereço
antigo, com 308, ao produto que fica (`slugDoEquivalente`). É o que permite à
VedaShow tirar 307 e 1445 (iguais ao 4919) e 2254 (igual ao 2259) da vitrine
sem apagar o vínculo com o ERP.

## Validação

Réplica local com os 5.587 produtos publicados (categoria, nome, preço,
medidas e marca lidos da vitrine; saldo do ERP), Postgres 16, build de
produção:

- 5.584 cards ativos: disponibilidade, selo e botão conferidos contra o banco
  — 0 divergências; nenhum inativo visível;
- 181 páginas de produto (todas as 51 categorias; com e sem saldo, com e sem
  imagem): linha de estoque, ação e `availability` do JSON-LD — 0 divergências;
- sugestões da busca — 0 divergências;
- 11 combinações de filtro em O-Rings, Retentores, Rolamentos, Gaxetas,
  Alicates e Mancais: contagem e conjunto listado (todas as páginas) iguais ao
  cálculo independente sobre o banco; ordenação por preço conferida;
- `npm test` 430 testes (novos: estado de venda, saldo negativo, filtros da
  URL, grafias de marca, isolamento da rota `/uploads`), `tsc`, `eslint` dos
  arquivos alterados e `next build`.
