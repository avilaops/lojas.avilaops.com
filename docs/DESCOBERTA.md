# Descoberta: Google, Bing, ChatGPT e o que cada loja nasce garantindo

Auditado em 10/09/2026 contra a produção, com requisições reais e a
documentação oficial de cada fornecedor lida no dia. Regra da plataforma,
não do cliente: vale para `cliente.lojas.avilaops.com` e para domínio
próprio, hoje e na loja criada amanhã.

## O que a documentação oficial diz (conferido)

| Fornecedor | O que diz | Consequência para nós |
|---|---|---|
| Google, "AI features" | "Não há requisitos adicionais para aparecer em AI Overviews ou AI Mode… Você não precisa criar novos arquivos legíveis por máquina, arquivos de texto para IA ou marcação." Requisito: página indexada e elegível a snippet. | Aparecer na IA do Google é aparecer na Pesquisa. Não existe arquivo mágico. |
| Google, `Google-Extended` | Controla uso para **treinamento e grounding do Gemini**; "não afeta inclusão nem ranking na Pesquisa". | É decisão de treinamento, separada. |
| OpenAI, `OAI-SearchBot` | Indexa para a **busca do ChatGPT**; "recomendamos permitir o OAI-SearchBot" no robots e nos IPs publicados; leva ~24 h. | Precisa passar no robots **e** na infraestrutura. |
| OpenAI, `GPTBot` | Só **treinamento**. | Separado da busca. |
| OpenAI, `ChatGPT-User` | Ação de uma pessoa dentro do ChatGPT; "as regras do robots podem não se aplicar". | Não é crawler; não se controla por robots. |
| llmstxt.org v2 (ago/2026) | H1 + citação + seções H2 com links; descoberta por `<link rel="describedby" href="/llms.txt">` ou cabeçalho `Link`. | Implementado. É complemento de compreensão, não de ranking. |

## A tabela

| Serviço | Crawler | robots permite? | Infra permite? | Indexável? | Evidência |
|---|---|---|---|---|---|
| Google Search | `Googlebot`, `Googlebot-Image` | sim (`*` allow, sem grupo restritivo) | sim: 200 em `/`, produto, robots, sitemap, llms nos dois hosts | sim (canonical + sem noindex no host oficial) | `curl -A Googlebot` 10/09; `scripts/conferir-publicacao.ts` |
| Google AI Overviews / AI Mode | os mesmos do Search | idem | idem | idem: não há requisito extra (doc do Google) | idem |
| Bing / Copilot | `Bingbot` | sim | sim (200) | sim | idem |
| ChatGPT Search | `OAI-SearchBot` | sim, explícito | sim (200 em tudo) | sim | idem; sem WAF/CDN na frente das lojas |
| ChatGPT (ação do usuário) | `ChatGPT-User` | n/a | sim (200) | n/a | idem |
| Treinamento (OpenAI, Gemini, Anthropic, Common Crawl) | `GPTBot`, `Google-Extended`, `ClaudeBot`, `CCBot` | **não, por padrão** (grupo `Disallow: /`); o lojista liga em Configurações → Descoberta | sim (não há bloqueio por infra; a política é o robots) | não se aplica | `descoberta.ts`, `Tenant.permiteTreinamentoIa` |

**Infra, medido:** `*.lojas.avilaops.com` e os domínios próprios resolvem
**direto** para o Hetzner (178.105.82.48); só o apex `lojas.avilaops.com`
(plataforma e `/uploads`) passa pelo Cloudflare. Não há WAF, Bot Fight Mode,
challenge, rate limit, bloqueio por país ou ASN na frente de loja nenhuma:
o Caddy é a única borda, e o Caddy não filtra User-Agent. Nenhum 403, 429,
redirect ou cookie obrigatório em nenhum caminho testado.

## O que toda loja nasce garantindo (contrato de publicação)

Gerado do tenant, sem configuração nossa, no subdomínio e no domínio próprio:

| Recurso | Onde | Regra |
|---|---|---|
| `/robots.txt` | `src/app/robots.ts` → `lib/descoberta.ts` | por host; busca liberada; `/carrinho /checkout /pedido/ /conta /api/` fechados; treinamento fechado salvo opt-in; `Sitemap:` no host oficial |
| `/sitemap.xml` | `src/app/sitemap.ts` | só host oficial; só `produtoPublicavel`; categorias com produto; institucionais; sem parâmetro, sem privada |
| `/llms.txt` | `src/app/llms.txt/route.ts` | identidade, sobre/contato, como comprar (só o que é verdade: sem "aceita PIX" em loja sem gateway), até 30 categorias, até 12 destaques, políticas, `Optional` com sitemap e llms-full; **sem lista de produtos e sem preço zero** |
| `/llms-full.txt` | `src/app/llms-full.txt/route.ts` | o catálogo publicável em texto; sob consulta e esgotado ditos como tal |
| `<link rel="describedby" href="/llms.txt">` | `layout.tsx` | em toda página da loja |
| JSON-LD | `layout.tsx`, `produtos/[slug]` | `Store` (+endereço se público), `WebSite` com `SearchAction` para `/produtos?q=`, `Product` + `Offer` + `BreadcrumbList`; medidas da ficha como `additionalProperty` (`unitCode: MMT`); marca, GTIN e avaliação só quando existem |
| canonical / noindex | `layout.tsx`, `seo-listagem.ts` | host oficial; subdomínio de loja com domínio próprio é `noindex, follow`; filtro/busca `noindex, follow`; página além do fim é 404 |
| Ficha técnica | `lib/ficha.ts` | medidas primeiro, "101,6 mm"; chave interna do ERP não sai; medida inválida some |
| Log de acesso | Caddy `(lojas_log)` → `/var/log/caddy/lojas.log` | JSON, por host, status e User-Agent; é como se sabe se o bot chegou |

Conferência: `npm run loja:publicacao -- https://<host>` (43 verificações;
sai 1 se alguma falhar). Rodar depois de criar loja, apontar domínio e
deployar.

## Por que a Vedashow aparece no Google e não foi fonte da resposta de IA

Caso: "gaxeta código 1578, 101,60 × 114,30 × 14,28/14,29 mm". O que o
crawler recebe da página (HTML sem JavaScript, `curl`):

| | na página da Vedashow |
|---|---|
| nome | `Gaxeta - 101 6x114 3x14 28 1578` (as vírgulas se perderam na importação) |
| texto "101,60" / "114,30" / "14,28" | **não existe** em lugar nenhum da página |
| ficha | `Diametro interno mm 6`, `Altura mm 114`: **medidas erradas**, extraídas do nome corrompido; sem diâmetro externo |
| foto | nenhuma (0 das 245 gaxetas tem foto) |
| disponibilidade | esgotado (5 das 245 gaxetas em estoque) |
| marca, descrição longa | nenhuma |
| SSR, JSON-LD, canonical, robots, 200 para todos os bots | **tudo certo** |

A resposta é de conteúdo, não de infraestrutura nem de arquivo: as páginas
escolhidas como fonte dizem "101,60 mm × 114,30 mm × 14,28 mm" em texto; a
nossa diz "101 6x114 3x14 28" e, na ficha, um diâmetro interno de 6 mm que
é falso. A IA não escolhe a fonte que contradiz as outras. Não é falta de
`llms.txt` (ele já existia), e nenhum arquivo corrigiria uma medida errada.

O que é da plataforma, e foi feito: a ficha formata medida com unidade, o
JSON-LD carrega as medidas, medida absurda some em vez de sair errada, o
`llms.txt` deixa de listar 200 produtos e de anunciar "R$ 0,00". O que é do
dado do cliente, e não se corrige por código nosso: nomes com vírgula
perdida e atributos extraídos deles (na Vedashow, as gaxetas inteiras), fotos
e estoque. Está anotado em `docs/VEDASHOW-FOTOS.md` e na ficha do cliente.

## O que é comprovado e o que é hipótese

**Comprovado (medido):** todos os crawlers de busca recebem 200 na cadeia
inteira; robots, sitemap e canonical corretos por host; SSR completo; JSON-LD
válido e honesto; o produto do caso tem o texto de medida errado e sem foto.

**Hipótese (não se prova sem o buscador):** que corrigir as medidas e ter foto
faça a Vedashow virar fonte da resposta de IA. É a explicação mais simples
compatível com a evidência, e é o que a documentação do Google aponta
(indexação + snippet útil), mas ninguém controla a seleção de fontes.

**Não afirmado:** que `llms.txt` influencie ranking ou seleção de fonte no
Google. O Google diz que não usa arquivo nenhum além do que a Pesquisa já lê.

## Painel

Configurações → **Descoberta**: endereço oficial, site indexável, Google e
Bing, ChatGPT (busca), sitemap, llms.txt, e a única decisão do lojista: a
caixa de treinamento de IA, desligada por padrão, com o texto dizendo que
não muda nada na busca.
