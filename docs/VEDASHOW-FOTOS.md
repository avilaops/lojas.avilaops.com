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
110 são de item sem preço ou sem estoque).

> **Correção de 02/09/2026.** Eu disse duas vezes que "117 dos 2.114 vendáveis
> têm foto na loja". Estava errado: a loja tinha **zero**. Os 117 existiam no
> banco da Vedashow (`product_image`), mas o `exportar_loja.py` nunca preencheu
> o campo `imagens`, então nada chegou à vitrine. O número só apareceu ao
> conferir a cobertura depois de subir as ilustrações. Vincular esses 109 ao
> catálogo continua pendente, e agora é a tarefa mais barata da fila.

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

## Política de imagem da plataforma (02/09/2026)

O erro do `gra/3792` — imagem plausível, produto errado — virou regra de
código, porque ele vai reaparecer na PartsAgrícola e em todo catálogo técnico.
Catálogo técnico tem incentivo forte para reaproveitar foto: todo rolamento
6200 se parece. Reaproveitar **pode** ser honesto; fingir que a foto é do SKU
exato não é.

`Produto.imagemOrigem` declara o que a imagem é:

| Valor | O que é | A vitrine |
|---|---|---|
| `propria` | foto do SKU exato (própria, ou do fabricante com código conferido) | nada a dizer |
| `representativa` | foto de outro item da mesma família visual | avisa: "Imagem representativa da série. Confira as medidas e especificações deste produto." |
| `ilustracao` | desenho gerado das medidas reais do cadastro | avisa que é ilustração, não fotografia |

Duas travas, na entrada **e** no banco:

- `representativa` exige `imagemFamilia` (a série de que herdou). Sem isso não
  há como achar quem usa a foto no dia em que ela for trocada, e a imagem de
  uma peça errada se espalha pelo catálogo sem rastro.
- Declarar origem sem imagem nenhuma é recusado: o aviso apareceria na vitrine
  sem foto para justificar.

A trava do `imagemFamilia` é `CHECK` no Postgres, não só validação de schema —
provado em produção. Nenhum caminho de escrita (importação, painel, SQL na
mão) consegue gravar imagem herdada sem dizer de onde ela veio.

**O que continua proibido**: associar imagem por coincidência de id ou de SKU
numérico. Imagem externa só entra com fabricante **e** part number conferidos.

## Como isso muda a fila

O levantamento acima trata "1.997 produtos sem foto" como um problema só. São
quatro, e separá-los corta o esforço sem custar confiança:

1. **Precisa de fotografia** — correia e mangueira (71 itens): formas
   diferentes entre si, sem família visual que ajude. É a sessão de meio dia.
2. **Pode usar foto de família** — rolamento (470): mesma construção, muda a
   dimensão. Inventariar as famílias (`6200`, `6300`, `32000`, `UC`, `UCP`)
   e fotografar uma por família **e por construção**: mudou vedação, flange,
   gaiola ou acabamento, é outra família, não a mesma com outro número.
3. **Funciona melhor como ilustração** — retentor (881): 881 anéis pretos
   fotografados dão 881 fotos quase idênticas. Um desenho a partir de
   `diametroInternoMm × diametroExternoMm × alturaMm`, que **já estão no
   cadastro**, informa mais que a foto e não mente, desde que apareça como
   ilustração.
4. **Pode vir do fabricante** — quando houver fonte oficial FAG/NSK/Timken com
   part number, e só com o código conferido.

**Sobre priorizar por valor em estoque**: é a proxy certa hoje, e só hoje. A
loja abriu sem histórico, então valor parado é o único sinal disponível. Assim
que houver pedido, a fila deve pesar giro e margem junto — um item de R$ 500
parado há três anos merece menos foto que um de R$ 100 que sai toda semana.
Vale montar o score quando o dado existir, não antes: hoje ele seria
valor-em-estoque com etapas a mais.

### O que não vale a pena

Raspar mais catálogo de fornecedor. Já foram três, renderam 4.830 arquivos e
**nenhum** produto novo com foto, porque quem vende lona não vende retentor
com o mesmo código. O próximo fornecedor teria o mesmo problema.
