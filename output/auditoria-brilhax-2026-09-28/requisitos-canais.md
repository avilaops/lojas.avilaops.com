# Requisitos de cadastro de produto: Google Merchant Center, Mercado Livre e Shopee (Brasil)

**Contexto:** loja brasileira de estética automotiva (car detailing): químicos (shampoo, cera, selante, APC, desengraxante, pretinho/renovador, aromatizante, vitrificador/coating, polidores/compostos) e acessórios (boinas/pads, microfibras, pincéis, aplicadores, luvas, escovas).

**Data de consulta:** 28/09/2026. Todas as páginas e chamadas de API abaixo foram feitas nesse dia.

**Legenda:** **Obrigatório** · **Condicional** (obrigatório só em certos casos) · **Recomendado** · **Não confirmado** (não achei fonte oficial acessível para confirmar).

**Como os dados foram obtidos**
- Google: páginas de support.google.com/merchants e developers.google.com/search lidas diretamente. Também baixei a taxonomia oficial de produtos do Google.
- Mercado Livre: consultei as rotas públicas da API sem token (`/sites/MLB/domain_discovery/search`, `/categories/{id}` e `/categories/{id}/attributes`). Também li as páginas de developers.mercadolivre.com.br e mercadolivre.com.br/ajuda. **Rotas que exigem token de vendedor (responderam HTTP 403 sem autenticação):** `/categories/{id}/technical_specs/input`, `/categories/{id}/sale_terms`, `/products/search` (catálogo), `/sites/MLB/listing_types` e `/sites/MLB/search`.
- Shopee: artigos da Central de Ajuda (help.shopee.com.br) e a especificação da Open Platform (open.shopee.com, rota pública de documentação). A **Central de Educação do Vendedor (seller.shopee.com.br/edu)** só renderiza via JavaScript e a API dela recusa acesso sem sessão. Por isso os limites numéricos de fotos, título e descrição da Shopee ficaram como **não confirmados**. Com conta de vendedor, eles podem ser obtidos por `v2.product.get_item_limit` (exige autorização).

---

## 1. Google Merchant Center (Brasil)

### 1.1 Especificação de dados de produto
Fonte principal: https://support.google.com/merchants/answer/7052112?hl=pt-BR (Especificação de dados do produto)

| Atributo | Status | Regra / quando | Fonte |
|---|---|---|---|
| `id` | **Obrigatório** | Até 50 caracteres, único por produto. Usar o SKU quando possível e mantê-lo estável. | answer/7052112 |
| `title` (ou `structured_title`) | **Obrigatório** | 1 a 150 caracteres. O que importa vai primeiro (os ~70 caracteres iniciais são os mais vistos). Incluir marca, tipo de produto e atributo diferenciador (ex.: volume 500 ml, cor, grão do pad). Não usar texto promocional (preço, frete, "promoção"), CAIXA ALTA de ênfase nem símbolos para chamar atenção. | https://support.google.com/merchants/answer/6324415?hl=pt-BR |
| `description` (ou `structured_description`) | **Obrigatório** | 1 a 5.000 caracteres, com o essencial nos primeiros 160–500. Deve bater com a página de destino. Não incluir links, informações de frete ou preço, comparações com concorrentes, texto promocional nem CAIXA ALTA. | https://support.google.com/merchants/answer/6324468?hl=pt-BR |
| `link` | **Obrigatório** | URL em domínio verificado e reivindicado, com http/https e codificação correta. | answer/7052112 |
| `image_link` | **Obrigatório** | Ver 1.2. | https://support.google.com/merchants/answer/6324350?hl=pt-BR |
| `additional_image_link` | Recomendado | Até 10 imagens adicionais, cada URL com até 2.000 caracteres, mesmas regras de `image_link`. | answer/7052112 |
| `availability` | **Obrigatório** | `in_stock` / `out_of_stock` / `preorder` / `backorder`. | answer/7052112 |
| `availability_date` | Condicional | Obrigatório quando `availability=preorder`. | answer/7052112 |
| `price` | **Obrigatório** | Moeda ISO 4217 (ex.: `49.90 BRL`). Deve ser igual ao preço da página e do checkout e não pode ser 0. | answer/7052112 |
| `sale_price` / `sale_price_effective_date` | Recomendado (quando houver promoção) | Exige `price` também. Datas em ISO 8601. | answer/7052112 |
| `brand` | **Obrigatório** (produtos novos) | Até 70 caracteres. Informar a marca própria só para produtos de marca própria (private label). | answer/7052112 |
| `gtin` | **Obrigatório** quando o fabricante atribuiu GTIN (a página de GTIN o descreve como "recomendado para todos os produtos com GTIN atribuído pelo fabricante") | EAN/GTIN-13 no Brasil. Até 50 dígitos com checksum válido. Não inventar GTIN. Em kits montados pelo lojista, informar o GTIN do produto principal. | https://support.google.com/merchants/answer/6324461?hl=pt-BR |
| `mpn` | Condicional | Obrigatório se o produto novo não tiver GTIN do fabricante. Até 70 caracteres, só MPN do fabricante. | answer/7052112 |
| `identifier_exists` | Condicional | Enviar `no` quando o produto não tiver GTIN nem MPN/marca (ex.: acessório genérico ou produto artesanal sem código). | answer/7052112 |
| `condition` | Condicional | Obrigatório só para usado/recondicionado. Recomendado enviar `new` sempre. | answer/7052112 |
| `google_product_category` | Recomendado (o Google atribui automaticamente se ausente) | Uma categoria, por ID ou caminho. Ver 1.4. | answer/7052112 |
| `product_type` | Recomendado | Até 750 caracteres, com a árvore de categorias da própria loja (ex.: `Químicos > Lavagem > Shampoo`). | answer/7052112 |
| `item_group_id` | Condicional | Obrigatório para variantes (ex.: mesmo shampoo em 500 ml / 1,5 L / 5 L, ou pad em cores/grãos). Até 50 caracteres. A spec atual também cita `item_group_title` e `variant_option`. | answer/7052112 |
| `color`, `size`, `material`, `pattern` | Condicional | Obrigatórios quando diferenciam variantes. `color` e `size` também são exigidos em vestuário, o que não se aplica aqui. | answer/7052112 |
| `is_bundle` | Condicional | Kits montados pelo lojista (ex.: "kit lavagem": shampoo + luva + microfibra). | answer/7052112 |
| `multipack` | Condicional | Multipacks montados pelo lojista (ex.: "kit 10 microfibras iguais"). | answer/7052112 |
| `shipping` | **Obrigatório no Brasil**, mas pode ser atendido pelas configurações de frete da conta | O Brasil está entre os países em que o custo de frete é obrigatório. O atributo por item só é necessário para substituir a configuração da conta. Subatributos: `country` (BR), `region`/`postal_code`, `service`, `price`, `min/max_handling_time`, `min/max_transit_time`. | https://support.google.com/merchants/answer/6324484?hl=pt-BR |
| `shipping_weight` | Condicional | Obrigatório se o frete da conta for calculado por peso. Unidades g/kg/lb/oz. Use o peso **com embalagem**. | https://support.google.com/merchants/answer/6324503?hl=pt-BR |
| `shipping_length/width/height` | Condicional | Quando o frete usa dimensões ou peso cubado. | answer/7052112 |
| `product_detail` | Recomendado | Até 100 entradas (`section_name`, `attribute_name`, `attribute_value`). Ex.: Volume = 500 ml; Diluição = 1:400; pH = neutro; Grão/Corte = médio; GSM da microfibra = 400. | answer/7052112 |
| `product_highlight` | Recomendado | 2 a 100 destaques, cada um com até 150 caracteres e sem texto promocional. | answer/7052112 |
| `product_weight` / `product_length` etc. | Recomendado | Peso e dimensões do produto. | answer/7052112 |
| `unit_pricing_measure` / `unit_pricing_base_measure` | Recomendado (útil para químicos: preço por litro) | Ex.: `500ml` / `1l`. Não achei confirmação de obrigatoriedade no Brasil. | answer/7052112 |
| `video_link`, `lifestyle_image_link`, `document_link` (PDF, ex.: FISPQ/ficha técnica) | Recomendado | `document_link`: até 5 PDFs. | answer/7052112 |
| `expiration_date` | Opcional | Data em que o item deixa de ser exibido. Não é a validade do químico. | answer/7052112 |

### 1.2 Requisitos de imagem
Fonte: https://support.google.com/merchants/answer/6324350?hl=pt-BR (e versão EN)

| Item | Status | Regra |
|---|---|---|
| Tamanho mínimo | **Obrigatório** | **500 × 500 px** para todos os produtos. A página diz: "recently announced new image size requirements of at least 500 x 500 pixels for all products beginning January 31, 2027". A lista de requisitos já mostra 500 × 500. **O mínimo anterior a 31/01/2027 não aparece na página atual (não confirmado).** |
| Tamanho recomendado | Recomendado | ≥ 1500 × 1500 px |
| Máximos | **Obrigatório** | ≤ 64 megapixels, arquivo ≤ 16 MB |
| Formatos | **Obrigatório** | JPEG, WebP, PNG, GIF (não animado), BMP, TIFF |
| Proibições | **Obrigatório** | Sem texto promocional sobreposto ("compre", preço), sem marca d'água, sem nome ou logo da loja sobreposto, sem bordas, sem placeholder ou imagem genérica. |
| Fundo e enquadramento | Recomendado | Fundo branco ou transparente, com o produto ocupando entre 75% e 90% da imagem. |
| Imagens geradas por IA | **Obrigatório** se houver | Manter os metadados IPTC (`DigitalSourceType`) |

### 1.3 Página de destino
Fonte: https://support.google.com/merchants/answer/4752265?hl=pt-BR

- **Obrigatório:** o preço aparece claramente e é igual ao do feed, na mesma moeda (BRL) e no mesmo idioma (pt-BR).
- **Obrigatório:** a disponibilidade fica clara. Produto em estoque precisa ter botão "Comprar/Adicionar ao carrinho" ativo; produto esgotado precisa indicar isso.
- **Obrigatório:** o conteúdo é o mesmo para qualquer dispositivo, navegador e local (não pode variar por IP ou cookie). A página funciona em celular e não redireciona para domínio não reivindicado.
- **Obrigatório:** preço e disponibilidade não mudam depois do carregamento da página, o que importa para lojas com JS/SSR.
- Recomendado: incluir os dados estruturados abaixo, porque o Google os usa para verificar o feed e atualizar itens automaticamente.

### 1.4 Categorias do Google (taxonomia oficial pt-BR, versão 2021-09-21)
Arquivo: https://www.google.com/basepages/producttype/taxonomy-with-ids.pt-BR.txt

| Produto | ID | Caminho |
|---|---|---|
| Shampoo, APC, desengraxante, limpadores em geral | 2590 | Veículos e peças > … > Limpeza de veículos > Soluções para limpeza de carro |
| Cera, selante, vitrificador/coating, polidor/composto, pretinho/renovador | 2643 | … > Limpeza de veículos > Ceras, graxas e protetores de veículos (EN: Vehicle Waxes, Polishes & Protectants) |
| Escovas, pincéis | 2894 | … > Limpeza de veículos > Escovas para limpeza de carro |
| Limpador de estofado/carpete | 2704 | … > Limpadores de carpetes e estofados de veículos |
| Limpa-vidros | 2846 | … > Limpadores de vidro de veículos |
| Microfibras, luvas, aplicadores, boinas (sem folha específica) | 2895 | … > Limpeza de veículos (genérica). Alternativa para microfibra: 8071 (Shop Towels & General-Purpose Cleaning Cloths). |
| Aromatizante automotivo | **2789** | … > Decoração automotiva > Odorizadores para carro (EN: Vehicle Air Fresheners). *Corrigido em 28/09 após conferência no arquivo oficial taxonomy-with-ids.pt-BR.txt; a primeira versão deste levantamento dizia não haver folha específica.* |
| Boina/pad para politriz | 2895, ou 1225 (Hardware > Tools > Polishers & Buffers) se for vendida junto com a máquina | Escolha minha, não confirmada pelo Google. |

### 1.5 Dados estruturados (Search Central – merchant listings)
Fonte: https://developers.google.com/search/docs/appearance/structured-data/merchant-listing

| Tipo / propriedade | Status |
|---|---|
| `Product.name` | **Obrigatório** |
| `Product.image` | **Obrigatório**. Várias imagens em alta resolução; a página cita mínimo de 50 mil pixels e proporções 16×9, 4×3 e 1×1. |
| `Product.offers` (`Offer` ou `AggregateOffer`) | **Obrigatório** |
| `Offer.price` (ou `priceSpecification.price`) | **Obrigatório**, maior que zero |
| `Offer.priceCurrency` | **Obrigatório** (`BRL`) |
| `Product.description`, `brand`, `gtin`/`gtin13`, `sku`, `mpn`, `aggregateRating`, `review`, `color`, `material`, `size`, `category` | Recomendado |
| `Offer.availability` (`https://schema.org/InStock` …), `itemCondition` (`NewCondition`), `url`, `priceValidUntil` | Recomendado. Se `priceValidUntil` estiver no passado, o item pode não aparecer. |
| `Offer.shippingDetails` → `OfferShippingDetails` (`shippingRate`, `shippingDestination` com `addressCountry: BR`, `deliveryTime` com `handlingTime` e `transitTime`) | Recomendado. O Google **prefere uma política de frete no nível da organização** (markup `Organization` ou configuração no Merchant Center). |
| `Offer.hasMerchantReturnPolicy` → `MerchantReturnPolicy` (`applicableCountry: BR`, `returnPolicyCategory`, `merchantReturnDays`, `returnMethod`, `returnFees`) | Recomendado. O Google **recomenda uma política global em `Organization`**. No Brasil, o direito de arrependimento do CDC é de 7 dias, o que serve de referência para `merchantReturnDays`. |
| Variantes | Recomendado: `ProductGroup` com `hasVariant`, `variesBy` e `productGroupID`, em linha com `item_group_id` no feed. |

---

## 2. Mercado Livre Brasil

### 2.1 Categorias (API `domain_discovery` + árvore `MLB188063 Limpeza Automotiva`)
Subcategorias de **Acessórios para Veículos > Limpeza Automotiva (MLB188063)** retornadas pela API: Abrilhantadores (MLB429409), Anticorrosivos (MLB430552), Aspiradores (MLB22723), Boinas (MLB433258), Ceras (MLB263726), Desengraxantes (MLB270872), Fragrâncias (MLB271614), Limpa Radiadores (MLB455776), Limpadores de Couro (MLB271174), Lubrificantes (MLB392346), Outros (MLB263725), Panos (MLB263727), Polidor (MLB263728), Removedores de Arranhões (MLB430584), Seladores (MLB392348), Shampoo para Carros (MLB431864), Tratamentos (MLB363814).

| Produto | Categoria sugerida (API) | Observação |
|---|---|---|
| Shampoo automotivo | MLB431864 Shampoo para Carros (domínio VEHICLE_SHAMPOOS) | Confirmado pelo `domain_discovery` |
| Cera | MLB263726 Ceras (VEHICLE_WAXES) | Confirmado |
| Boina/pad | MLB433258 Boinas (VEHICLE_POLISHING_PADS) | Confirmado |
| Toalha microfibra, aplicador de espuma | MLB263727 Panos (CLEANING_CLOTHS) | Confirmado |
| Aromatizante | MLB271614 Fragrâncias (VEHICLE_AIR_FRESHENERS) | Confirmado |
| Pretinho / renovador de pneus e plásticos | MLB429409 Abrilhantadores (VEHICLE_BRIGHTENERS). "Revitalizador de plásticos" foi sugerido em MLB363814 Tratamentos. | Confirmado |
| Vitrificador / coating | MLB363814 Tratamentos (VEHICLE_COATING_PRODUCTS; tipo "Cerâmico/Vitrificador") | Confirmado |
| Desengraxante | MLB270872 Desengraxantes (VEHICLE_DEGREASERS) | Confirmado |
| APC / limpador multiuso, pincel de detalhamento, escova de roda | MLB263725 Outros (CLEANING_SUPPLIES) | Sugestão da API. Escova também pode cair em MLB264060 (Casa). Prefira manter em Limpeza Automotiva. |
| Luva de lavagem | MLB271161 Luvas para Limpeza (CLEANING_GLOVES) | Sugestão da API |
| **Polidor / composto de polimento** | **Atenção:** a API sugeriu MLB188789 Politriz Elétricas, e a categoria "Polidor" MLB263728 é na verdade o domínio ELECTRIC_POLISHERS (exige `POWER_SUPPLY_TYPE`). | Candidatas para o composto: MLB430584 Removedores de Arranhões (VEHICLE_SCRATCH_REMOVERS) ou MLB363814 Tratamentos. **Não confirmado.** Validar no preditor de categoria ao anunciar. |
| **Selante de pintura** | A API sugeriu MLB456076 Selantes (**selante de pneu**), o que está errado para esse produto. | Usar MLB392348 Seladores (domínio CLEANING_SUPPLIES) ou MLB363814 Tratamentos. **Não confirmado.** |

### 2.2 Atributos por categoria (API pública `GET /categories/{id}/attributes`, 28/09/2026)
Tags da API: `required` = sempre obrigatório. `catalog_required` = obrigatório para ficha ou publicação de catálogo. `conditional_required` = obrigatório conforme regra; no caso do GTIN, fica obrigatório se a marca já tiver ≥ 30 GTINs publicados, e o `EMPTY_GTIN_REASON` só é aceito quando não há GTIN. `hidden` = não aparece no formulário, mas é aceito pela API. `read_only` = preenchido pelo ML.
Além disso, **todas as categorias abaixo trazem, ocultos:** `SELLER_SKU` (opcional; recomendado usar o SKU interno), `ITEM_CONDITION`, `PACKAGE_WEIGHT` (read_only), `HAZMAT_TRANSPORTABILITY` (read_only: Livre/Limitado/Excedido/Indeterminado[/Notificado]) e `IS_FLAMMABLE` (read_only, exceto em Ceras, onde é editável). Em várias categorias de químicos também aparecem os atributos ANVISA (`ANVISA_PRIOR_NOTIFICATION_COMMUNICATION_DOCUMENT_NUMBER`, `ANVISA_PRODUCT_REGISTRATION_NUMBER`) e `INMETRO_CERTIFICATION_REGISTRATION_NUMBER`.

#### Shampoo automotivo — `MLB431864` (Acessórios para Veículos > Limpeza Automotiva > Shampoo para Carros)

Domínio de catálogo: `MLB-VEHICLE_SHAMPOOS` · max_title_length=200 · max_pictures_per_item=12 (var: 10) · condições aceitas: new · preço mínimo: R$ 8

| Atributo (id) | Nome | Status na API | Observação |
|---|---|---|---|
| `BRAND` | Marca | **obrigatório** (required) + obrigatório p/ catálogo (catalog_required) |  |
| `MODEL` | Modelo | obrigatório p/ catálogo (catalog_required) |  |
| `UNIT_VOLUME` | Volume da unidade | recomendado (opcional na API) | unidades: L, cc, gal, mL |
| `GTIN` | Código universal de produto | recomendado (opcional na API) | pode ir por variação |
| `ANVISA_PRIOR_NOTIFICATION_COMMUNICATION_DOCUMENT_NUMBER` | Número do documento de Notificação/Comunicação prévia na Anvisa | recomendado (opcional na API) |  |
| `ANVISA_PRODUCT_REGISTRATION_NUMBER` | Número de registro de produto na Anvisa | recomendado (opcional na API) |  |
| `SELLER_SKU` | SKU | recomendado (opcional na API) | oculto no formulário; pode ir por variação |
| `IS_FLAMMABLE` | É inflamável | não enviável — preenchido pelo ML | oculto no formulário; read_only (definido pelo ML) |

#### Cera automotiva — `MLB263726` (Acessórios para Veículos > Limpeza Automotiva > Ceras)

Domínio de catálogo: `MLB-VEHICLE_WAXES` · max_title_length=200 · max_pictures_per_item=12 (var: 10) · condições aceitas: used, not_specified, new · preço mínimo: R$ 8

| Atributo (id) | Nome | Status na API | Observação |
|---|---|---|---|
| `BRAND` | Marca | **obrigatório** (required) + obrigatório p/ catálogo (catalog_required) |  |
| `LINE` | Linha | recomendado (opcional na API) |  |
| `MODEL` | Modelo | **obrigatório** (required) + obrigatório p/ catálogo (catalog_required) |  |
| `PART_NUMBER` | Número de peça | recomendado (opcional na API) |  |
| `COLOR` | Cor | recomendado (opcional na API) |  |
| `UNIT_VOLUME` | Volume da unidade | recomendado (opcional na API) | unidades: L, mL |
| `UNIT_WEIGHT` | Peso da unidade | recomendado (opcional na API) | unidades: g, kg, lb |
| `ANVISA_PRIOR_NOTIFICATION_COMMUNICATION_DOCUMENT_NUMBER` | Número do documento de Notificação/Comunicação prévia na Anvisa | recomendado (opcional na API) |  |
| `ANVISA_PRODUCT_REGISTRATION_NUMBER` | Número de registro de produto na Anvisa | recomendado (opcional na API) |  |
| `EMPTY_GTIN_REASON` | Motivo de GTIN vazio | **condicional** (conditional_required) | oculto no formulário; pode ir por variação; valores: O produto é uma peça artesanal; O produto é um kit ou pack; O produto não tem código cadastrado; Outro motivo |
| `IS_FLAMMABLE` | É inflamável | recomendado (opcional na API) |  |
| `GTIN` | Código universal de produto | **condicional** (conditional_required) | pode ir por variação |
| `SELLER_SKU` | SKU | recomendado (opcional na API) | oculto no formulário; pode ir por variação |

#### Boina/pad de polimento — `MLB433258` (Acessórios para Veículos > Limpeza Automotiva > Boinas)

Domínio de catálogo: `MLB-VEHICLE_POLISHING_PADS` · max_title_length=200 · max_pictures_per_item=12 (var: 10) · condições aceitas: used, not_specified, new · preço mínimo: R$ 8

| Atributo (id) | Nome | Status na API | Observação |
|---|---|---|---|
| `BRAND` | Marca | obrigatório p/ catálogo (catalog_required) |  |
| `MODEL` | Modelo | obrigatório p/ catálogo (catalog_required) |  |
| `IS_SET` | É set | obrigatório p/ catálogo (catalog_required) |  |
| `COLOR` | Cor | recomendado (opcional na API) |  |
| `UNITS_PER_PACK` | Quantidade de unidades | **condicional** (conditional_required) |  |
| `MATERIAL` | Material | recomendado (opcional na API) | ex.: Pano, Esponja |
| `DIAMETER` | Diâmetro | recomendado (opcional na API) | unidades: ", cm, ft, m, mm |
| `GTIN` | Código universal de produto | recomendado (opcional na API) | pode ir por variação |
| `SELLER_SKU` | SKU | recomendado (opcional na API) | oculto no formulário; pode ir por variação |
| `IS_FLAMMABLE` | É inflamável | não enviável — preenchido pelo ML | oculto no formulário; read_only (definido pelo ML) |

#### Toalha microfibra / aplicador (Panos) — `MLB263727` (Acessórios para Veículos > Limpeza Automotiva > Panos)

Domínio de catálogo: `MLB-CLEANING_CLOTHS` · max_title_length=200 · max_pictures_per_item=12 (var: 10) · condições aceitas: used, not_specified, new · preço mínimo: R$ 8

| Atributo (id) | Nome | Status na API | Observação |
|---|---|---|---|
| `BRAND` | Marca | **obrigatório** (required) + obrigatório p/ catálogo (catalog_required) |  |
| `MODEL` | Modelo | recomendado (opcional na API) |  |
| `COLOR` | Cor | recomendado (opcional na API) | permite variações |
| `UNITS_PER_PACKAGE` | Quantidade de panos por pacote | recomendado (opcional na API) |  |
| `UNITS_PER_PACK` | Quantidade de pacotes | **condicional** (conditional_required) |  |
| `ANVISA_PRIOR_NOTIFICATION_COMMUNICATION_DOCUMENT_NUMBER` | Número do documento de Notificação/Comunicação prévia na Anvisa | recomendado (opcional na API) |  |
| `ANVISA_PRODUCT_REGISTRATION_NUMBER` | Número de registro de produto na Anvisa | recomendado (opcional na API) |  |
| `EMPTY_GTIN_REASON` | Motivo de GTIN vazio | **condicional** (conditional_required) | oculto no formulário; pode ir por variação; valores: O produto é uma peça artesanal; O produto é um kit ou pack; O produto não tem código cadastrado; Outro motivo |
| `MATERIAL` | Material | recomendado (opcional na API) | ex.: Algodão, Microfibra |
| `GTIN` | Código universal de produto | **condicional** (conditional_required) | pode ir por variação |
| `SELLER_SKU` | SKU | recomendado (opcional na API) | oculto no formulário; pode ir por variação |
| `IS_FLAMMABLE` | É inflamável | não enviável — preenchido pelo ML | oculto no formulário; read_only (definido pelo ML) |

#### Aromatizante automotivo — `MLB271614` (Acessórios para Veículos > Limpeza Automotiva > Fragrâncias)

Domínio de catálogo: `MLB-VEHICLE_AIR_FRESHENERS` · max_title_length=200 · max_pictures_per_item=12 (var: 10) · condições aceitas: used, not_specified, new · preço mínimo: R$ 8

| Atributo (id) | Nome | Status na API | Observação |
|---|---|---|---|
| `BRAND` | Marca | **obrigatório** (required) + obrigatório p/ catálogo (catalog_required) |  |
| `AIR_FRESHENER_FORMAT` | Formato | **obrigatório** (required) + obrigatório p/ catálogo (catalog_required) | ex.: Papel, Clipe para saída de ar, Membrana, Spray, Gel, Pendente |
| `MODEL` | Modelo | recomendado (opcional na API) |  |
| `PART_NUMBER` | Número de peça | **obrigatório** (required) + obrigatório p/ catálogo (catalog_required) |  |
| `COLOR` | Cor | recomendado (opcional na API) | permite variações |
| `UNITS_PER_PACK` | Quantidade de aromatizantes | **condicional** (conditional_required) |  |
| `VEHICLE_TYPE` | Tipo de veículo | **obrigatório** (required) + obrigatório p/ catálogo (catalog_required) | valor fixo; ex.: Carro/Caminhonete |
| `GTIN` | Código universal de produto | recomendado (opcional na API) | pode ir por variação |
| `EMPTY_GTIN_REASON` | Motivo de GTIN vazio | **condicional** (conditional_required) | oculto no formulário; pode ir por variação; valores: O produto é uma peça artesanal; O produto é um kit ou pack; O produto não tem código cadastrado; Outro motivo |
| `ANVISA_PRIOR_NOTIFICATION_COMMUNICATION_DOCUMENT_NUMBER` | Número do documento de Notificação/Comunicação prévia na Anvisa | recomendado (opcional na API) |  |
| `ANVISA_PRODUCT_REGISTRATION_NUMBER` | Número de registro de produto na Anvisa | recomendado (opcional na API) |  |
| `SELLER_SKU` | SKU | recomendado (opcional na API) | oculto no formulário; pode ir por variação |
| `IS_FLAMMABLE` | É inflamável | não enviável — preenchido pelo ML | oculto no formulário; read_only (definido pelo ML) |

#### Pretinho / renovador de pneus e plásticos (Abrilhantadores) — `MLB429409` (Acessórios para Veículos > Limpeza Automotiva > Abrilhantadores)

Domínio de catálogo: `MLB-VEHICLE_BRIGHTENERS` · max_title_length=200 · max_pictures_per_item=12 (var: 10) · condições aceitas: used, not_specified, new · preço mínimo: R$ 8

| Atributo (id) | Nome | Status na API | Observação |
|---|---|---|---|
| `BRAND` | Marca | **obrigatório** (required) + obrigatório p/ catálogo (catalog_required) |  |
| `MODEL` | Modelo | **obrigatório** (required) + obrigatório p/ catálogo (catalog_required) |  |
| `PART_NUMBER` | Número de peça | **obrigatório** (required) + obrigatório p/ catálogo (catalog_required) |  |
| `COLOR` | Cor | recomendado (opcional na API) | permite variações |
| `UNIT_VOLUME` | Volume da unidade | recomendado (opcional na API) | unidades: L, gal, mL |
| `UNIT_WEIGHT` | Peso da unidade | recomendado (opcional na API) | unidades: g, kg, oz |
| `VEHICLE_TYPE` | Tipo de veículo | **obrigatório** (required) | valor fixo; ex.: Carro/Caminhonete |
| `GTIN` | Código universal de produto | recomendado (opcional na API) | pode ir por variação |
| `EMPTY_GTIN_REASON` | Motivo de GTIN vazio | **condicional** (conditional_required) | oculto no formulário; pode ir por variação; valores: O produto é uma peça artesanal; O produto é um kit ou pack; O produto não tem código cadastrado; Outro motivo |
| `ANVISA_PRIOR_NOTIFICATION_COMMUNICATION_DOCUMENT_NUMBER` | Número do documento de Notificação/Comunicação prévia na Anvisa | recomendado (opcional na API) |  |
| `ANVISA_PRODUCT_REGISTRATION_NUMBER` | Número de registro de produto na Anvisa | recomendado (opcional na API) |  |
| `SELLER_SKU` | SKU | recomendado (opcional na API) | oculto no formulário; pode ir por variação |
| `IS_FLAMMABLE` | É inflamável | não enviável — preenchido pelo ML | oculto no formulário; read_only (definido pelo ML) |

#### Vitrificador / coating (Tratamentos) — `MLB363814` (Acessórios para Veículos > Limpeza Automotiva > Tratamentos)

Domínio de catálogo: `MLB-VEHICLE_COATING_PRODUCTS` · max_title_length=200 · max_pictures_per_item=12 (var: 10) · condições aceitas: used, not_specified, new · preço mínimo: R$ 8

| Atributo (id) | Nome | Status na API | Observação |
|---|---|---|---|
| `BRAND` | Marca | **obrigatório** (required) + obrigatório p/ catálogo (catalog_required) |  |
| `LINE` | Linha | recomendado (opcional na API) |  |
| `MODEL` | Modelo | **obrigatório** (required) + obrigatório p/ catálogo (catalog_required) |  |
| `COLOR` | Cor | recomendado (opcional na API) |  |
| `UNIT_WEIGHT` | Peso da unidade | recomendado (opcional na API) | unidades: g, kg, lb, oz |
| `UNIT_VOLUME` | Volume da unidade | recomendado (opcional na API) | unidades: fl oz, L, cc, mL |
| `GTIN` | Código universal de produto | recomendado (opcional na API) | pode ir por variação |
| `ANVISA_PRIOR_NOTIFICATION_COMMUNICATION_DOCUMENT_NUMBER` | Número do documento de Notificação/Comunicação prévia na Anvisa | recomendado (opcional na API) |  |
| `ANVISA_PRODUCT_REGISTRATION_NUMBER` | Número de registro de produto na Anvisa | recomendado (opcional na API) |  |
| `EMPTY_GTIN_REASON` | Motivo de GTIN vazio | **condicional** (conditional_required) | oculto no formulário; pode ir por variação; valores: O produto é uma peça artesanal; O produto é um kit ou pack; O produto não tem código cadastrado; Outro motivo |
| `SELLER_SKU` | SKU | recomendado (opcional na API) | oculto no formulário; pode ir por variação |
| `IS_FLAMMABLE` | É inflamável | não enviável — preenchido pelo ML | oculto no formulário; read_only (definido pelo ML) |

#### Outras categorias pertinentes (apenas os atributos com tags de obrigatoriedade)

| Categoria | Obrigatórios / condicionais retornados pela API |
|---|---|
| MLB270872 Desengraxantes | `BRAND` (required+catalog), `PART_NUMBER` (required+catalog), `VEHICLE_TYPE` (required), `UNITS_PER_PACK` (cond.), `EMPTY_GTIN_REASON` (cond.) |
| MLB263725 Outros (APC, pincéis, escovas) | `BRAND` (required+catalog), `PRODUCT_NAME` (required+catalog), `UNITS_PER_PACK` (cond.), `GTIN` (cond.), `EMPTY_GTIN_REASON` (cond.) |
| MLB392348 Seladores | `BRAND`, `PRODUCT_NAME` (required+catalog), `UNITS_PER_PACK`, `GTIN`, `EMPTY_GTIN_REASON` (cond.) |
| MLB430584 Removedores de Arranhões | `BRAND`, `MODEL`, `VEHICLE_TYPE` (required+catalog), `UNITS_PER_PACK`, `EMPTY_GTIN_REASON` (cond.) |
| MLB271174 Limpadores de Couro | `BRAND`, `PRODUCT_NAME` (required+catalog), `UNITS_PER_PACK`, `GTIN`, `EMPTY_GTIN_REASON` (cond.) |
| MLB271161 Luvas para Limpeza | `UNITS_PER_PACK` (cond.), `GTIN` (cond.) |
| MLB263728 Polidor (= politrizes) | `BRAND`, `MODEL`, `POWER_SUPPLY_TYPE` (required+catalog), `GTIN` (cond.). **Não serve para composto químico.** |

`UNITS_PER_PACK` (condicional) fica obrigatório quando `SALE_FORMAT` = "Kit". Essa é a lógica usual do ML, mas a regra exata **não foi confirmada** porque a rota `technical_specs/input` exige token.

### 2.3 Campos do item (POST `/items`) e regras gerais

| Campo / regra | Status | Detalhe | Fonte |
|---|---|---|---|
| `category_id` | **Obrigatório** | ID pré-estabelecido | https://developers.mercadolivre.com.br/pt_br/publicacao-de-produtos (atualizada em 09/01/2026) |
| `title` | **Obrigatório** no modelo antigo. **No modelo User Products, não envie `title`: use `family_name`.** | Estrutura: **Produto + Marca + Modelo + especificações** (ex.: "Shampoo Automotivo Vonixx V-Floc 1,5 L"). Não citar frete, parcelamento, devolução, novo/usado, a palavra "estoque" (gera moderação) nem marcas de terceiros (exceto "compatível com"). Cores diferentes vão como variações. O limite vem de `max_title_length` da categoria: **a API retornou 200 para todas as categorias consultadas**, enquanto o exemplo da doc mostra 60. | publicacao-de-produtos; https://developers.mercadolivre.com.br/pt_br/user-products (atualizada em 17/06/2026) |
| `family_name` (User Products) | Condicional: vendedores com a tag `user_product_seller` | Até o `max_title_length` do domínio. Itens com os mesmos atributos `PARENT_PK` são agrupados na mesma família. | user-products |
| `price` + `currency_id` (`BRL`) | **Obrigatório** | Preço mínimo da categoria: R$ 8 em todas as consultadas (`settings.minimum_price`) | publicacao-de-produtos; API `/categories` |
| `available_quantity` | **Obrigatório** | `settings.stock = required` | API `/categories` |
| `buying_mode` (`buy_it_now`) | **Obrigatório** | — | publicacao-de-produtos |
| `listing_type_id` (ex.: `gold_special` Clássico, `gold_pro` Premium) | **Obrigatório** | A lista `/sites/MLB/listing_types` **exige token** | publicacao-de-produtos |
| `condition` | **Obrigatório** | Shampoo (MLB431864) aceita **somente `new`**. As demais aceitam new/used/not_specified. | publicacao-de-produtos; API |
| `pictures` | **Obrigatório** na prática, para a maioria dos tipos de anúncio | Até 12 por item e 10 por variação nas categorias consultadas | API `/categories` |
| `attributes` | **Obrigatório** conforme as tags acima | — | https://developers.mercadolivre.com.br/pt_br/atributos (atualizada em 08/06/2026) |
| `sale_terms` (garantia, `MANUFACTURING_TIME`) | Recomendado / condicional | O FAQ de dimensões diz que `MANUFACTURING_TIME` não pode ser nulo quando enviado (0 = disponível imediatamente). A rota `/categories/{id}/sale_terms` **exige token**. | https://developers.mercadolivre.com.br/pt_br/itens-atributos-de-envio-e-dimensoes (atualizada em 14/08/2026) |
| Dimensões e peso do pacote (`SELLER_PACKAGE_HEIGHT/WIDTH/LENGTH/WEIGHT`) | **Obrigatório para Mercado Envios** na prática | Strings numéricas sem unidade: cm e **gramas inteiras**. Informe a embalagem real. Divergência gera cobrança da diferença de frete (T&C de Envios, item 4.5). | itens-atributos-de-envio-e-dimensoes; https://www.mercadolivre.com.br/ajuda/1004 |
| `description` (plain_text) | Recomendado | Até 50.000 caracteres (`max_description_length`) | API `/categories` |
| `SELLER_SKU` | Recomendado | Atributo oculto, pode ir por variação | API |

### 2.4 GTIN / EMPTY_GTIN_REASON / catálogo
Fonte: https://developers.mercadolivre.com.br/pt_br/identificadores-de-produtos (atualizada em 29/12/2025) e https://developers.mercadolivre.com.br/pt_br/elegibilidade-de-catalogo (29/12/2025)

- GTIN com tag `required`: **obrigatório sempre**.
- GTIN com `conditional_required` (Ceras, Panos, Outros, Seladores, Limpadores de Couro, Polidor, Luvas): **priorize enviar o GTIN**. Ele passa a ser **obrigatório se a marca já tiver ≥ 30 GTINs publicados** (erro 7810 `item.attribute.missing_conditional_required`). Quando o produto não tem GTIN, envie `EMPTY_GTIN_REASON`, que aceita: "O produto é uma peça artesanal", "O produto é um kit ou pack", "O produto não tem código cadastrado" e "Outro motivo".
- Em Shampoo, Boinas, Fragrâncias, Abrilhantadores e Tratamentos, a API marcou o GTIN **sem tag de obrigatoriedade**. Ele é **recomendado**, porque melhora a busca e é pré-requisito prático para associar ao catálogo.
- **Catálogo:** só entram publicações elegíveis (tag `catalog_listing_eligible`) e com `condition: new`. Os atributos `catalog_required` (em geral `BRAND`, `MODEL`/`PART_NUMBER`/`PRODUCT_NAME`, `IS_SET` em Boinas, `AIR_FRESHENER_FORMAT` e `VEHICLE_TYPE` em Fragrâncias) precisam estar preenchidos. Associe ao catálogo quando existir ficha (`catalog_product_id`) do mesmo produto com o mesmo GTIN. **A consulta de fichas (`/products/search`) e a elegibilidade exigem token de vendedor.** Não confirmei se algum desses domínios tem publicação obrigatória em catálogo (`catalog_listing_required`), porque isso depende de token.

### 2.5 Fotos
| Regra | Status | Fonte |
|---|---|---|
| JPG/JPEG/PNG, até 10 MB, RGB | **Obrigatório** (formato) | https://developers.mercadolivre.com.br/pt_br/trabalhar-com-imagens (atualizada em 24/03/2026) |
| **Mínimo 500 × 500 px**; recomendado 1200 × 1200; máximo aproveitado 1920 × 1920. Largura acima de 800 px ativa o zoom. | **Obrigatório** (mín.) / Recomendado | trabalhar-com-imagens; https://www.mercadolivre.com.br/ajuda/Como-tirar-boas-fotos-dos-seus-produtos_1320 |
| **Fundo branco digital** na foto de capa. Só "Moda" e "Casa e Móveis" podem usar fundo em contexto. | **Obrigatório** (a Ajuda diz "Suas fotos devem ter um fundo totalmente branco") | Ajuda _1320 |
| Produto centralizado ocupando ~95% da imagem, foto quadrada, nítida | Recomendado | Ajuda _1320; trabalhar-com-imagens |
| Sem marca d'água, logotipo, textos, etiquetas do ML ("Full", "Mais vendido"), dados de envio ou da empresa | **Obrigatório**. Moderação `WATERMARK` e tag `poor_quality_thumbnail`. | https://developers.mercadolivre.com.br/pt_br/moderacoes-de-imagens (21/07/2025); Ajuda _1320 |
| Somente o produto anunciado (não mostrar vários juntos). Embalagem ou contexto só a partir da 2ª foto. | **Obrigatório** / Recomendado | Ajuda _1320 |

### 2.6 Químicos, inflamáveis e regulatórios
| Regra | Status | Fonte |
|---|---|---|
| **Saneantes** (limpeza em geral, desinfecção, tira-manchas etc.) precisam estar regularizados na Anvisa. **Risco 1: notificação. Risco 2: registro obrigatório** (pH ≤ 2 ou ≥ 11,5; corrosivos; antimicrobianos; ácidos HF/HNO3/H2SO4). Sem regularização, o produto não pode ser anunciado. | **Obrigatório** | https://vendedores.mercadolivre.com.br/nota/como-cumprir-as-normas-da-anvisa-e-evitar-o-cancelamento-do-seu-anuncio |
| O anúncio deve trazer o **número de registro/notificação** ou a indicação de que o produto está regularizado. Use os atributos `ANVISA_*` quando existirem. | **Obrigatório** | mesma nota |
| Se shampoo, APC, desengraxante e similares se enquadram como saneante: **não confirmado caso a caso**. Depende da formulação e do enquadramento do fabricante na Anvisa. | Não confirmado | — |
| **Full:** proibido enviar "produtos inflamáveis, explosivos, aerossóis, corrosivos e/ou tóxicos" e "produtos sem certificação e/ou autorização na Anvisa, Anatel, INMETRO…". Se o ML identificar, retira a opção Full e pausa o anúncio. | **Obrigatório** (restrição logística) | https://www.mercadolivre.com.br/ajuda/5200; https://www.mercadolivre.com.br/ajuda/produtos-Inflamaveis_3704 |
| `HAZMAT_TRANSPORTABILITY` e `IS_FLAMMABLE` são definidos pelo ML (read_only) e condicionam os modos de envio. Coating com solvente e aerossóis tendem a "Limitado/Excedido". Os critérios exatos **não foram confirmados**. | Não confirmado | API `/categories/{id}/attributes` |
| Envio de perigosos fora do Full (coleta, agência, Flex): o artigo "Como posso enviar produtos perigosos?" existe na Ajuda, mas o conteúdo não carregou sem sessão. **Não confirmado.** | Não confirmado | Ajuda _3704 (link interno) |

---

## 3. Shopee Brasil

### 3.1 Campos de cadastro (Open Platform `v2.product.add_item`, spec pública consultada em 28/09/2026)
Fonte: https://open.shopee.com/documents/v2/v2.product.add_item?module=89&type=1 (dados obtidos da rota pública de documentação `open.shopee.com/opservice/api/v1/doc/api/?version=2&api_name=v2.product.add_item`). O changelog mais recente é de **01/09/2026: "Condition is required for BR"**.

| Campo | Status | Regra |
|---|---|---|
| `item_name` (nome) | **Obrigatório** | Limites min/max por categoria em `get_item_limit.item_name_length_limit`. **Valor numérico não confirmado** (exige conta). |
| `description` | **Obrigatório** (com `description_type=normal`) | Limites em `item_description_length_limit`. **Valor não confirmado.** A descrição estendida com imagens é restrita a vendedores em whitelist. |
| `original_price` | **Obrigatório** | Faixa em `price_limit` |
| `category_id` | **Obrigatório** | — |
| `image.image_id_list` | **Obrigatório** | Upload via `v2.media_space.upload_image`: JPG/JPEG/PNG, **até 10 MB cada**, "image number should be less than 9" por chamada. A proporção padrão é 1:1 (3:4 só em whitelist). A quantidade min/max por item vem de `item_image_count_limit`: **não confirmado**, mas a Central indica 9 fotos, o que também não foi confirmado. |
| `weight` (kg) | **Obrigatório** na API | `get_item_limit.weight_limit.weight_mandatory` indica a obrigatoriedade por categoria |
| `dimension` (`package_length/width/height`, cm inteiros) | **Condicional** | Obrigatório quando `dimension_limit.dimension_mandatory = true` na categoria. O frete é calculado sobre peso e dimensões informados pelo vendedor. |
| `logistic_info` | **Obrigatório** | Canais habilitados (`logistic_id`, `enabled`) |
| `condition` | **Obrigatório no BR** (desde 01/09/2026) | `NEW`/`USED` |
| `attribute_list` | **Condicional** | Deve conter **todos os atributos obrigatórios da categoria** (`v2.product.get_attribute_tree` / `get_attributes`, que **exigem autorização da loja**) |
| `brand` (`brand_id`, `original_brand_name`) | Condicional / recomendado | "No Brand" quando não houver marca. A obrigatoriedade varia por categoria (não confirmado). |
| `gtin_code` | **Condicional** conforme `gtin_validation_rule` da categoria | **Mandatory**: GTIN válido obrigatório. **Flexible**: GTIN ou `"00"` (sem GTIN). **Optional**: pode omitir. |
| `item_sku` | Recomendado | SKU interno |
| `tax_info` (BR: `ncm` 8 dígitos ou "00", `cest` 7 dígitos ou "00", `origin`, `same_state_cfop`/`diff_state_cfop`, `csosn`, `measure_unit`, `group_item_info` para kits/fardos etc.) | Recomendado / condicional (emissão de NF-e pela Shopee) | NCM de referência para químicos automotivos (ex.: 3405.30.00 para preparações para conservação de carroçarias) é **sugestão minha**; valide com a contabilidade. |
| Variações (`init_tier_variation`) | Condicional | Até 2 níveis (ex.: Volume × Fragrância). Cada opção tem preço, estoque e SKU; a imagem por opção é opcional. Fonte: https://help.shopee.com.br/portal/4/article/76405 |
| `compatibility_info` (veículos) | Opcional | Relevante só para peças |

### 3.2 Fotos, título e descrição (Central de Educação)
Os artigos oficiais existem: "Boas práticas de fotos para anúncios" (https://seller.shopee.com.br/edu/article/2822), "Benefícios de adicionar imagens em proporção 3:4" (https://seller.shopee.com.br/edu/article/17369), "Guia de categorias e atributos" (https://seller.shopee.com.br/edu/article/16384) e "Como cadastrar pesos e medidas" (https://seller.shopee.com.br/edu/article/18796). **O conteúdo não pôde ser lido sem sessão**, porque o site é renderizado só via JavaScript e a API exige login. Por isso ficam **não confirmados**: resolução mínima de foto, quantidade máxima de fotos, limites de caracteres de título e descrição, e regras de fundo. Com a conta, os valores exatos por categoria saem de `v2.product.get_item_limit`.

### 3.3 Envio: limites de peso e tamanho
| Regra | Status | Fonte |
|---|---|---|
| Agência Shopee / pontos SPX: **maior lado ≤ 120 cm, soma dos lados ≤ 200 cm, peso ≤ 30 kg** | **Obrigatório** | https://help.shopee.com.br/portal/4/article/198296 ; https://help.shopee.com.br/portal/4/article/148797 |
| O frete é calculado com base no peso e nas dimensões informados pelo vendedor. Informação incorreta pode gerar cobrança divergente de tarifa. | **Obrigatório** informar corretamente | https://help.shopee.com.br/portal/4/article/76332 ; https://help.shopee.com.br/portal/4/article/124091 (Termos do Programa de Logística) |
| A Shopee pode recusar no transporte itens classificados como "material perigoso, artigos proibidos ou restringidos" | **Obrigatório** | article/124091 |
| Limite de 70 × 70 × 70 cm por pacote (citado em busca) | **Não confirmado** | https://seller.shopee.com.br/edu/article/3305 (não legível sem sessão) |

### 3.4 Produtos proibidos e restritos relevantes (Política de Produtos Proibidos e Restritos)
Página-mãe: https://help.shopee.com.br/portal/4/article/76226 (renderizada via JS). As subseções abaixo foram lidas diretamente.

| Seção | Proibido | Permitido | Impacto para detailing |
|---|---|---|---|
| 9.1 Explosivos (https://help.shopee.com.br/portal/4/article/174108) | Explosivos, fogos, cilindros de gás | "Aerossóis como desodorante, protetor solar, anti-pulgas, spray de grafite **de até 500 gramas**" | Aerossóis (pretinho spray, limpa-contato, aromatizante spray): **somente até 500 g por unidade**. Estender essa regra a aerossóis automotivos é interpretação minha; a política cita exemplos, não uma lista fechada. |
| 9.2 Inflamáveis (https://help.shopee.com.br/portal/4/article/174109) | Álcool 70%, álcool metílico, isopropano, gás de maçarico, carbureto, nitrocelulose etc. | Acetona 60%, thinner, cola de contato | Coatings e removedores à base de **IPA (álcool isopropílico)** exigem atenção: o painel de IPA (prep de pintura) provavelmente é proibido se for álcool isopropílico puro ou concentrado. Não confirmado para diluições. |
| 9.3 Tóxicos e nocivos (https://help.shopee.com.br/portal/4/article/174110) | Benzeno e solventes industriais altamente cancerígenos, metanol, ácido fluorídrico e sulfúrico, ácido muriático, inseticidas | — | Removedores ácidos de ferrugem ou de chuva ácida e limpadores de roda com HF são **proibidos**. |
| 8.2 Artigos de cuidados com a casa (https://help.shopee.com.br/portal/4/article/174073) | Soda cáustica, ácidos (clorídrico, nítrico, sulfúrico, fluorídrico), **removedor de ferrugem**, álcool > 70% | "Desinfetantes e limpadores multiuso comuns"; removedores de manchas domésticos | APC comum: permitido. Desengraxantes muito alcalinos (soda) ou "descontaminantes férricos" (iron remover): **risco de enquadramento como proibido**. Não confirmado. |
| 5.x Automóveis | Combustíveis; água destilada/desmineralizada > 1 L por unidade | Óleos e lubrificantes/aditivos **com número de registro ANP** | Aditivos e lubrificantes exigem ANP. Citado em resultado de busca da política; não li o artigo direto. |

---

## 4. Resumo por tipo de produto (matriz prática)

| Produto | Google (GPC · identificadores) | Mercado Livre (categoria · obrigatórios) | Shopee (atenção) |
|---|---|---|---|
| Shampoo automotivo | 2590 · `brand` + `gtin` (EAN) ou `mpn`/`identifier_exists` | MLB431864 · `BRAND` (req), `MODEL` (catálogo). Só `condition=new`. Anvisa se for saneante. | Atributos da categoria + GTIN conforme a regra |
| Cera / selante | 2643 | MLB263726 Ceras · `BRAND`, `MODEL` (req), GTIN/`EMPTY_GTIN_REASON` (cond.), `IS_FLAMMABLE` editável. Selante: MLB392348 ou MLB363814 (não confirmado). | Aerossol ≤ 500 g |
| APC / limpador multiuso | 2590 | MLB263725 Outros · `BRAND`, `PRODUCT_NAME` (req), GTIN/`EMPTY_GTIN_REASON` (cond.) | "Limpadores multiuso comuns": permitido |
| Desengraxante | 2590 | MLB270872 · `BRAND`, `PART_NUMBER`, `VEHICLE_TYPE` (req) | Alcalinos fortes (soda): verificar 8.2 |
| Pretinho / renovador | 2643 | MLB429409 · `BRAND`, `MODEL`, `PART_NUMBER`, `VEHICLE_TYPE` (req) | Versão spray ≤ 500 g |
| Aromatizante | 2789 (Odorizadores para carro) | MLB271614 · `BRAND`, `AIR_FRESHENER_FORMAT`, `PART_NUMBER`, `VEHICLE_TYPE` (req) | Spray ≤ 500 g |
| Vitrificador / coating | 2643 | MLB363814 · `BRAND`, `MODEL` (req). Provável restrição hazmat (solventes) e sem Full. | Solventes/IPA: verificar 9.2 e 9.3 |
| Polidor / composto | 2643 | MLB430584 ou MLB363814 (**não usar MLB263728**, que é politriz) | — |
| Boina / pad | 2895 (ou 1225) | MLB433258 · sem `required`. `BRAND`, `MODEL`, `IS_SET` (catálogo); `UNITS_PER_PACK` (cond.) | Peso e dimensões |
| Microfibra / aplicador | 2895 (ou 8071) | MLB263727 Panos · `BRAND` (req), GTIN/`EMPTY_GTIN_REASON` (cond.), variação por `COLOR` | Variação cor/tamanho |
| Luva de lavagem | 2895 | MLB271161 · `GTIN`, `UNITS_PER_PACK` (cond.) | — |
| Pincéis / escovas | 2894 | MLB263725 Outros · `BRAND`, `PRODUCT_NAME` (req) | — |

## 5. O que exige conta ou token de vendedor (não verificado aqui)
- **Mercado Livre:** `/categories/{id}/technical_specs/input` (regras condicionais exatas), `/categories/{id}/sale_terms`, `/sites/MLB/listing_types`, `/products/search` (fichas de catálogo), elegibilidade de catálogo (`catalog_listing_eligible`), POST `/items`, diagnóstico de imagens, e o conteúdo da Ajuda "Como posso enviar produtos perigosos?".
- **Shopee:** `v2.product.get_item_limit` (limites de título, descrição, fotos, obrigatoriedade de peso e dimensão, regra de GTIN por categoria), `v2.product.get_attribute_tree` / `get_brand_list` (atributos e marcas obrigatórios por categoria), canais logísticos (`v2.logistics.get_channel_list`), e o conteúdo da Central de Educação do Vendedor.
- **Google:** nada da especificação exige conta. Validação de feed, frete e devolução da conta e diagnósticos ficam no Merchant Center.

## 6. Principais fontes
- Google: https://support.google.com/merchants/answer/7052112?hl=pt-BR · https://support.google.com/merchants/answer/6324350 · https://support.google.com/merchants/answer/6324415 · https://support.google.com/merchants/answer/6324468 · https://support.google.com/merchants/answer/6324461 · https://support.google.com/merchants/answer/6324484 · https://support.google.com/merchants/answer/6324503 · https://support.google.com/merchants/answer/4752265 · https://developers.google.com/search/docs/appearance/structured-data/merchant-listing · https://www.google.com/basepages/producttype/taxonomy-with-ids.pt-BR.txt
- Mercado Livre: https://api.mercadolibre.com/sites/MLB/domain_discovery/search?q=… · https://api.mercadolibre.com/categories/{MLB431864|MLB263726|MLB433258|MLB263727|MLB271614|MLB429409|MLB363814|MLB270872|MLB263725|MLB271161|MLB263728|MLB392348|MLB430584|MLB271174}/attributes · https://developers.mercadolivre.com.br/pt_br/publicacao-de-produtos · …/atributos · …/identificadores-de-produtos · …/user-products · …/trabalhar-com-imagens · …/moderacoes-de-imagens · …/itens-atributos-de-envio-e-dimensoes · …/elegibilidade-de-catalogo · https://www.mercadolivre.com.br/ajuda/Como-tirar-boas-fotos-dos-seus-produtos_1320 · https://www.mercadolivre.com.br/ajuda/5200 · https://www.mercadolivre.com.br/ajuda/produtos-Inflamaveis_3704 · https://www.mercadolivre.com.br/ajuda/1004 · https://vendedores.mercadolivre.com.br/nota/como-cumprir-as-normas-da-anvisa-e-evitar-o-cancelamento-do-seu-anuncio
- Shopee: https://open.shopee.com/documents/v2/v2.product.add_item?module=89&type=1 · https://open.shopee.com/documents/v2/v2.product.get_item_limit?module=89&type=1 · https://open.shopee.com/documents/v2/v2.media_space.upload_image · https://help.shopee.com.br/portal/4/article/76226 · …/174108 · …/174109 · …/174110 · …/174073 · …/198296 · …/124091 · …/76332 · …/76405
