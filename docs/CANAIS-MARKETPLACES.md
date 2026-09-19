# Canais de venda: auditoria e o que o lojista preenche

Auditoria de 19/09/2026 da integração com marketplaces, e o desenho da tela em
Configurações → Canais que saiu dela.

A conclusão curta: **a integração com o Mercado Livre estava tecnicamente
pronta e comercialmente cega.** Publicava, sincronizava, recebia a venda e
respondia pergunta — mas anunciava pelo preço da própria loja num canal que
cobra de 11% a 19% sobre a venda, e escondia do lojista exatamente os produtos
que dependiam dele para subir. As duas coisas eram invisíveis: a primeira só
aparece no extrato, a segunda não aparecia em lugar nenhum.

## Como funciona, ponta a ponta

```
lojista autoriza (OAuth)            → Tenant.mlAccessTokenEnc / mlRefreshTokenEnc
      ↓
preparo do catálogo                 → AnuncioMercadoLivre.preparo + preparoEstado
  nome enriquecido
  → preditor de categoria do ML
  → conferência por palavra
  → atributos exigidos pela categoria
  → PRONTO | REVISAO | BLOQUEADO
      ↓
lojista autoriza produto a produto  → estado = "aprovado"
      ↓
rotina do n8n (`/api/admin/canais/mercadolivre/rodar`)
  /items/validate → /items → PUT /items/{id}/description
  sincroniza preço, estoque e conteúdo
  lê a reputação da conta
      ↓
venda volta (`/ml/notifications` → fila → rotina `avisos`)
  → Pedido com canal = "mercadolivre"
```

Quatro decisões de arquitetura que a auditoria confirma como certas e que a
tela agora respeita em vez de contornar:

1. **Nada é inventado.** Marca, GTIN, modelo e material só entram se estiverem
   no cadastro (`NAO_INFERIVEIS` em `mercadolivre-preparo.ts`). Atributo
   chutado é reclamação do comprador e reputação do lojista.
2. **A aprovação é humana.** A rotina só publica o que passou pela porta do
   painel. Nenhum catálogo sobe inteiro sozinho.
3. **O preparo é opinião do canal, não fato do produto.** Mora em
   `AnuncioMercadoLivre`, nunca em `Produto`: a mesma peça pode estar pronta
   para o Mercado Livre e bloqueada na Amazon.
4. **A conta é do lojista.** O dinheiro nunca passa pela Avila Ops, e
   desconectar não derruba anúncio nenhum.

## O que a auditoria encontrou

| # | Achado | Gravidade | Estado |
|---|---|---|---|
| 1 | O anúncio saía pelo **preço da loja**, sem acréscimo. Com comissão de 14%, o lojista recebia R$ 86 por uma venda de R$ 100 que na loja dele renderia R$ 100 | crítico: vende com prejuízo silencioso | resolvido |
| 2 | O anúncio levava o **estoque inteiro**. A loja e o canal vendiam a mesma última peça, e a sincronia leva minutos | alto: venda dupla e cancelamento, que derruba reputação | resolvido |
| 3 | A tela só listava produtos **PRONTO**. Quem tinha 180 de 200 travados lia "nenhum produto anunciado ainda" e não tinha como saber por quê | alto: o lojista não consegue destravar o próprio catálogo | resolvido |
| 4 | O preparo só rodava na rotina do n8n. Quem corrigia trinta marcas não via o resultado até a hora seguinte | médio: quebra o ciclo de aprendizado do lojista | resolvido |
| 5 | `listing_type_id`, `condition` e a **garantia** eram fixos no código. Sem `sale_terms`, o ML recusa o anúncio em boa parte das categorias | médio: recusa sem explicação para o lojista | resolvido |
| 6 | `ML_APP_ID` / `ML_APP_SECRET` usados no código e **ausentes do `.env.example`**. Sem eles, o botão "Conectar" levava a uma tela de erro do próprio ML | médio: parece defeito da loja do cliente | resolvido |
| 7 | "Outros canais" era lista morta de quatro nomes com "ainda não" ao lado | baixo: não informa nada | resolvido |
| 8 | A pendência diz "escolha a categoria à mão", e **não existe tela para isso** | médio: promessa que o produto não cumpre | aberto, ver abaixo |
| 9 | O preparo publica o produto, não a **variação**. Ordem com `variation_id` baixa a apresentação padrão | médio | aberto, já documentado em `MERCADO-LIVRE.md` |
| 10 | **Nota fiscal**: o ML exige na maioria das categorias e a plataforma não emite | alto para o lojista, fora do escopo de hoje | aberto |

## O que o lojista preenche, e por quê

Três camadas, e a distinção importa: a primeira é decisão comercial dele, a
segunda é dado do produto que ninguém pode deduzir, a terceira é da plataforma.

### 1. Regras do canal (uma vez, vale para tudo)

Ficam em `Tenant.canais` (JSON por canal) e são lidas por
`lerRegrasDoCanal` em `src/lib/canais.ts`. O padrão de cada campo é
exatamente o que a integração fazia antes de o campo existir: **quem não abrir
a tela não vê nada mudar sozinho.**

| Campo | Padrão | Por que existe |
|---|---|---|
| **Acréscimo sobre o preço da loja** | 0% | O erro mais caro do canal. A tela sugere a conta certa: com 14% de comissão, o acréscimo é **16,3%**, não 14% — a comissão incide sobre o preço já acrescido. E mostra quanto sobra de R$ 100 |
| **Arredondamento** | nenhum | ,90 ou real inteiro. **Sempre para cima**: arredondar para baixo venderia abaixo do que o lojista definiu, e a diferença sairia da margem dele sem ninguém decidir |
| **Estoque reservado** | 0 | O colchão contra venda dupla. Com 1, a última peça não é vendida nos dois lugares |
| **Máximo por anúncio** | 0 (sem teto) | Quem não quer expor o estoque inteiro ao canal |
| **Preço mínimo para anunciar** | 0 (desligado) | Item barato em que a comissão come a margem inteira nem sobe |
| **Tipo de anúncio** | Clássico | Premium parcela sem juros e aparece mais, e custa mais comissão. É decisão comercial, não detalhe técnico |
| **Condição** | Novo | — |
| **Garantia** | não informar | O ML recusa o anúncio sem ela em boa parte das categorias. Sai como `sale_terms`, e só quando o lojista responde |
| **Publicar novos produtos** | ligado | Desligado, nada novo sobe — mas **o que já está no ar continua sincronizando preço e estoque**. Parar isso venderia peça que acabou |

### 2. Dados do produto (por item, e ninguém deduz)

São os que o preparo cobra e que a tela agora mostra **agrupados pelo que
falta**, não produto a produto: "informe a marca" em trezentos produtos é uma
tarefa, não trezentas. Cada grupo abre a lista e cada linha leva ao cadastro.

| O que falta | Onde se preenche | Se faltar |
|---|---|---|
| Marca (`BRAND`) | campo Marca do produto | bloqueia |
| Código de barras (`GTIN`) | campo GTIN do produto | reduz alcance (o ML aceita com motivo de GTIN vazio) |
| Código do fabricante (`PART_NUMBER`) | campo SKU do produto | bloqueia na maioria das categorias |
| Modelo, material, tipo de veículo e outros atributos da categoria | Configurações → Campos do produto, depois no cadastro | bloqueia ou reduz, conforme a categoria |
| Categoria não identificada | nome do produto: `"Rolamento rígido de esferas 6205 2RS"`, não `"ROL. 6205"` | bloqueia |
| Foto pública, preço e estoque | cadastro do produto | bloqueia |

O botão **Conferir catálogo agora** roda o preparo na hora, até 40 produtos por
vez, e **não precisa da conta conectada** — o preditor de categoria do ML é
público. Dá para arrumar o catálogo inteiro antes de autorizar qualquer coisa.

### 3. O que é da plataforma, não do lojista

`ML_APP_ID` e `ML_APP_SECRET` são o aplicativo da Avila Ops, um só para todas
as lojas. Sem eles o painel **esconde** o botão de conectar e explica, em vez
de mandar o lojista para um erro do Mercado Livre que parece defeito da loja
dele.

## Outros canais

`CANAIS` em `src/lib/canais.ts` é o registro central. Canal novo entra como
**dado** — uma ficha com nome, comissão típica, motivo e exigências —, e a tela
passa a mostrá-lo sem código novo. O que continua sendo código por canal é só o
que de fato difere: o OAuth, o formato do anúncio e o jeito de a venda voltar.

| Canal | Comissão típica | Estado | O que vai exigir do lojista |
|---|---|---|---|
| Mercado Livre | 11–19% | **ativo** | Marca, SKU, GTIN quando houver; nota fiscal na maioria das categorias |
| Amazon | 8–15% | roadmap | Seller Central profissional (mensalidade deles); **GTIN obrigatório** por item; prazo de despacho cumprido, sob pena de perder a conta |
| Shopee | 14–22% | roadmap | Conta aprovada na Open Platform; **peso e dimensão reais** por produto; margem que aguente cupom do canal, que sai do bolso do vendedor |
| Magalu | 10–20% | roadmap | Cadastro no Parceiro Magalu; ficha técnica completa; nota fiscal própria |

Nenhum deles ganha botão de conectar antes de existir: botão que não conecta é
promessa quebrada na primeira tentativa. O que a tela faz é escrever a
exigência, porque **boa parte dela é trabalho de catálogo que o lojista já pode
adiantar hoje** — GTIN, peso e dimensão servem aos quatro.

A ordem sugerida é Shopee antes de Amazon: a exigência de GTIN por item da
Amazon trava justamente o catálogo de peça e acessório, que é o perfil das
primeiras lojas.

## O que fica aberto

1. **Escolher a categoria do ML à mão** (achado 8). Hoje a pendência pede e não
   há tela. É a próxima peça: lista de busca por nome, gravando `categoriaMl`
   no anúncio e refazendo a conferência de atributos com a categoria escolhida.
2. **Mapa de variação.** O preparo publica o produto; ordem com `variation_id`
   baixa a apresentação padrão.
3. **Nota fiscal.** O ML exige e a plataforma não emite. Hoje é trabalho do
   lojista, fora daqui.
4. **Acréscimo por categoria.** A comissão do ML varia por categoria; o
   acréscimo hoje é um só para a loja inteira. Vale esperar aparecer um lojista
   em quem isso doa antes de construir.

## Onde está cada coisa

| Peça | Arquivo |
|---|---|
| Registro de canais, regras e conta de preço | `src/lib/canais.ts` |
| Conexão OAuth e chamada autenticada | `src/lib/mercadolivre.ts` |
| Preparo do catálogo e pendências agrupadas | `src/lib/mercadolivre-preparo.ts` |
| Publicação, sincronia e rotina | `src/lib/mercadolivre-publicacao.ts` |
| A tela | `src/components/painel/Canais.tsx` |
| Regras (PUT) e preparo sob demanda (POST) | `src/app/api/painel/canais/mercadolivre/{regras,preparo}` |
| Venda voltando, perguntas, reputação | `docs/MERCADO-LIVRE.md` |
