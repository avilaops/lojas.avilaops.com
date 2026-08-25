# Identidade visual de uma loja — briefing para quem vai personalizar

Este documento é para quem vai criar a identidade visual de uma loja da
plataforma (designer, ChatGPT, agência). Ele diz exatamente **o que dá para
mudar**, em que formato, e como entregar para entrar no ar sem código.

Regra da plataforma: **o layout é fixo; o que muda são tokens, textos e imagens.**
Não existe CSS por loja, não existe HTML por loja. Isso é proposital — é o que
mantém a loja rápida, barata e igual em todos os aparelhos.

## 1. O que pode ser definido

### Tokens (aba Aparência do painel, ou JSON abaixo)

| Campo | Valores | Observação |
|---|---|---|
| `corPrimaria` | hex `#rrggbb` | Botões, preços em destaque, chips, faixa do layout Clássico |
| `corPrimariaTexto` | hex | Texto sobre a cor primária (branco ou preto, conforme contraste) |
| `corFundo` | hex (opcional) | Fundo da página; se omitido, branco (claro) ou `#0b0b0c` (escuro) |
| `corTexto` | hex (opcional) | Texto principal |
| `modo` | `claro` \| `escuro` | Define superfícies, bordas e o checkout |
| `fonte` | `sistema` \| `inter` \| `poppins` \| `montserrat` \| `playfair` | Só estas cinco (Google Fonts já liberadas) |
| `raio` | `reto` \| `suave` \| `redondo` | Cantos de botões, cards e campos |
| `layout` | `classico` \| `vitrine` \| `editorial` \| `minimal` | Composição da página inicial (ver §3) |

### Imagens (enviadas pelo painel — botões "Enviar…")

| Imagem | Formato | Tamanho recomendado | Onde aparece |
|---|---|---|---|
| Logo | PNG transparente ou SVG | altura ≥ 120 px, largura livre | Cabeçalho (36 px de altura), JSON-LD |
| Banner | JPG/WEBP | 1600×600 (Clássico/Vitrine) ou 1200×900 (Editorial) | Topo da home; recebe um escurecimento de 45% no Clássico/Vitrine para o texto ler |
| Foto de produto | JPG/WEBP/PNG | 1000×1000, fundo branco ou neutro | Card (quadrado, `object-cover`) e página do produto |
| Imagem de categoria | JPG/WEBP | 800×450 (16:9) | Só no layout Editorial |

Limite: 5 MB por arquivo. PNG/JPG/WEBP/GIF/SVG. Tudo é servido de `https://lojas.avilaops.com/uploads/<loja>/…`.

### Textos

| Campo | Limite | Onde |
|---|---|---|
| `nome` | 80 | Cabeçalho (se não houver logo), título das páginas, rodapé |
| `slogan` | 140 | H1 da home, `<title>` e descrição no Google |
| `sobre` | 4000, parágrafos separados por linha em branco | Página /sobre; primeiro parágrafo aparece na home (Editorial e Clássico) |
| `horario` | 140 | Rodapé e /contato |
| Descrição curta do produto | 300 | Card e meta description |
| Descrição do produto | 8000 | Página do produto |

**Não editáveis por loja** (padrão da plataforma): políticas de envio, devolução e privacidade (geradas a partir dos dados da loja e do CDC/LGPD), rodapé "Loja por Avila Ops", estrutura das páginas.

## 2. Como entregar

**Opção A — pelo painel:** `https://lojas.avilaops.com/painel` → aba **Aparência**
(cores, fonte, cantos, layout, slogan, logo, banner) e aba **Produtos** (fotos, categorias com imagem).

**Opção B — JSON, colado na aba Aparência → "Colar identidade (JSON)":**

```json
{
  "tema": { "corPrimaria": "#c62828", "corPrimariaTexto": "#ffffff", "modo": "claro", "fonte": "montserrat", "raio": "suave", "layout": "editorial" },
  "slogan": "Vedações industriais com entrega no mesmo dia",
  "sobre": "Há 20 anos em Ribeirão Preto…\n\nSegundo parágrafo.",
  "logoUrl": "https://lojas.avilaops.com/uploads/vedashow/logo.svg",
  "bannerUrl": "https://lojas.avilaops.com/uploads/vedashow/banner.jpg"
}
```

Só as chaves presentes são alteradas (merge). `logoUrl`/`bannerUrl` precisam ser
URLs públicas — o mais simples é enviar as imagens pelo painel primeiro e usar
as URLs que ele devolve.

**Opção C — API (Avila Ops / n8n):** `PATCH /api/admin/tenants/<slug>` com o mesmo JSON, `Authorization: Bearer <LOJAS_ADMIN_TOKEN>`.

## 3. Os quatro layouts, em uma frase

- **Clássico** — faixa na cor primária com slogan; categorias em cartões; 8 destaques em 4 colunas. Neutro, funciona para tudo.
- **Vitrine** — banner de ponta a ponta com o slogan em cima; chips de categoria; 12 produtos. Pede banner e fotos boas.
- **Editorial** — slogan e texto à esquerda, imagem à direita; categorias com foto (16:9); 6 destaques grandes; bloco "Sobre" na cor primária. Pede banner e imagem por categoria.
- **Minimal** — sem banner; slogan centralizado; categorias como links; 9 produtos em 3 colunas. Para catálogo pequeno e fotos fortes.

## 4. Checklist de entrega de uma identidade

- [ ] Cor primária com contraste AA contra `corPrimariaTexto` (botões legíveis)
- [ ] Fonte escolhida entre as cinco
- [ ] Logo em PNG transparente/SVG, legível a 36 px de altura
- [ ] Banner no tamanho do layout escolhido, com área "calma" para o slogan
- [ ] Fotos de produto quadradas, mesmo fundo em todas
- [ ] Slogan ≤ 140 caracteres, sem ponto final, com a promessa da loja
- [ ] Texto "Sobre" em 2–4 parágrafos
- [ ] JSON final validado (colar no painel; ele recusa campo inválido)
