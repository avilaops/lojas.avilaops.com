# Revisão dos catálogos — 24/10/2026

## Aplicação verificada

75 produtos atualizados em produção: 50 da Domi-Rio e 25 da VedaShow.
Escrita exclusivamente por `salvarProdutoNoCatalogo`, com versão otimista,
histórico e releitura de cada campo alterado. Preços, estoque e ativação preservados.
Planos anteriores e resultados salvos com acesso restrito no servidor em
`/opt/lojas/backups/revisao-catalogos-20261024/`.
Nova simulação após aplicação: zero alterações pendentes.

- Domi-Rio: apresentações comerciais extraídas de unidades explícitas; fontes
  técnicas internas ocultadas da ficha pública; oito imagens representativas
  recuperadas de produtos da mesma família, com identificação de imagem ilustrativa.
- Três pesos incompatíveis removidos, com pendência de pesagem da embalagem.
- VedaShow: 17 descrições preenchidas e oito emendas de corrente que tinham
  descrição/marca de alicate corrigidas. Foto e identificadores incompatíveis
  removidos; classificação fiscal marcada para revisão.
- Correções técnicas incluem FRB 11,5/100, guia de PTFE 10 × 2,5 mm,
  tampa NBR 47 × 7 e extensão Ilumi 17911.

## Cobertura restante (catálogo completo, incluindo inativos)

| Loja | Produtos | Sem descrição | Sem foto | Sem GTIN | Sem peso | Sem dimensões de envio |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Domi-Rio | 53 | 2 | 5 | 9 | 18 | 53 |
| VedaShow | 5634 | 1 | 2074 | 5569 | 2349 | 2530 |

As descrições não resolvidas são dois produtos Dom Pablo inativos e um produto
VedaShow identificado apenas como KIT (SKU 1556). Exigem identificação física.
GTIN, peso bruto e dimensões de envio não foram inventados nem derivados do
conteúdo líquido. Fontes sem correspondência inequívoca de marca/modelo foram
descartadas. Manifests antigos de fotos não oferecem novas correspondências
seguras simultâneas por SKU, nome e slug; houve evidência de reutilização de SKU.

## Fontes e limites

Pesquisa em páginas oficiais da 3M (Imperial), Vonder (macaco 12 t), Ilumi
(17911), catálogo SKF (FRB) e catálogo Combat disponibilizado pela Engredan.
URLs específicas constam no script e nos atributos privados de revisão.
Uma fonte de família não comprova GTIN, embalagem ou compatibilidade universal.
Dados explícitos do cadastro original foram usados sem adicionar especificações
não confirmadas. Não há promessa de catálogo 100% completo.

## Reexecução

`npx tsx scripts/revisar-catalogos-20261024.ts` simula e salva o plano.
`--apply` aplica o plano após a cópia anterior. `REVISAO_OUTPUT` define a pasta
protegida dos relatórios. Não executar a partir de manifests antigos por SKU.
O script exige nome original revisado para os preenchimentos editoriais.

O PR #129 das melhorias de catálogo/mobile/atendimento já estava integrado
à main nesta conferência; os critérios maiores de seletores, upload e protocolo
permanecem no Linear e não devem ser encerrados por este incremento.
