# Canais de venda: auditoria e o que o lojista preenche

Auditoria de 19/09/2026 da integração com marketplaces, e o desenho da tela em
Configurações → Canais que saiu dela.

> **Atualizado em 19/09/2026.** A auditoria abriu com dez achados; o trabalho
> que saiu dela fechou nove e descobriu mais dois pelo caminho — os de número
> 9, 11 e 12, que são os que mexiam em estoque de verdade. O que segue aberto
> está no fim.

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
| 8 | A pendência diz "escolha a categoria à mão", e **não existia tela para isso** | médio: promessa que o produto não cumpria | resolvido (19/09/2026) |
| 9 | Ordem com `variation_id` baixava a **apresentação padrão**, seja qual fosse a vendida: vender o G tirava o P do estoque | **crítico**: erra duas apresentações de uma vez, em silêncio, até virar cancelamento | resolvido (19/09/2026) |
| 11 | Item de anúncio **não casado** com o catálogo fazia a baixa do pedido inteiro lançar, inclusive das linhas que casaram — o código dizia o contrário | alto: venda de canal não baixava estoque nenhum | resolvido (19/09/2026) |
| 12 | Não havia como ligar anúncio que **já existe** no ML do lojista. Quem já vendia lá conectava a conta e nada acontecia: sem sincronia, e a venda sem produto casado | **alto**: é a situação de quase todo lojista que conecta | resolvido (19/09/2026) |
| 10 | **Nota fiscal**: o ML exige na maioria das categorias e a plataforma não emite | alto para o lojista, fora do escopo de hoje | aberto |

## Escolher a categoria à mão

Era o achado 8, e a única promessa que o produto não cumpria: o preparo mandava
*"escolha a categoria do Mercado Livre à mão"* em todo produto cujo nome o
preditor não entendeu, e não havia tela nenhuma.

O caminho agora é: **Canais → O que falta → Categoria → o produto**, que abre
uma gaveta com a sugestão automática (quando houver), a busca por texto livre,
o caminho inteiro de cada resultado e o código da categoria. Ao salvar, os
atributos são reconferidos na hora e a resposta já diz o que sobrou:

```
Categoria definida ✓
Esferas de Rolamento
Acessórios para Veículos › Peças › Esferas de Rolamento
MLB455028

Ainda faltam 2 informações
  • Marca
  • Material
```

Descobrir isso tentando publicar é exatamente o que a tela existe para evitar.

Três regras que o código respeita:

1. **Escolha manual é palavra final.** `AnuncioMercadoLivre.categoriaOrigem`
   separa `automatica` de `manual`, e `categoriaEscolhidaAMao` é consultada
   **antes** de o preditor rodar: quem escolheu a dedo nunca vê a categoria
   trocar sozinha num repreparo. O repreparo continua acontecendo — é ele que
   enxerga a marca recém-cadastrada —, só não mexe na categoria.
2. **O Mercado Livre só publica em categoria folha.** Categoria de meio de
   árvore é agrupamento, e o ML recusa sem explicar. A escolha manual recusa
   antes de gravar e mostra as filhas para o lojista descer.
3. **Falha de rede não apaga escolha.** A consulta ao ML acontece inteira antes
   de qualquer gravação: Mercado Livre fora do ar deixa a categoria anterior
   exatamente como estava, e o lojista lê isso na mensagem.

O coringa (*Águas Minerais*) tem tratamento diferente aqui e no preparo. No
preparo ele é sempre descartado, porque em primeiro lugar significa que o
preditor não entendeu o nome. Na busca manual quem digitou foi uma pessoa: se
ela escrever "água mineral", esconder a categoria de água mineral seria esconder
o que ela procurou. Então ele só cai quando não casa com o texto digitado.

Nada disso exige conta conectada: busca, caminho e atributos de categoria são
endpoints públicos do ML.

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
| Categoria não identificada | a própria pendência abre a escolha manual; corrigir o nome do produto também resolve | bloqueia |
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

1. **Publicar variação.** O preparo publica o produto, não a variação: um
   anúncio por produto, com preço e estoque da apresentação principal. Deixou
   de ser correção e virou alcance — a venda já volta certa em anúncio com
   variações criado à mão, e esse anúncio já pode ser adotado. Construir isto
   exige acertar `attribute_combinations` contra os atributos que cada
   categoria aceita como variação, e `picture_ids` por variação: regras que só
   se provam contra a API viva, como `scripts/provar-preparo-ml.ts` faz para o
   preparo. Fazer às cegas gera recusa que o lojista não entende.
2. **Nota fiscal.** O ML exige e a plataforma não emite. Hoje é trabalho do
   lojista, fora daqui.
3. **Acréscimo por categoria.** A comissão do ML varia por categoria; o
   acréscimo hoje é um só para a loja inteira. Vale esperar aparecer um lojista
   em quem isso doa antes de construir — e o caminho já está preparado sem
   estar aberto: `resolverRegrasDoCanal` devolve um resolvedor que a publicação
   e a sincronia consultam **produto a produto**, então o dia em que o override
   existir a mudança é dentro dele, e nenhum dos dois caminhos muda uma linha.
   Nenhuma tela expõe isso.

## Onde está cada coisa

| Peça | Arquivo |
|---|---|
| Registro de canais, regras e conta de preço | `src/lib/canais.ts` |
| Conexão OAuth e chamada autenticada | `src/lib/mercadolivre.ts` |
| Preparo do catálogo e pendências agrupadas | `src/lib/mercadolivre-preparo.ts` |
| Escolha manual de categoria (busca pública, folha, recálculo) | `src/lib/mercadolivre-categorias.ts`, `painel/CategoriaMl.tsx` |
| Adotar anúncio que já existe no ML (casa por SKU e GTIN, nunca por título) | `src/lib/mercadolivre-adocao.ts`, `painel/AdotarAnunciosMl.tsx` |
| Qual apresentação o ML vendeu, e o que baixa do estoque | `resolverVariante`, `agruparParaBaixa` |
| CI e publicação pelo próprio servidor | `deploy/ci-servidor.sh`, `docs/CI-NO-SERVIDOR.md` |
| Publicação, sincronia e rotina | `src/lib/mercadolivre-publicacao.ts` |
| A tela | `src/components/painel/Canais.tsx` |
| Regras (PUT) e preparo sob demanda (POST) | `src/app/api/painel/canais/mercadolivre/{regras,preparo}` |
| Venda voltando, perguntas, reputação | `docs/MERCADO-LIVRE.md` |
