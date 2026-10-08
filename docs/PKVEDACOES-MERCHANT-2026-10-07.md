# PK Vedações: catálogo, Google Merchant e SEO (07/10/2026)

Loja `pkvedacoes`, domínio próprio `pkvedacoes.com.br`, layout Catálogo
Técnico. Levantamento feito numa sessão de nuvem, só pelo que a vitrine
publica (`llms-full.txt`, `sitemap.xml`, `feed/merchant.xml`, `robots.txt` e
páginas): sem acesso ao banco, ao painel nem ao Tag Manager. O que não deu
para verificar está dito como tal.

## O que a loja tem hoje

| Medida | Valor |
|---|---:|
| Produtos publicados | 767 |
| Gaxeta PU (Tipo B / STD / BS) | 294 / 149 / 122 |
| Raspador PU - Tipo D | 110 |
| Anel guia | 96 |
| Com preço | 0 (todos "preço sob consulta") |
| Com foto própria do SKU | 0 |
| Com foto representativa da família | 767 (5 fotos, uma por família) |
| Itens no feed do Merchant | **0** |
| Descrição | só "Referência X" (a descrição curta) |
| Categoria Google | nenhuma: os nomes "Gaxeta PU - Tipo B" não casavam com a regra |

Cada produto já tem o que importa como dado: medidas (DI × DE × altura e seção
do cordão, em mm), grupo/subgrupo, número de catálogo, código PK (`PKG.0070`,
`RPU.1321`, `GNY.5010`) e a referência de catálogo em `codigosEquivalentes`
("Substitui / equivale a").

## Por que o feed do Merchant sai vazio

`src/lib/catalogo-merchant.ts` só emite oferta com preço maior que zero e sem
ocorrência de severidade `erro` para o canal Google. Na PK, **todas** as 767
ofertas caem em duas delas:

1. `preco_ausente`: preço zero. O Merchant exige `price`; não existe anúncio
   "sob consulta" no Shopping.
2. `foto_representativa`: a imagem principal é da série, não do SKU. A regra
   da plataforma (e a política do Google) é que a foto mostre o item vendido.

Nenhuma mudança de código faz esse feed ficar válido. É decisão do lojista:

- **Preço.** Sem preço no cadastro a loja não entra no Shopping, ponto. Se a
  PK vende por tabela, a tabela precisa virar `preco` na planilha.
- **Foto.** Ou foto própria por SKU (inviável para 767 medidas), ou
  reorganizar cada família como **um produto com a opção "Medida"** (a
  plataforma já suporta grade com SKU, preço e estoque por variação, e o feed
  sai com `item_group_id`): aí uma foto real da família é a foto do produto,
  e as medidas são variações dele, que é como o Google espera receber isso.
  A reorganização é trabalho de catálogo, não de código, e muda as URLs
  (`/produtos/<slug>?variante=`), então precisa de redirecionamento dos 767
  endereços atuais.

### Fotos de terceiros, não

O pedido era copiar as fotos "do produto que mais se destaca" na busca pelo
nome. Não foi feito, e não deve ser: o que aparece na busca por "Gaxeta PU
Tipo B 100 × 114 × 12" são produtos de concorrentes (Vedabras, Sippel, AGN,
Tecnoring). Foto de outro fabricante no anúncio da PK é violação de direito
autoral, viola a política de imagem do Merchant (a imagem tem que ser do item
vendido) e contraria a regra do projeto: imagem plausível de produto errado é
pior que ausência de imagem. A PK fabrica as peças; cinco fotos boas, uma por
família, feitas por ela, resolvem a vitrine inteira.

## O que foi feito nesta sessão

### Planilha de atualização dos 767 produtos

`docs/importacao/pkvedacoes-catalogo-2026-10-07.csv`, no formato da
exportação do painel (`COLUNAS_PRODUTO`), localizando cada produto pelo
`slug`. Validada com `lerCsvProdutos`: 767 linhas, 0 erros. Colunas:

- `descricao_curta` (188 a 232 caracteres): família, medida, aplicação,
  limites de pressão e velocidade, referência de catálogo e código PK. É o
  que vira meta description e `g:description`.
- `descricao` (quatro parágrafos): ficha com as medidas e a referência; o
  que o perfil faz, onde se aplica, pressão e velocidade máximas; o material
  (dureza, faixa de temperatura, compatibilidade química); como conferir a
  medida no alojamento. **Todos os números são do catálogo da própria PK**,
  que está no Drive (pasta `07 - PK Vedações`: "Catálogo modelo.pdf",
  "Proposta catálogo v1.pdf" e "Catálogo PK Vedações.xlsx"):

  | Família | Aplicação | Pressão máx. | Velocidade máx. | Material |
  |---|---|---:|---:|---|
  | Gaxeta STD | êmbolo (e haste) | 304 bar | 0,5 m/s | PU Shore A 85–93, -25 °C a +90 °C |
  | Gaxeta B | êmbolo e haste | 304 bar | 0,5 m/s | idem |
  | Gaxeta BS | haste | 400 bar | 0,5 m/s | idem |
  | Raspador D | haste | — | 1 m/s | PU, -30 °C a +90 °C |
  | Anel guia | êmbolo e haste | 40 N/mm² a 20 °C, 30 N/mm² a 100 °C | 1,0 m/s | nylon com fibra de vidro |

- **Referência de catálogo** (ex.: `6-27503937-473`, `W2-4250.500`,
  `12500625-250`) em 748 dos 767 produtos: só entrou quando o slug da loja
  (código + referência) existe na planilha do Drive **e** as três medidas
  batem com o nome do produto. Os 19 restantes são itens "SR" (sob
  referência especial: 17 raspadores e 2 anéis guia) que a planilha não tem.
- **Código PK correto por família**: a BS leva o sufixo no código
  (`PKG.0376 BS`), e dois STD são segundo cadastro (`PKG.1934/A`,
  `PKG.0265 A`). A primeira versão desta planilha escrevia `PKG.0376` para a
  BS; corrigido cruzando pelo slug.
- `google_product_category`: 111 (Comercial e industrial), a prateleira que a
  plataforma já usa para as famílias industriais da Vedashow. A taxonomia
  não tem folha para vedação hidráulica.

### A planilha da PK e a loja não são o mesmo conjunto

Cruzamento pelo slug (código + referência) da planilha do Drive (843 linhas,
840 slugs) com os 767 produtos publicados: 748 em ambos, 19 só na loja e 95
linhas só na planilha. Depois de olhar linha a linha:

- **Os 19 "só na loja" são os itens "SR"** (17 raspadores D e 2 anéis guia,
  slug `<código>-sr`): na planilha da PK eles existem com a coluna de
  referência vazia, e as três medidas batem com o nome publicado nos 19.
  Nada a criar; a planilha de atualização já os cobre.
- **36 anéis guia faltam na loja de verdade.** A aba "Anel Guia" tem 37
  códigos em duas linhas cada: uma com referência coerente com as medidas
  (a referência termina em Ø externo e altura em milésimos de polegada:
  `6W10-3000.250` = 76,2 mm × 6,35 mm) e outra com a referência "+1"
  (`…251`) e medidas que não correspondem a nada (75,16 × 78,38 × 16,71,
  crescendo linha a linha como fórmula arrastada). Em 36 códigos só uma linha
  passa no teste; é ela que entra em
  `docs/importacao/pkvedacoes-criar-aneis-guia-2026-10-07.csv`, planilha de
  **criação** (36 linhas, 0 erros no leitor, nenhum slug ou SKU já existente
  na loja): nome no mesmo padrão da loja, preço 0 (sob consulta, como os
  demais), categoria "Anel guia", marca PK Vedações, SKU = código PK,
  descrição da família, foto `representativa` da família (`anel-guia.webp`,
  a mesma dos 96 publicados) e `atributos_json` com as medidas e a
  referência. Fica separada da planilha de atualização para o lojista
  decidir se esses 36 entram.
- **2 códigos ficam de fora, para a PK responder:** `PKG.1878` (Gaxeta STD;
  as duas linhas têm a mesma referência `18701187` e externos diferentes,
  39,66 e 42,86 mm) e `GNY.5137` (Anel guia; nas duas linhas a referência
  não bate com as medidas, e uma tem interno maior que o externo). A lista
  completa das 95 linhas continua em
  `docs/importacao/pkvedacoes-so-na-planilha-2026-10-07.csv`, só para
  conferência; **não** é planilha de importação.

Como aplicar: Painel → Produtos → Planilha → enviar
`pkvedacoes-catalogo-2026-10-07.csv` → conferir a prévia (767 atualizados,
0 criados) → confirmar. Depois, se os 36 anéis guia entram, enviar
`pkvedacoes-criar-aneis-guia-2026-10-07.csv` → prévia (0 atualizados, 36
criados) → confirmar. Só então conferir `/produtos/gny-5010-w2-4250-500`,
um dos novos (`/produtos/gny-5131-6w10-1182-984`) e o `llms-full.txt`. A
planilha de atualização não mexe em nome, preço, foto, categoria nem
estoque.

### Código (vale para toda loja, nada por slug)

- `descricaoDaLoja` (`src/lib/textos-loja.ts`): meta description, Open
  Graph e o resumo do `llms.txt`/`llms-full.txt` passam a ser slogan →
  diferencial da marca → primeiro parágrafo do "Sobre" → só então "Loja
  virtual X". A PK saía no Google como "Loja virtual PK Vedações" e o
  `llms.txt` publicava um resumo vazio.
- `categoria-google.ts`: família industrial reconhecida com material e tipo
  no nome ("Gaxeta PU - Tipo B", "Raspador PU - Tipo D", "Anel guia") e no
  singular (`raspadores?` só casava o plural). As cinco categorias da PK
  passam a sair com `google_product_category` no feed e sem o aviso
  "categoria Google ausente" no diagnóstico.
- `llms-full.txt`: linhas "Público: Não informado" e "Direção fotográfica:
  Não informada" deixam de ser publicadas.
- `eventos-loja.ts` + `Pixels.tsx`: loja que só tem o GTM (caso da PK) passa
  a receber `view_item`, `add_to_cart`, `begin_checkout` e `purchase` no
  `dataLayer` como `{ event, ecommerce }`, que é o que a tag do GA4 dentro do
  container lê. Antes os eventos saíam só por `gtag('event')`, que o Tag
  Manager não transforma em gatilho: a PK media visita e nada mais. Com GA4
  ou Google Ads colados direto, continua indo pelo gtag, sem duplicar.

Testes: 741 passam (`npm test`), `npm run typecheck` e `eslint` limpos.
A integração (`npm run test:integracao`) não roda nesta sessão: não há
Docker. A mudança não toca catálogo nem busca.

## Revisão página a página

| Página | Estado em 07/10 | O que muda |
|---|---|---|
| `/` | title "PK Vedações"; description "Loja virtual PK Vedações"; canonical, `max-image-preview:large`, JSON-LD `Store` + `WebSite` com `SearchAction`; H1 = nome (sem slogan); sem logo | description vira a frase do "Sobre". Slogan e logo são campos da aba Marca |
| `/produtos` | title ok; description herdada ("Loja virtual…"); canonical por página (`?pagina=N`); filtros `noindex, follow`; 767 itens, 16 páginas | description herdada melhora junto |
| `/categoria/*` (5) | title ok; description genérica "Confira os produtos da categoria…"; `BreadcrumbList`; canonical | `Categoria.seo*` está vazio: gerar no painel (Categorias → SEO) ou pela rotina das 3h, que só escreve com `GEMINI_API_KEY` |
| `/produtos/[slug]` (767) | title, canonical, `og:image`, `BreadcrumbList`, `Product` com `brand`, `sku`, `additionalProperty` (medidas em mm). Description = "Referência X". Sem `offers` (preço zero), sem `mpn`/`gtin` | planilha preenche descrição e categoria Google. `Product` sem `offers` fica como "item inválido" em Snippets de produto no Search Console até existir preço |
| `/sobre`, `/contato` | title e canonical ok; contato tem telefone, e-mail e razão social | — |
| `/politicas/{envio,devolucao,privacidade,termos}` | 4 páginas, canonical, modelo da plataforma (7 dias, devolução grátis, coerente com `MerchantReturnPolicy`) | — |
| `/promocoes`, `/blog` | fora do sitemap porque não há campanha nem publicação | correto |
| `/carrinho`, `/checkout`, `/conta` | `noindex` e bloqueados no robots | correto |
| `robots.txt` | busca liberada (inclusive `OAI-SearchBot`), treinamento bloqueado, sitemap do domínio próprio | — |
| `sitemap.xml` | 780 URLs: home, produtos, 5 categorias, 767 produtos, sobre, contato, 4 políticas | — |
| `llms.txt` | resumo vazio ("> "); categorias, contato e políticas ok | resumo preenchido |
| `llms-full.txt` | "Loja virtual…", "Não informado" ×2, 767 produtos com "preço sob consulta" | corrigido |
| GTM | `GTM-KZH37W3D` carregado com Consent Mode v2 em `denied` e `update` no aceite; aviso de cookies ativo | eventos de e-commerce passam a chegar no `dataLayer` |
| GA4 | sem `G-` no HTML: ou está dentro do container, ou não existe | **não verificável daqui**: abrir o container e conferir se há tag GA4 com gatilhos `view_item`, `add_to_cart`, `begin_checkout`, `purchase` lendo `ecommerce` |
| Search Console | sem `google-site-verification` no HTML | se a verificação for por DNS, ok; senão colar o código em Anúncios |

## O que fica com o Nicolas / a PK

1. **Preço** nos 767 itens (ou nos que vão ao Shopping). Sem isso, Merchant
   não existe.
2. **Cinco fotos próprias**, uma por família, no fundo branco, e a decisão
   entre manter 767 produtos (foto `representativa`, fora do Merchant) ou
   reorganizar em 5 produtos com a opção "Medida".
3. Subir a planilha de atualização no painel e conferir; decidir se os 36
   anéis guia da planilha de criação entram; perguntar à PK o código certo
   de `PKG.1878` e `GNY.5137`.
4. Aba Marca: slogan (vira title e H1), logo, diferencial e público.
5. Tag Manager: confirmar a tag GA4 e os gatilhos; ou colar o `G-` em
   Anúncios, que resolve sem container.
6. Search Console: cadastrar `https://pkvedacoes.com.br/sitemap.xml` e, no
   Merchant, a fonte `https://pkvedacoes.com.br/feed/merchant.xml` (vazia até
   o item 1).

## Atualização de 08/10/2026: o que foi aplicado em produção

Sessão no servidor, com acesso ao banco. Dump de antes:
`/opt/backups/retidos-pk-merchant-20261008/lojas-antes-carga-pk.dump` no
`applications`. As cargas entraram por `importarProdutos`, o mesmo caminho da
planilha do painel.

| Medida | Antes | Depois |
|---|---:|---:|
| Produtos publicados | 767 | 803 (entraram os 36 anéis guia) |
| Com descrição curta e longa | 0 | 803 |
| Com `mpn` (código PK) e marca | 0 | 803 |
| Com prateleira Google | 0 | 803 (671 em 6732, 132 em 111) |
| Com preço | 0 | 785 |
| Logo e favicon | não | sim |

- **Prateleira Google.** Gaxetas e raspadores foram para **6732** (Ferragens >
  Encanamento > Juntas e conexões para encanamento > Anéis de vedação), a única
  folha de vedação da taxonomia. Anel guia não é vedação e ficou em 111.
- **Preço.** Decisão do Nicolas em 08/10: "Preço Unitário R$" da planilha
  `Inventário` da PK (Drive, posição de 31/12/2025) **mais 20%**, com **pedido
  mínimo de R$ 300,00**. O cruzamento é pelo código PK e confere a referência
  na descrição do inventário: 747 conferem, 38 são itens "SR" (sem referência
  para contradizer) e entraram só pelo código. Ficaram **sem preço 18
  produtos**: 4 sem código no inventário (`GNY.2284`, `GNY.5086`, `GNY.5231`,
  `PKG.2851 BS`) e 14 em que a referência do inventário diverge da loja
  (`docs/importacao/pkvedacoes-precos-divergentes-2026-10-08.csv`, para a PK
  dizer qual medida vale).
- **Pedido mínimo.** Publicado no aviso do topo da loja.
- **Imagens.** Continuam as 5 ilustrações de família (`representativa`). O
  Google aceita ilustração em Ferragens, então as 671 gaxetas e raspadores
  podem ir ao feed; os 132 anéis guia (prateleira 111) continuam precisando de
  foto real.

### Por que o feed continua vazio

A loja ainda não vende: plano Site, sem Mercado Pago conectado e sem CEP de
origem. O Merchant só aceita oferta que se compra na página de destino, e desde
08/10 o feed de loja que não vende sai vazio (`docs/MERCHANT-CENTER.md`).
Faltam, nesta ordem: passar o plano para Loja (com a decisão de cobrança da
assinatura: sem `cobrancaIsenta` a rotina de assinatura suspende loja paga sem
assinatura), conectar o Mercado Pago da PK no painel, gravar o CEP de origem e
a tabela ou integração de frete, e só então cadastrar
`https://pkvedacoes.com.br/feed/merchant.xml` no Merchant Center, com o valor
mínimo de pedido repetido no serviço de frete da conta.

### Complemento de 08/10

- **Categorias.** As cinco saíram do texto de reserva: título, descrição e
  palavras-chave escritos à mão (`seoOrigem = manual`) e parágrafo de
  apresentação em `Categoria.descricao`, com os limites do catálogo da PK.
- **Pedido mínimo.** `Tenant.pedidoMinimoCentavos = 30000`; aparece na ficha e
  na política de envio. O carrinho não pôde ser conferido na loja publicada:
  no plano Site a ficha não tem botão de compra.
- **Sem canal de pedido.** `Tenant.whatsapp` está vazio, então a ficha mostra
  preço e nenhum botão de pedido; o visitante só tem o telefone e o e-mail da
  página de contato. Falta o número de WhatsApp da PK.
