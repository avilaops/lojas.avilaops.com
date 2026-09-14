# Catálogo Brilhax no Lojas — atualização de 12/09/2026

## Resultado confirmado em produção

- 224 cadastros reconciliados com o snapshot anterior, sem divergências em relação às alterações planejadas.
- 102 cadastros receberam complementos ou correções de conteúdo.
- 47 produtos antes sem foto passaram a ter imagem. Foram acrescentados 48 vínculos de imagem; duas fotos pertencem à mesma toalha.
- **Todos os 79 produtos ativos agora têm pelo menos uma foto.** Antes, 17 ativos não tinham foto.
- 10 GTINs ausentes preenchidos a partir de apresentações identificadas no catálogo do fornecedor, com dígito verificador conferido.
- 4 marcas corrigidas conforme os rótulos: Alumax para Vintex; Lamax, Ox Pro e Spell Car para Nitro.
- 64 descrições alteradas/completadas e 102 descrições curtas preenchidas. A quantidade de cadastros sem descrição caiu de 153 para 107.
- Os 165 endereços distintos de fotos presentes no catálogo responderam como imagens válidas na conferência HTTP pública.
- IDs, slugs, nomes, SKUs internos, preços, promoções, disponibilidade, estoque, categorias e estado ativo/inativo preservados.
- Nenhuma escrita no Medusa. Nenhum produto inativo foi ativado.

| Fotos por cadastro | Antes | Depois |
| --- | ---: | ---: |
| Sem foto | 142 | 95 |
| Exatamente uma | 55 | 101 |
| Duas ou mais | 27 | 28 |

Conferência dos dados: 12/09/2026 01:31:50, horário de Brasília. Conferência de disponibilidade das fotos: 01:34:09.
O teste HTTP prova disponibilidade, não enquadramento ou qualidade visual. As imagens novas foram conferidas visualmente; as imagens preexistentes não receberam uma auditoria visual integral.

## O que impede completar todo o catálogo

Os **95 cadastros ainda sem foto estão inativos**. Por marca cadastrada: Nitro 30; Würth 21; Vintex 16; Bugatti 11; Vonixx 10; Detailer 6; marca incorretamente preenchida como “Limpador Multiuso Concentrado” 1.

A pasta fornecida contém coleta de Wolf Pads, Vonixx, Zacs e Detailer, sem catálogo de Nitro, Würth e Bugatti. Há páginas de categoria, modelos semelhantes, embalagens não especificadas e descrições contaminadas na coleta. Esses registros não foram usados para atribuir fotos por aproximação.

Ainda faltam:

- Fotos exatas ou identificação da apresentação dos 95 cadastros inativos.
- Descrição em 107 cadastros e descrição curta em 122.
- GTIN em 146 cadastros, ou confirmação documentada de que o produto realmente não possui identificador.
- Confirmação de 4 GTINs inválidos: dois pincéis com números incompatíveis com o dígito verificador; V-Floc 1,5 L e Vexus 1,5 L com URLs de QR code no campo GTIN.
- Preço de venda em 142 cadastros com preço zero. Preço do fornecedor não foi convertido em preço de venda da Brilhax.
- Peso e dimensões individuais de embalagem nos 224 cadastros. Volume do líquido não equivale ao peso embalado. O cálculo atual de frete pode usar os padrões configurados da loja/plataforma; estes não foram substituídos por estimativas.
- Decisão da loja sobre controle de estoque: os 224 cadastros usam estoque nulo, que significa quantidade não controlada no sistema atual, não estoque zero.

**Não é correto preencher todas as colunas indiscriminadamente.** Promoção, código original, equivalências, compatibilidade e imagem de família são opcionais ou dependem do tipo de produto. Campos de sistema são gerados, não enriquecidos por scraping.

## Situação das 31 colunas atuais

| Colunas | Tratamento |
| --- | --- |
| id, tenantId, criadoEm | Identidade e auditoria do sistema; preservados. |
| atualizadoEm, busca | Atualizados automaticamente pela API/banco. |
| nome, slug, sku | Preservados para não quebrar identificação, URLs ou integrações. |
| marca | Correção de quatro casos com rótulo conferido; um valor descritivo ainda exige confirmação. |
| categoriaId | Preservada; revisão semântica de categorias ainda não foi executada. |
| descricao, descricaoCurta | Complementadas quando sustentadas por fonte; textos comerciais antigos não foram reescritos globalmente. |
| gtin | Dez valores ausentes preenchidos; quatro valores inválidos existentes sinalizados, sem substituição por suposição. |
| imagens | Fotos ausentes preenchidas; acervo anterior preservado. |
| imagemOrigem, imagemFamilia | Imagens confirmadas cadastradas como próprias do produto, sem associação genérica de família. “Própria” aqui é o escopo do produto, não autoria da fotografia. |
| atributos | Volume, diâmetro, composição e dados pertinentes quando confirmados; fontes em chaves internas iniciadas por underscore. |
| precoCentavos, precoDeCentavos | Preservados; o segundo é opcional, utilizado para comparação/promoção. |
| estoque, disponibilidade | Preservados; não importados da disponibilidade do fabricante. |
| pesoKg, alturaCm, larguraCm, comprimentoCm | Aguardam medidas reais da embalagem para expedição. |
| ativo, destaque | Decisões comerciais preservadas. |
| opcoes | Array vazio válido para produto simples. Nenhuma grade criada em produção nesta rodada de dados. |
| codigoOriginal, codigosEquivalentes, compatibilidade | Não preencher sem aplicação e fonte específicas. Em muitos químicos/acessórios não se aplicam. |

## Arquivos de evidência e retomada

- `pendencias-por-produto.csv`: 224 linhas, uma por cadastro, com fotos, GTIN, pendências e origem quando disponível.
- `brilhax-catalogo.json`: snapshot anterior das 31 colunas.
- `brilhax-catalogo-final.json`: snapshot final das 31 colunas; `brilhax-catalogo-depois.json` é apenas o checkpoint intermediário dos dois primeiros lotes.
- `brilhax-resultado-esperado.json`: estado de conteúdo final reconciliado; datas de atualização neste arquivo não representam o horário final de gravação.
- `verificacao-producao.json`: contagem e reconciliação integral após as gravações.
- `verificacao-fotos.json`: disponibilidade das 165 URLs distintas.
- `plano-wolf-publicar.json`, `plano-vonixx-zacs-publicar.json`, `plano-acervo-existente.json`, `plano-gtin-confirmados.json`, `plano-complemento-final.json`: lotes por ID e campos explícitos.
- Os dois primeiros lotes registram a chave de origem inicial `catalogoFonte`. Em seguida, `scripts/proteger-metadados-fontes-brilhax.cjs` a moveu para `_catalogoFonte`, para mantê-la fora da ficha pública.
- `fornecedores-indice.json`, `fornecedores-detalhes-ampliados.json`, `fontes-complementares.json`, `fontes-detailer-revisadas.json`: registros consultados na coleta.
- `../playwright/brilhax-producao.png`: fotografia e ficha verificadas na página pública de uma boina.

As imagens baixadas foram armazenadas no volume de uploads da Brilhax, com nomes estáveis derivados do conteúdo. Os arquivos originais da pasta do usuário foram preservados. Fotos de produtos repetidos foram reutilizadas somente após conferência da apresentação; os cadastros não foram mesclados.

## Próximo insumo necessário

Usar a lista por produto para obter fotos/rótulos dos itens restantes e a tabela comercial da Brilhax, com preços, decisão de controle de estoque e peso/medidas para envio. Confirmar apresentações ambíguas como V-80, V-Paint, ceras Blend sem formato claro, pincéis sem modelo e acessórios genéricos.

A padronização estrutural do software permanece **local, não publicada**. Esta rodada publicou dados compatíveis com o esquema atual. Ver `docs/CATALOGO-PADRONIZADO.md` para os testes e as etapas ainda não entregues da nova arquitetura.
