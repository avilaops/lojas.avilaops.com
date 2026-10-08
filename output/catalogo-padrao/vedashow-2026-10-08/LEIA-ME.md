# Vedashow: complemento do catálogo em 08/10/2026

Aplicado em produção pela API administrativa (`PUT /api/admin/tenants/vedashow/produtos`).
Nome, preço, estoque, status e fotos não mudaram, salvo onde dito.

| Campo | Antes | Depois |
|---|---:|---:|
| Sem categoria Google | 5.590 | 62 |
| Sem descrição longa | 5.516 | 63 |
| Sem peso | 5.591 | 5.140 |
| Sem categoria da loja | 43 | 0 |

- `patch.json`: categoria Google por prateleira, descrição por tipo de peça (só onde estava vazia)
  e, nos 466 itens que batem com o catálogo da RTL Rolamentos por designação, medidas e peso
  (`rtl_dados.py`, lido de loja.rtlrolamentos.com.br). Peso "440 g" da RTL é valor de preenchimento
  e foi descartado, exceto onde confere com a norma. Medida do cadastro que não é plausível
  (nome com decimal perdido, ex.: "101 6x127x12 7") não entra no texto.
- `vedashow-dossie-diversos-{1,2,3}.json`: 475 itens de ferramentas, mangueiras, elétrica e
  químicos, pesquisados item a item. Aplicados só os de confiança alta e média
  (`patch-diversos.json`): descrição, descrição curta, categoria Google e atributos; nome novo
  só em 20 itens sem dúvida anotada. **Não aplicados:** os 46 de confiança baixa, GTIN, MPN e
  as 13 páginas de foto (ninguém abriu as páginas para conferir). As dúvidas de cada item
  (preço suspeito, duplicado, unidade de venda) estão no campo `duvidas`.
- `patch-resto.json`: descrição das prateleiras pequenas (anéis elásticos, rodas dentadas etc.).
- `../vedashow-transmissao-2026-10-08.json`: os 43 itens Combat, CBT e Vulkan.

Para refazer: `match.py` e `gera_patch.py` leem `veda.json` (export do catálogo) e
`rtl-sitemap.json`; `aplica.mjs <patch>` grava. Estado anterior do catálogo:
`~/.agents/claude/out/2026-10-08-vedashow-catalogo-antes.json` (servidor `creators`).

## Imagens (mesma data)

| | Antes | Depois |
|---|---:|---:|
| Produtos sem imagem | 3.583 | 2.424 |
| Vendáveis (preço e estoque) sem imagem | 1.159 | 941 |

- **Ilustração técnica (979 produtos, 873 desenhos):** O-rings, anéis backup, gaxetas, guias e
  raspadores, pelo gerador de `vedashow.com.br/etl` (`preparar_ilustraveis.py` →
  `gerar_ilustracoes.py`), `imagemOrigem = ilustracao`. `lote.psv` é a seleção. Além das peneiras
  do gerador, só entrou quem tem no nome a mesma medida do cadastro: 105 itens ficaram de fora
  por decimal perdido no nome ("101 6x127x12 7"), em que o desenho sairia com a cota errada.
  Os arquivos `anel_backup-*.png` foram renomeados para `anel-backup-*.png` no servidor: a rota
  de `/uploads` não serve nome com sublinhado.
- **Imagem representativa (180 rolamentos):** rolamento sem foto que tem a mesma designação de
  outro da loja com foto (outra marca) recebeu essa foto como `representativa`, com
  `imagemFamilia` igual à do doador (`repr.json`). É o mesmo critério dos 94 que já existiam.
- Nenhuma imagem veio de site de terceiro.
