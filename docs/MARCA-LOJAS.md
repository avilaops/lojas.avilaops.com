# Marca Lojas: manual de identidade da plataforma

Este é o manual da marca **da plataforma** (Lojas por Avila Ops). A identidade
de cada loja de cliente é outro assunto e está em
[IDENTIDADE-VISUAL.md](IDENTIDADE-VISUAL.md).

Versão viva, com os desenhos e os arquivos para baixar:
`https://lojas.avilaops.com/marca`.

## 1. Ideia

> Um toldo para cada negócio.

Toda loja de rua tem o seu toldo. O da Lojas tem as três cores da Avila Ops
(azul, vermelho, amarelo) e a porta fica aberta embaixo dele. A plataforma
assina pouco e cede a cor, a letra e a vitrine para a marca do lojista. Isso
mantém a decisão de 30/08/2026: nenhuma cor da plataforma domina a página.

## 2. Símbolo e logotipo

| Peça | Arquivo | Quando usar |
|---|---|---|
| Logotipo | `public/media/marca/lojas-logo.svg` (+ `.png`) | Cabeçalho e rodapé do site, documentos, apresentações |
| Logotipo negativo | `lojas-logo-negativo.svg` (+ `.png`) | Sobre a tinta ou foto escura |
| Símbolo | `lojas-simbolo.svg` (+ `.png`) | Onde a palavra não cabe: avatar, carimbo |
| Símbolo monocromático | `lojas-simbolo-mono.svg` | Dentro de loja de cliente, sobre foto, gravação em uma cor |
| Palavra | `lojas-palavra.svg` | Só quando o símbolo já aparece por perto |
| Ícone do aplicativo | `lojas-icone-app.svg` e `public/media/lojas/*` | Favicon, tela de início, manifesto |

Construção (grade 64 × 64, traço 6):

- **Toldo**: três faixas, nessa ordem — azul, vermelho, amarelo. É o elo com
  o símbolo da Avila Ops.
- **Fachada**: um traço só, mesma espessura das letras; lê a 16 px.
- **Porta em arco**: aberta, a loja está funcionando.
- **Palavra**: "lojas" em minúsculas, desenhada em traço redondo, sem fonte por
  trás. O pingo do j é o vermelho do toldo.

No código há um componente só, `src/components/marca/MarcaLojas.tsx`
(`MarcaLojas`, `LogoLojas`, `SimboloLojas`). Fachada, porta e letras usam
`currentColor`, então a mesma marca serve no fundo claro e no escuro. Não
desenhe o logo de novo em CSS nem copie o SVG para outro componente.

Respiro: a largura de uma faixa do toldo em volta. Tamanho mínimo: logotipo
com 24 px de altura; símbolo com 16 px.

## 3. Cores

Tokens em `src/app/plataforma/marca-lojas.css` (prefixo `--lj-`), importado
pelos layouts do site e do painel.

| Token | Hex | Uso |
|---|---|---|
| `--lj-tinta` | `#16130F` | Texto, botão principal, lateral do painel, cena escura |
| `--lj-tinta-2` | `#24201B` | Superfície elevada sobre a tinta |
| `--lj-tinta-suave` | `#6A6259` | Texto de apoio (5,7:1 sobre o papel) |
| `--lj-papel` | `#FBF8F4` | Fundo do site |
| `--lj-papel-2` | `#F3EFE8` | Faixas alternadas, rodapé |
| `--lj-linha` | `#E6DFD4` | Bordas |
| `--lj-azul` | `#0153FD` | Toldo e interação: link, foco, seleção (5,7:1 sobre branco) |
| `--lj-vermelho` | `#F72927` | Toldo e pingo do j. Não é cor de erro |
| `--lj-amarelo` | `#FDC403` | Toldo. Nunca texto sobre fundo claro |
| `--lj-ok` / `--lj-alerta` / `--lj-erro` | `#0F7A4A` / `#9A6400` / `#C4231F` | Estados |
| `--lj-faixa` | gradiente em três blocos | Barras de progresso e divisórias de marca |

As três cores do toldo são tempero: nunca fundo de seção inteira. A cor das
páginas do site vem dos negócios mostrados em cada cena (`.pl-tom-*`).

## 4. Letras

- **Inter** em toda a interface. Títulos 700 com espaçamento apertado
  (`letter-spacing` ≈ -0,035em), texto 400, preço e estoque 600.
- **Serifa de vitrine** (`--lj-fonte-vitrine`: Iowan Old Style, Palatino,
  Georgia) só para nome de marca dentro das cenas e exemplos.

## 5. Aplicações

| Superfície | Regra |
|---|---|
| Site, estúdio, ajuda, blog | Papel e tinta; logo com endosso "por Avila Ops" no cabeçalho e rodapé; páginas escuras usam a tinta, não azul-marinho |
| Painel do lojista | Lateral na tinta, área clara; o topo é da loja (nome e inicial); a plataforma assina no rodapé da lateral, em uma cor; azul só no que se clica |
| Loja do cliente e checkout | Tudo vem de `Tenant.tema`; Lojas aparece uma vez, no selo monocromático "Loja por Avila Ops" do rodapé |
| Ícones e compartilhamento | Favicon e manifesto em `public/media/lojas/`; imagem de compartilhamento em `src/app/plataforma/opengraph-image.tsx` |

## 6. Não faça

- Trocar a ordem ou as cores do toldo, ou pintá-lo com a cor de um cliente.
- Escrever "lojas" digitado em outra fonte no lugar do logotipo.
- Usar azul, vermelho ou amarelo como fundo de seção inteira.
- Pôr a marca Lojas maior que a do lojista em qualquer tela da loja dele.
- Usar o símbolo da Avila Ops (`public/media/avilaops/`) como ícone da plataforma:
  ele é da casa; o da plataforma é o toldo.

## 7. Regerar os PNG

Os PNG saem dos SVG com o `sharp` que já é dependência do projeto:

```bash
node -e 'require("sharp")("public/media/marca/lojas-logo.svg",{density:600}).resize({height:512}).png().toFile("public/media/marca/lojas-logo.png")'
```
