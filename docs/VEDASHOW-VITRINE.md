# Vedashow — a análise de vitrine, conferida

> 02/09/2026. Resposta a um comparativo com Amazon, Leroy, Magalu, Mercado
> Livre e Shopee. O diagnóstico de fundo está certo; a base de fato estava
> errada, e parte do que faltava já existia.

## Primeiro: a análise olhou o site antigo

As URLs citadas são do Laravel que estava na HostGator até hoje de manhã:

```
vedashow.com.br/detalhe-produto/2408-uc209-rolamento   → 404
vedashow.com.br/loja-grupo-produtos/3                  → 404
```

Esse site saiu do ar quando o domínio passou a apontar para a nossa loja. O
`juntasevedacoes.com.br`, também citado, é outro site da mesma empresa e
segue no ar.

Isso muda as notas, não a direção. **A tese central continua valendo**: em
catálogo técnico, achar a peça certa vale mais que encher a tela de promoção.

## O que já existia na plataforma

Boa parte do "falta" já estava construído, e o comparativo não teria como saber:

| Apontado como ausente | Situação real |
|---|---|
| Filtros | `FiltrosProdutos.tsx` — categoria, marca, faixa de preço, ordenação |
| Ficha técnica | `FichaTecnica.tsx`, alimentada por `Produto.atributos` |
| Avaliações | `Avaliacoes.tsx`, com moderação |
| CEP e frete | `frete.ts`, cálculo por CEP com prazo |
| Estoque | `EstoqueBaixo.tsx` — "últimas unidades" por `Tenant.estoqueBaixoEm` |
| Atendimento | `WhatsAppFlutuante.tsx` |
| Busca sem acento | gatilho no banco desde 26/08 |

O que falta de verdade é **prova social com volume** (as avaliações existem,
não há avaliação), **cross-sell** e **"mais vendidos"** — e os três dependem
de venda acontecendo, não de código.

## O achado que valia a análise inteira

A busca não entendia como a peça é procurada no balcão. Medido no catálogo
real, antes da correção:

| Digitado | Achava | Devia achar |
|---|---:|---:|
| `20x47x14` | **0** | 1 |
| `6205-2rs` | 2 | 6 |
| `rol6205` | **0** | 1 |
| `35x52x8` | **0** | 1 |

Três causas distintas, todas corrigidas:

1. **O separador de medida.** `termosDeBusca` quebrava só por espaço, então
   `20x47x14` virava um token único que não casa com nada. A loja respondia
   "nenhum produto" com o item em estoque **e a medida cadastrada**.
2. **A medida estava fora do índice.** As dimensões entraram em
   `Produto.atributos` na importação, mas o gatilho que monta a coluna `busca`
   não as lia. Agora entram nas duas formas que são digitadas (`20 47 14` e
   `20x47x14`): **788 produtos** ganharam medida pesquisável.
3. **O dígito solto era descartado.** O filtro `length > 1` engolia o `8` de
   `35x52x8`, e a busca trazia todo retentor 35x52 em vez do item pedido.

Também passaram a separar o prefixo de balcão (`ROL6205` → `rol 6205`) e o
hífen do código (`6205-2rs` → `6205 2rs`), porque é assim que o código sai do
sistema do lojista e é assim que o comprador digita.

Isso vale para toda loja da plataforma, não só a Vedashow: é a diferença
entre catálogo técnico que se busca e catálogo que se folheia.

## Onde eu discordo do comparativo

**"Mais vendidos" não é obrigatório agora.** A loja abriu hoje. Uma seção de
mais vendidos com dado inventado é exatamente o que a trava de dados falsos
existe para impedir; com dado real, ela aparece sozinha quando houver venda.

**Prova social não se constrói antes da primeira venda.** As avaliações já
existem no código. O que falta é pedido entregue, e isso é operação.

**Shopee como referência, mesmo que pouco:** concordo em deixar de fora. Cupom
empilhado e frete grátis piscando destroem a credibilidade de quem vende peça
para manutenção industrial, onde errar a peça para a linha de produção.

## O que eu faria em seguida, nesta ordem

1. **Filtro por medida** (faixa de diâmetro interno/externo/altura). A busca
   já acha pela medida exata; o filtro por faixa é o passo seguinte e é o que
   nenhum marketplace generalista faz bem. Os dados já estão em `atributos`.
2. **Card com a medida em destaque.** Hoje o nome carrega a medida no texto;
   ela merece linha própria, porque é o critério de decisão.
3. **Foto** — ver `VEDASHOW-FOTOS.md`. Nada de vitrine compensa card sem foto.
4. **Cross-sell por família** (rolamento → mancal → graxa). Depende de
   relação entre produtos, que o catálogo ainda não tem.

O que **não** faria agora: redesenhar a home. Ela está limpa e o layout
`mercado` já é o certo para 2.114 itens. O gargalo é foto e dado, não desenho.
