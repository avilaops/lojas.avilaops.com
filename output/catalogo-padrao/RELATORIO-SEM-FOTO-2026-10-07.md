# Brilhax: os 95 produtos sem foto, pesquisados para o Merchant Center (07/10/2026)

## O que é isto

Dossiê de complemento dos **95 cadastros da Brilhax sem nenhuma foto**, um por
um, feito em sessão de nuvem em 07/10/2026 a partir do último snapshot local do
catálogo (`brilhax-catalogo-final.json`, 12/09/2026) e da matriz de 28/09.
Arquivos:

| Arquivo | O que tem |
|---|---|
| `brilhax-sem-foto-2026-10-07.json` | uma entrada por produto: nome proposto, marca, descrição curta e longa, categoria da loja, categoria Google (id + caminho, conferidos na taxonomia oficial), GTIN só quando lido em fonte, atributos para a ficha, fontes, página de onde copiar as fotos, confiança e dúvidas |
| `brilhax-sem-foto-2026-10-07.csv` | a mesma lista, para revisão em planilha |
| `scripts/completar-catalogo-sem-foto.mjs` | aplica o dossiê na loja pela API administrativa, copiando as fotos das páginas-fonte |

## Estado de partida (último dado verificado)

- 224 cadastros; **79 ativos, todos com foto** (conferidos em 28/09).
- **95 sem foto, todos inativos (sem preço)**: Nitro 31, Würth 21, Vintex 16,
  Bugatti 11, Vonixx 10, Detailer 6. Destes, 92 sem descrição, 95 sem GTIN.
- O que a produção tem **hoje** não foi lido: esta sessão não alcança
  `brilhax.com` nem `lojas.avilaops.com`. O script começa baixando o catálogo
  atual e só mexe em quem continua sem foto.

## Resultado da pesquisa

| Confiança | Produtos | Significado |
|---|---:|---|
| alta | 45 | produto e apresentação confirmados em página do fabricante ou em dois varejistas |
| média | 34 | produto confirmado; apresentação (volume, numeração, concentração) ou fonte oficial pendente |
| baixa | 16 | nome ambíguo, produto não localizado com esse nome ou marca em dúvida |

- **93 de 95** têm a página de onde as fotos oficiais podem ser copiadas
  (fabricante quando existe, senão o melhor varejista). **Foto exata só nos 44
  de confiança alta** (`fotoExata: true`, apresentação confirmada); nos 34 de
  média a foto entra como representativa, com a família no nome, porque o
  volume ou a numeração em estoque ainda não foi conferido; os de baixa ficam
  sem foto até a decisão do lojista.
- **Kits (00089, 00090)**: sem `volumeMl`, para o Merchant não calcular preço
  por litro de um conjunto de dois produtos diferentes.
- **0 fotos copiadas nesta sessão**: a rede bloqueia o acesso aos sites dos
  fabricantes e varejistas. É o script, rodando na máquina do Nicolas, que lê a
  página-fonte, extrai as imagens (JSON-LD `Product.image`, `og:image`) e manda
  a plataforma copiá-las para `/uploads`.
- **GTIN: 6 confirmados** (os seis marcadores industriais Würth, EAN lido na
  ficha de wurth.com.br) e **13 candidatos** (o Limpa Contato Würth voltou a
  candidato: a base Cosmos não separa a linha padrão da W-Max; (Vintex, Vonixx V-Paint em volume diferente, Solupan e HT7 sem
  marca na base, luva Würth com EAN de outro país, Lava Autos 1,5 L visto só em
  marketplace). Candidato não vai ao feed: fica em `gtinCandidato` para
  conferir na embalagem. Nenhum GTIN foi deduzido. **MPN: 13** lidos em página
  do fabricante (códigos Würth de 10 dígitos; o da espátula 5" ficou como
  candidato porque a página é do kit de 5 e o cadastro é por unidade; o da
  luva nitrílica porque o código é do tamanho nº 7 e o cadastro não define
  tamanho; o do aplicador Vonixx veio de varejista e também é só candidato).
  Harten (Nitro), Bugatti e Detailer não publicam EAN em página indexada: só a
  embalagem resolve.
- **Categoria Google** atribuída aos 95, com id conferido em
  `src/lib/google-product-taxonomy.pt-BR.json`: 2590 (33), 2643 (17), 2895 (9),
  543608 marcadores (7), 2789 odorizadores (6), 2894 (5), 2846 (5) e folhas
  específicas para os itens Würth que não são de limpeza automotiva (luvas
  5591, lanterna 543689, espátulas 1202, epóxi 503742, limpa contato 503741,
  silicone 1753, saca-grampos 8236, anti-deslizante 2788).
- **10 produtos mudam de categoria da loja**: arominhas vão para
  Aromatizantes (estavam em Proteção) e sanitizantes para Lavagem.
- **2 kits montados pela loja** (00089 Higicouro + Hidracouro, 00090 V-Floc +
  V-Mol): sem GTIN, marcados `kit: true`.

## Decisões que são do Nicolas ou do lojista

1. **Marca "Nitro".** Todas as fontes atribuem HT7, Lamax, Acitrox, Altrox,
   Ox-Pro, Revoke, Speel Car, Venon e companhia à **linha Nitro Automotive /
   NitroX da Harten Química** (hartenquimica.com.br), não à Nitro Química. O
   dossiê mantém `marca: "Nitro"` (o que está no rótulo) e põe o fabricante em
   `atributos.fabricante`. Confirmar no rótulo antes de publicar.
2. **Volumes assumidos.** 23 cadastros não dizem a apresentação (Acitrox,
   Carpet, Ferrux, Glass Pro, Split, Rubber Pro, Renovex, Solupan, V-Paint,
   pincéis Vonixx…). Foi escolhida a menor apresentação de varejo e a dúvida
   está anotada item a item.
3. **Nomes que não existem como estão**: Sanitizante Bom Ar (não é Nitro; é
   Vintex), Arominha Spray 200 ml Nitro, Lamax MOL 1,5 L, HT7 1,5 L (fabricante
   vende 500 ml e 1 L), Revoke 5 L e Speel Car 5 L (não encontrados), Limpa Pneus
   Bugatti (o produto localizado é o Pneu Pretinho), Kit limpeza para-brisa Würth
   (não é SKU Würth; é bundle de revendedor), espátula saca-grampos unitária
   (Würth só vende o jogo de 4). Todos com confiança baixa: o script não os
   aplica sem `--incluir-baixa`.
4. **Toalhas Detailer 40x80 e 37x57**: nenhuma Detailer nessas medidas; a única
   40x80 de fabricante é a Vintex 350 GSM. Pedir foto da embalagem.
5. **Marcadores industriais Würth (7 cores)** e **arominhas (aromas)**: podem
   virar variações de um produto só (`item_group_id`) em vez de sete cadastros.

## Como aplicar

```bash
# ensaio: baixa o catálogo atual, resolve as fotos e grava o plano, sem gravar na loja
LOJAS_ADMIN_TOKEN=... node scripts/completar-catalogo-sem-foto.mjs \
  --loja brilhax --dossie output/catalogo-padrao/brilhax-sem-foto-2026-10-07.json

# aplica os de confiança alta e média (os de baixa só com --incluir-baixa)
LOJAS_ADMIN_TOKEN=... node scripts/completar-catalogo-sem-foto.mjs \
  --loja brilhax --dossie output/catalogo-padrao/brilhax-sem-foto-2026-10-07.json --aplicar
```

O script não ativa produto nem mexe em preço, estoque ou destaque. Produto que
ficar sem foto reconhecida na página-fonte recebe só texto e categoria, e sai
listado no `.plano.json` para a foto ser subida à mão pelo painel. Antes de
mexer em dado, dump do banco, como manda o `AGENTS.md`.

Depois de aplicar: conferir no painel (Catálogo › Qualidade) que os itens saíram
de "sem foto", e só então ativar (dar preço) os que a loja de fato vende. Item
inativo não entra no feed nem no sitemap.

## O que ficou de fora e por quê

- Segunda rodada de GTIN (07/10, 50 buscas) cobriu as 78 fichas de confiança
  alta e média: só a Würth expõe EAN em página própria; Vintex, Vonixx, Nitro,
  Bugatti e Detailer não aparecem no Cosmos nem no Systax com a apresentação
  certa. O que falta é leitura da embalagem.
- Leitura direta das páginas dos fabricantes: bloqueada pela rede da sessão.
  As descrições saíram dos trechos que a busca devolveu; o modo de uso que não
  foi lido no fabricante está declarado em `duvidas`.
