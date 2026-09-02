# Vedashow em lojas.avilaops.com — análise e plano

> Levantamento de 02/09/2026. Base: container `vedashow_pg` (5.591 produtos),
> plataforma `lojas.avilaops.com` (Next 16, multi-tenant) e a integração de
> Mercado Livre já commitada (`6c1c375`, `dd6f9f6`, `9d5ca1e`).

## 1. O que já existe

A Vedashow não começa do zero em nenhuma das três frentes.

| Frente | Estado |
|---|---|
| Catálogo | Banco pronto, normalizado, enriquecido e auditável (`vedashow/README.md`) |
| Loja | Plataforma multi-tenant no ar; criar loja é um POST, não um projeto |
| Mercado Livre | Conexão OAuth, callback, notificações e **preparo** prontos |

O que **não** existe: a publicação em si. `prepararCatalogo` classifica cada
produto em PRONTO / REVISÃO / BLOQUEADO e grava em `AnuncioMercadoLivre`, mas
nenhum código chama `POST /items`. É a lacuna real, e é pequena perto do que
está feito.

## 2. O achado que muda o plano

**Dos 5.591 produtos, 2.114 são vendáveis hoje** (preço > 0 **e** estoque > 0).
Os outros 3.477 são cadastro de referência: preço zerado, estoque zerado, ou
os dois.

Três números que decidem o sequenciamento:

| Fato | Número | Consequência |
|---|---|---|
| Produtos com foto | **232** (4%) | 96% do catálogo não tem imagem |
| Código de barras / GTIN | **0** | Nenhum produto tem GTIN preenchido |
| Marca "DIVERSOS" | 3.452 (62%) | Marca ausente, não marca genérica |
| Preço mediano | **R$ 13,80** | 1.304 dos vendáveis custam menos de R$ 20 |

Dois desses são bloqueio duro no Mercado Livre, não preferência:

- **Sem foto, não publica.** O ML exige ao menos uma imagem. Isso limita a
  publicação a 232 produtos no melhor caso, e só se eles também forem
  vendáveis.
- **Sem GTIN, o anúncio existe mas afunda.** `EMPTY_GTIN_REASON` resolve
  formalmente (o preparo já trata isso), porém sem código de barras o item
  não entra no catálogo do ML e perde a vitrine de comparação.

O terceiro é comercial: **R$ 13,80 de mediana não paga frete.** Um retentor de
R$ 3,20 com envio de R$ 20 não vende avulso em marketplace. O caminho é kit,
lote ou pedido mínimo, e isso é decisão do lojista, não configuração.

> Nota de coerência: `vedashow/text.md` lista categorias de lona, cinta e
> mangueira que **não existem no banco carregado** (o banco é retentor,
> rolamento e vedação). Ou é outra linha de produto ainda não importada, ou é
> resquício de outro levantamento. Precisa de resposta antes de desenhar a
> navegação da loja, porque muda o menu inteiro.

## 3. O melhor jeito: loja primeiro, marketplace depois

Publicar no Mercado Livre antes da loja existir é construir na ordem errada,
por três motivos concretos:

1. **A foto tratada serve aos dois canais.** O pipeline de imagem já existe em
   `vedashow/etl/tratar_imagens.py` (1000×1000, fundo branco). Toda foto feita
   para a loja é a mesma que o ML exige. Fazer imagem "para o ML" é fazer
   duas vezes.
2. **O preparo já roda sem conta conectada.** `prepararCatalogo` diz o que
   falta em cada produto **antes** de qualquer OAuth. Rodar isso cedo dá a
   lista de trabalho; conectar cedo não adianta nada.
3. **232 anúncios não sustentam operação.** A loja mostra 2.114 itens no
   primeiro dia. O ML mostra, no máximo, os 232 com foto — e menos ainda
   depois do filtro de preço.

### Fases

**Fase 1 — a loja no ar — FEITA em 02/09/2026**

`https://vedashow.lojas.avilaops.com` — 2.114 produtos, 40 categorias, tema
navy/laranja tirado do logo, layout `mercado`. O exportador é
`vedashow/etl/exportar_loja.py`; o que ele decide e por quê está no README de
lá. Dois bugs da plataforma apareceram na carga e foram corrigidos junto
(slug repetido derrubava o lote; nome de categoria não era atualizado).

O que ficou pendente e por quê:

- **Foto**: 117 dos 2.114 vendáveis têm imagem. O resto entra com placeholder,
  que a plataforma já trata ("Imagem em preparação"). É a Fase 2.
- **Preço**: revisão do lojista, é a primeira remessa.

**Fase 1 — o desenho original**

- Tenant `vedashow` via `POST /api/admin/tenants` (script `criar-loja.ts`).
  Segmento `geral`; nada de código por loja, conforme `AGENTS.md`.
- Importar só os **2.114 vendáveis**. Os demais ficam no banco de origem: loja
  com 3.477 itens sem preço é loja que parece quebrada.
- Categorias do `Grupo > SubGrupo` já normalizado (RETENTOR 1.982,
  ROLAMENTO 1.197, ANEL 225…), que é hierarquia de verdade, não lista solta.
- Medidas de `v_produto_medidas` viram `atributos` do produto — é o que
  permite o filtro "retentor 40–60 mm", o único jeito de navegar 2.000 peças
  tecnicamente idênticas ao olho.
- Layout `mercado` (catálogo denso, departamentos) é o que cabe nesse volume.

**Fase 2 — imagem, que é o gargalo real**

232 de 2.114 é 11%. Sem atacar isso, nem a loja nem o ML funcionam. Três
fontes, em ordem de custo: cruzamento com mais catálogos de fornecedor (o do
IMDEPA já rendeu 232), foto própria dos itens de maior giro, e placeholder
por categoria para o resto — melhor caixa cinza padronizada que espaço vazio.

**Fase 3 — Mercado Livre**

Só aqui entra o que falta de código: `publicarNoMl`, o botão no painel e a
sincronização de preço/estoque. `AnuncioMercadoLivre` já tem as colunas
(`precoCentavosPublicado`, `estoquePublicado`) exatamente para isso.
Publica-se a lista PRONTO, que a Fase 2 terá aumentado.

## 4. UI: padrão de app, não de site

O pedido é interface no padrão Apple. Vale registrar o que isso significa aqui,
porque a plataforma **já tem** metade do caminho e a outra metade tem regra
escrita.

O que existe: 7 layouts de home, tema por tokens (cor, fonte, raio, modo) e
`--font-sans` já em `-apple-system`.

O que falta, e que a auditoria de `app.avilaops.com/docs/auditoria-mobile-ios.md`
já resolveu para o painel interno — mesmas decisões, aplicadas à loja:

- alturas fixas: linha 52–60 px, botão primário 50 px, campo 48 px, chip 36 px;
- `viewport-fit=cover` + `env(safe-area-inset-bottom)`;
- campo com 16 px de fonte abaixo de 820 px (senão o Safari dá zoom ao focar);
- filtro em folha que sobe do rodapé, não em painel absoluto;
- lista *inset grouped* onde hoje há grade espremida.

Isso é tema e componente compartilhado, nunca `if (slug === "vedashow")`.
Ganha a Vedashow e ganham as outras lojas junto.

## 5. Decisões que dependem do Nicolas

1. **`text.md`**: lona/cinta/mangueira é outra linha de produto a importar, ou
   pode ser descartado?
2. **Preço baixo no marketplace**: kit, lote ou pedido mínimo? Sem isso, os
   itens de R$ 3 não têm como vender no ML.
3. **Foto**: vale fotografar os campeões de giro, ou seguimos só com o que o
   cruzamento de fornecedor entregar?
