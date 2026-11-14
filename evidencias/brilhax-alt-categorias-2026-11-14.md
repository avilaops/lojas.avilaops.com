# Texto alternativo das capas de categoria da Brilhax

Verificação em 14/11/2026. Demanda `BRILHAX-ALT-CATEGORIA-20261114`.

O Bing Webmaster Tools apontou uma ocorrência de texto alternativo ausente em
`https://brilhax.com/categoria/produtos-para-moto`. O HTML público apresentava
`alt=""` na capa `categoria-moto-v2.webp`; as imagens do produto possuíam
descrições. O componente `src/components/CapaCategoria.tsx` fixava esse valor
vazio. O cabeçalho tem identificação acessível no link da marca e não foi alterado.

A correção usa `alt={nome}` no componente compartilhado. A seleção entre imagem
da categoria, foto de produto e inicial da categoria foi preservada.

- [PR #244](https://github.com/avilaops/lojas.avilaops.com/pull/244), integrado em
  `cfbfce0adc835724b94cfb50ed8dc47227aa5e9d`.
- [CI do PR](https://github.com/avilaops/lojas.avilaops.com/actions/runs/43563202976)
  aprovada para `ded2d0d14c2a8918513321f002431fb9463435c4`.
- Revisão independente sem achados. Nenhum teste ou build executado localmente.
- [CI de produção](https://github.com/avilaops/lojas.avilaops.com/actions/runs/43563706198)
  aprovada, incluindo backup, publicação no Render e smoke da origem.
- Release pública no `/api/health` da Brilhax:
  `cfbfce0adc835724b94cfb50ed8dc47227aa5e9d-43563706198-1`, HTTP 200 e banco `ok`.

| URL pública | HTTP | Texto alternativo da capa |
| --- | --- | --- |
| `/categoria/produtos-para-moto` | 200 | `Produtos para Moto` |
| `/categoria/lavagem` | 200 | `Lavagem` |

A primeira verificação após publicação falhou porque a rota de um arquivo
inexistente retornou 503. A mesma requisição, repetida manualmente na origem,
retornou o 404 esperado. Somente o job de confirmação/smoke foi reexecutado;
a segunda tentativa passou. Não houve nova publicação nem flexibilização do check.

As duas URLs verificadas foram enviadas a `api.indexnow.org/indexnow` e a
`www.bing.com/indexnow`; ambos responderam HTTP 200. Isso confirma recebimento,
sem comprovar novo rastreamento ou a retirada do aviso no painel do Bing.

Limitação separada: os originais históricos `categoria-moto-v2.webp`,
`logo-limpa-20260927.png` e `mtv7bzmt-14f40ac3.webp` responderam 404 nas consultas
diretas. A ausência de mídias antigas já consta na demanda de recuperação do
Render; restaurar esses arquivos não faz parte da alteração de texto alternativo.
