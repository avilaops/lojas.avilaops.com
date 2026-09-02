# Vedashow — Fase 2: foto

> Levantamento de 02/09/2026, feito para achar o caminho mais barato até a
> cobertura de imagem. **Conclusão: não existe atalho.** Este documento
> registra por quê, e o que fazer no lugar.

## O que eu esperava encontrar, e não encontrei

`data/imagens_tratadas/` tem **4.830 arquivos** já normalizados (1000×1000,
fundo branco) de quatro origens. Parecia que bastava vincular e enviar.

Não basta. As pastas são nomeadas por id, mas **o id não é o mesmo em todas**:

| Origem | Arquivos | A pasta é id de | Aproveitável |
|---|---:|---|---|
| `imdepa` | 864 | `product` (catálogo próprio) | **sim — já está tudo linkado** |
| `gra` | 3.228 | `supplier_product` (catálogo raspado) | não |
| `ibira` | 704 | `supplier_product` | não |
| `usina` | 34 | `supplier_product` | não |

O erro é fácil de cometer e caro: os intervalos de id se sobrepõem, então
cruzar por número "casa" e devolve 253 produtos, que parece o dobro do que
está no ar. É falso. Conferindo item a item:

```
pasta gra/3792  → fotos de uma CINTA DE ELEVAÇÃO verde
product   3792  → ROL.32108 ATN9 C3   (um rolamento)
```

Publicar isso poria foto de cinta em anúncio de rolamento — pior que anúncio
sem foto, porque vira reclamação e devolução.

**O que dá para aproveitar do que já existe: zero.** As 219 pastas do imdepa
já estão em `product_image`, e delas 109 são de produto vendável (as outras
110 são de item sem preço ou sem estoque). Os 117 no ar já são esse número.

## Por que os catálogos raspados não casam

`supplier_product` tem 406 itens de três fornecedores, e são **outra linha de
produto**: lona, tela, cinta, mangueira. É exatamente a lista do
`vedashow/text.md` que eu tinha estranhado no primeiro levantamento — não era
resquício, é um catálogo real, só que de coisa que a Vedashow ainda não tem
cadastrada no ERP.

Tentativa de casar por código, para registro:

| Chave | Casos |
|---|---:|
| `supplier_product.sku` = `product.reference` | 3 |
| `supplier_product.sku` = `product.legacy_code` | 9 |

Nove em 406. É coincidência numérica, não correspondência.

## Onde o esforço rende mais

Dos 2.114 vendáveis, **1.997 não têm foto**. Ordenando pelo dinheiro parado
em estoque, e não pela quantidade de itens:

| Categoria | Itens sem foto | Valor em estoque | Por item |
|---|---:|---:|---:|
| **Rolamento** | 470 | R$ 120.811 | R$ 257 |
| **Retentor** | 881 | R$ 110.961 | R$ 125 |
| Correia | 37 | R$ 13.407 | R$ 362 |
| Mangueira | 34 | R$ 12.583 | R$ 370 |
| Ferramenta | 69 | R$ 12.044 | R$ 175 |

Duas leituras que mudam a ordem do trabalho:

1. **Rolamento rende o dobro por foto.** São 470 itens contra 881 do retentor,
   guardam mais dinheiro (R$ 120 mil contra R$ 110 mil) e cada foto cobre
   R$ 257 de estoque, contra R$ 125. Fotografar rolamento primeiro é quase
   metade do trabalho pelo mesmo retorno.
2. **Correia e mangueira são as mais rentáveis por item** (R$ 362 e R$ 370),
   e somam só 71 itens. É a tarde de trabalho com melhor relação de todas.

## O que eu recomendo

**Uma sessão de foto, 71 itens, meio dia.** Correia (37) e mangueira (34):
melhor retorno por foto do catálogo inteiro, e volume que cabe numa tarde.

Depois **rolamento por família**. Rolamento tem forma padronizada: um 6204 e um
6205 diferem em milímetros, não em aparência. Uma foto boa por série
(`6200`, `6300`, `32000`…) cobre dezenas de itens com honestidade, desde que a
página mostre a medida real do item — o que a loja já faz, porque a medida está
em `atributos` e aparece na ficha técnica.

**Retentor fica por último**, apesar de ser a maior categoria: 881 itens de
R$ 22 médios, visualmente idênticos entre si. É o pior retorno por hora de
fotógrafo do catálogo.

### O que já está pronto para receber a foto

- `etl/tratar_imagens.py` normaliza qualquer foto nova para 1000×1000 fundo
  branco (é o mesmo padrão que o Mercado Livre exige);
- a plataforma aceita `imagens: []` por produto na importação e tem
  `?importarImagens=1` para baixar de URL;
- a vitrine já trata ausência com "Imagem em preparação", então nada quebra
  enquanto a cobertura sobe.

### O que não vale a pena

Raspar mais catálogo de fornecedor. Já foram três, renderam 4.830 arquivos e
**nenhum** produto novo com foto, porque quem vende lona não vende retentor
com o mesmo código. O próximo fornecedor teria o mesmo problema.
