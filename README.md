# lojas.avilaops.com: um código, N lojas

Plataforma multi-tenant de lojas virtuais da Avila Ops. Nasceu em 24/08/2026 da
pergunta "como a C2TI vende loja a R$ 497 + R$ 92/mês?", resposta: um único
app (`c2tiapps.com/sites/013/…`) com N clientes. Isto é o nosso, mais barato de
operar (Hetzner + Docker) e com mais coisa dentro (PIX transparente, frete por
CEP, e-mail próprio, automações n8n).

**Posicionamento (25/08/2026):** concorrer com Nuvemshop e Shopify no pequeno
lojista brasileiro, mais barato, PIX nativo, WhatsApp e automação de fábrica,
dinheiro na conta do lojista. Não é um produto para um cliente só.

**Regra do produto:** o que varia entre lojas é *dado*, nunca *código*. Layout
único; tema por tokens; políticas padronizadas; checkout único. Pedido fora do
padrão não é "ajuste", é o plano Pro ou um projeto à parte.

## O que já está aqui

| Peça | Origem | Estado |
|---|---|---|
| Resolução de loja pelo `Host` (`<slug>.lojas.avilaops.com` ou domínio próprio) | novo, `src/lib/tenant.ts` | pronto |
| Tema por tokens (cor, fonte, raio, modo) alimentando Tailwind **e** checkout | novo, `src/lib/tema.ts` | pronto |
| Vitrine: home, catálogo, busca, categoria, produto (JSON-LD), sobre, contato, políticas | herdado da Brilhax, generalizado | pronto |
| Carrinho local (sem servidor de carrinho) | novo, `src/components/cart` | pronto |
| Checkout transparente PIX/cartão/boleto | `packages/checkout` (Mercado Pago) | pronto |
| Frete por CEP (CepCerto no servidor, uma conta para todas) + tabela por UF + retirada | `Websites/brilhax.com/src/lib/frete.ts`, generalizado | pronto |
| **Entrega da própria loja** por faixa de CEP (motoboy, frota): `Tenant.entregaLocal`, com preço, prazo e grátis-acima próprios; concorre em preço com a transportadora e é a única opção que continua de pé quando a cotação online cai | `src/lib/frete.ts` (`entregaLocal`), painel → Entrega | pronto (17/09/2026) |
| Pedidos, webhook de pagamento, status | novo, `src/lib/pedidos.ts` | pronto |
| API administrativa (criar loja, importar produtos, provisionar, listar pedidos) | novo, `src/app/api/admin` | pronto |
| Provisionamento: zona + DNS na Cloudflare, domínio + caixa no `mail.avilaops.com`, evento n8n | novo, `src/lib/provisionar.ts` | pronto, sem teste em produção |
| Eventos para o n8n (loja criada, pedido criado/pago/recusado) | novo, `src/lib/eventos.ts` | pronto |
| Certificado sob demanda para domínio próprio (Caddy `on_demand_tls`) | `deploy/Caddyfile.snippet` + `/api/dominio-permitido` | pronto |
| **Variações** (até 3 opções, grade gerada por combinação, SKU/preço/estoque/foto por variação, seletor na página do produto com combinação esgotada desabilitada), **estoque** (produto simples ou por variação; baixa idempotente ao pagar; esgotado some do carrinho) e **cupons** (percentual, valor fixo, frete grátis; mínimo, limite de usos, validade; calculados no servidor; aplicados no carrinho) | `src/lib/cupons.ts`, `src/lib/estoque.ts`, `SeletorVariante.tsx`, `painel/GradeVariantes.tsx`, `painel/Cupons.tsx` | pronto (25/08/2026) |
| **Google Shopping**: feed Merchant Center por loja em `/feed/merchant.xml` (RSS 2.0 + `g:`; variações como itens com `item_group_id`, `sale_price`, `identifier_exists`) | `src/app/feed/merchant.xml/route.ts` | pronto (25/08/2026) |
| **Hardening das automações** (29/08): contrato v1 dos eventos (`eventId`, `versao`, centavos inteiros, `itens` + `itensTexto`), idempotência por `AutomacaoEvento` (o n8n reivindica antes de agir), validação de contrato no fluxo, `loja.provisionada` / `loja.provisionamento-falhou` / `loja.ativada` separados, indicações só com loja ativa, lembrete de PIX consulta um pedido só | `src/lib/eventos.ts`, `api/admin/automacoes/eventos/*`, `api/admin/pedidos/[referencia]/status`, `docs/ROTINAS-N8N.md` | no ar desde 29/08/2026 (deploy + fluxo `ruVn7ddvPQB949p9` publicado no mesmo dia) |
| **Conversão e operação** (25/08): carrinho abandonado (checkout identificado → `CheckoutAberto` → rotina horária → evento `carrinho.abandonado` → e-mail/WhatsApp pelo n8n; convertido ao nascer o pedido), busca com filtros (categoria, faixa de preço, ordenação, formulário GET indexável), galeria com zoom e miniaturas + “você também pode gostar”, avaliações moderadas no painel com `aggregateRating`, relatório semanal por e-mail (`loja.relatorio-semanal`, segunda 7h) | `src/lib/carrinhos.ts`, `src/lib/relatorio.ts`, `FiltrosProdutos.tsx`, `GaleriaProduto.tsx`, `Avaliacoes.tsx`, `painel/AvaliacoesPainel.tsx` | pronto |
| **Identidade e marca** (feito com ChatGPT, 25/08): diagnóstico de marca no onboarding → direção visual determinística (`src/lib/identidade.ts`), aba Marca, landing/estúdio redesenhados, `llms.txt`, OG da plataforma | `src/components/plataforma/`, `plataforma.css` | pronto |
| **Imagens**: upload otimizado (≤1600 px, WebP), miniaturas sob demanda (`/uploads/...?w=480`, geradas uma vez em disco), favicon e imagem de compartilhamento **por loja** (`icon.tsx`, `opengraph-image.tsx`), contraste AA automático do texto sobre a cor primária | `src/lib/imagens.ts`, `src/lib/tema.ts` | pronto (25/08/2026), o Dockerfile de runtime instala o `sharp` linux-x64 |
| **Quatro layouts de home** (Clássico, Vitrine, Editorial, Minimal), composições fixas dos mesmos blocos, escolhidas pelo diagnóstico e refinadas na aba Marca; `Tenant.tema.layout` | `src/components/home/*`, `src/lib/tema.ts` (`LAYOUTS`) | pronto (25/08/2026) |
| **Catálogo completo no painel**: edição de produto (várias fotos com ordem, descrição longa, estoque, disponibilidade, ativo/destaque), categorias (criar/editar/ordenar/apagar, imagem) e banner da home | `painel/EditarProduto.tsx`, `painel/Categorias.tsx`, `api/painel/produtos` (GET/PATCH), `api/painel/categorias` | pronto (25/08/2026) |
| **Plataforma autossuficiente** em `lojas.avilaops.com`: landing com planos, `/criar` (estúdio de lançamento em 5 etapas), `/entrar`, `/painel` (marca, produtos, pedidos, entrega e operação) | `src/proxy.ts`, `src/lib/sessao.ts`, `src/app/api/painel/*` | publicado em produção (25/08/2026), substitui a tela que vivia no cliente.avilaops.com |
| **Identidade visual e descoberta**: landing premium responsiva, marca Lojas, imagem hero autoral, prévias dos layouts, favicon/manifesto, Open Graph, sitemap/robots por host e `llms.txt`/`llms-full.txt` para plataforma e tenants | `src/app/plataforma/*`, `public/`, `src/app/{sitemap,robots}.ts`, `src/app/llms*.txt` | pronto e validado localmente (25/08/2026) |
| **Peças por moto (segmento motopeças)** (28/08/2026): `Tenant.segmento = "motopecas"` liga a garagem — o comprador escolhe marca/modelo/ano (cookie `minha-moto` + URL `?marca=&modelo=&ano=`), a loja mostra só o que serve (o universal vem depois, o que não serve some), selo "serve na sua moto" no card, tabela de compatibilidade + código original/equivalentes na página do produto (JSON-LD `mpn`/`isAccessoryOrSparePartFor`, `g:mpn` no feed), busca por código e por moto (gatilho `busca`), home ganha "Qual é a sua moto?", "modelos mais atendidos" e "marcas". Editor de compatibilidade no painel; catálogo-base de motos do Brasil em `src/lib/motos.ts`, mesclado com o que a loja cadastra | `src/lib/motos.ts`, `src/lib/minha-moto.ts`, `SeletorMoto.tsx`, `BarraGaragem.tsx`, `Compatibilidade.tsx`, `home/Garagem.tsx` | pronto; primeira loja: sandromotos |
| **SEO de categorias V1 + três layouts novos** (29/08/2026): `Categoria.seo*` gerado fora do request (painel, MCP ou rotina n8n das 3h; Gemini se houver `GEMINI_API_KEY`, senão fallback determinístico), vitrine só lê o Postgres, IndexNow após publicar; layouts Spotlight, Mercado e Conversão somam-se aos quatro | `src/lib/seo-categorias.ts`, `api/admin/seo/categorias`, `api/painel/categorias/seo`, `components/home/{Spotlight,Mercado,Conversao}.tsx`, `docs/SEO-CATEGORIAS-V1.md` | no ar desde 29/08/2026 |
| **Template Automotivo Premium** (14/09/2026, fechado em 17/09): décimo layout, e o primeiro que compõe a loja inteira — cabeçalho com megamenu e alternância claro/escuro, faixa de categorias, galeria com lightbox na página do produto, carrinho lateral e filtro por marca no catálogo. O conteúdo editorial (selo, títulos, imagens, logo do modo escuro) é campo de `Tenant.tema.premium`, editável na aba Marca. As **etapas da home saem do catálogo** quando o lojista não escreve nenhuma: a mesma trilha do layout Automotivo (lavar → descontaminar → corrigir → proteger), reconhecida pelo nome das categorias; abaixo de duas etapas a seção some em vez de ficar meia-vazia | `src/components/templates/automotivo-premium/*`, `src/lib/etapas-premium.ts`, `src/lib/tema.ts` (`premium`) | pronto (17/09/2026) |
| **Direção de marca por loja**: diagnóstico de público, diferencial, personalidade, voz, objetivo e fotografia; geração determinística de paleta/tipografia/layout; persistência no tenant e revisão via n8n/Todoist | `src/lib/identidade.ts`, `Tenant.identidade`, wizard e aba Marca | publicado em produção (25/08/2026) |

## O que falta (ordem sugerida)

1. ~~Tela de onboarding~~ - o portal `cliente.avilaops.com` foi apagado do servidor
   em 24/08/2026; a tela agora vive na própria plataforma (`/criar`, `/entrar`,
   `/painel`). Recuperação de senha (`/recuperar` → evento `lojista.recuperar-senha`
   no n8n → e-mail) e upload de foto/logo (`/api/painel/imagens`, servido em
   `/uploads/<slug>/<arquivo>`, volume `/opt/lojas/uploads`) feitos em 25/08/2026.
2. ~~Fluxo n8n `lojas-onboarding`~~ - fonte de verdade é o fluxo vivo
   `ruVn7ddvPQB949p9` (regras em `docs/ROTINAS-N8N.md`); webhook e token de produção
   configurados e conectividade HTTP 200 verificada em 25/08/2026. A versão da
   fonte trata `loja.identidade-atualizada` criando a revisão visual no Todoist.
   Ao alterar a fonte, reimportar/publicar a versão na instância n8n e confirmar as credenciais
   Twilio, Todoist e Lojas Admin Token no próprio n8n.
3. ~~Upload de imagem~~ - feito 25/08/2026. Falta ligar o removedor de fundo
   (`/opt/removedor-de-fundo`) para padronizar a foto.
4. Consolidar e validar o adaptador **Mercado Pago** no `packages/checkout`.
5. ~~Cobrança da mensalidade~~ - feita 25/08/2026: assinatura (preapproval) no
   Mercado Pago da Avila Ops por plano (79/119/349), aba "Assinatura" no painel,
   webhook idempotente em `/api/webhooks/mercadopago-assinatura` (tabelas `Fatura`
   e `CobrancaEvento`), 14 dias de teste + `LOJAS_DIAS_TOLERANCIA`, suspensão
   automática pela rotina diária do n8n (`POST /api/admin/cobranca/verificar`);
   `SUSPENSA` some o checkout e mantém a vitrine; pagamento reativa na hora.
   **Falta só preencher `MP_ACCESS_TOKEN`/`MP_WEBHOOK_SECRET` da conta Avila Ops
   em `/opt/lojas/.env` e cadastrar o webhook no painel MP.** Setup R$ 497 é
   marcado à parte: `POST /api/admin/tenants/:slug/setup`.
6. Confirmar o contrato server-side da CepCerto (hoje usa o endpoint do widget
   com `Origin` da plataforma; se eles exigirem o token de servidor, trocar em
   `cotarCepCerto`).
7. ~~Marcar pedido como enviado + rastreio pelo painel~~ - feito em 24/08/2026
   (`PATCH /api/admin/tenants/:slug/pedidos/:id` + botões Separar / Marcar
   enviado / Marcar entregue no portal).

## Rodando local

```bash
npm install
cp .env.example .env            # DATABASE_URL, LOJAS_SECRET, LOJAS_ADMIN_TOKEN, LOJAS_BASE_DOMAIN=localhost
npx prisma migrate dev --name inicial
npm run seed:demo               # cria demo.localhost
npm run dev                     # http://demo.localhost:3080
```

Criar loja pela API:

```bash
curl -X POST http://127.0.0.1:3080/api/admin/tenants?provisionar=1 \
  -H "authorization: Bearer $LOJAS_ADMIN_TOKEN" -H "content-type: application/json" \
  -d '{"slug":"vedashow","nome":"Vedashow","dominioPrincipal":"vedashow.com.br","whatsapp":"5516999990000","cepOrigem":"14075240","tema":{"corPrimaria":"#c62828"}}'
```

## Pagamento: Mercado Pago, um gateway só (31/08/2026)

Decisão de escopo do Nicolas: a loja recebe pelo **Mercado Pago** e mais nada.
Pix, cartão e boleto, na conta do próprio lojista, com o webhook validado por
assinatura HMAC em tempo constante.

O código conhece apenas a interface `PaymentProvider` do `packages/checkout`,
então acrescentar outro gateway um dia é implementar a interface e trocar o que
`src/lib/gateway.ts` devolve, sem tocar em rota nem em tela.

Os adaptadores de PayPal e Éfi continuam no `packages/checkout`, **fora do
caminho** (não são exportados). Enquanto estiveram meio ligados, os dois
aceitavam qualquer notificação: faziam `JSON.parse`, pegavam o id e devolviam,
o que deixaria qualquer um marcar pedido como pago. Isso foi corrigido antes de
saírem de cena (PayPal passou a usar o verificador oficial; Éfi confirma o txid
na API), para que ninguém os religue achando que estão prontos.

## Deploy (Hetzner, Docker): em produção desde 24/08/2026

O servidor (CX23, 4 GB, disco Docker sempre perto de 95%) **não builda**: o
build Next `standalone` é feito aqui no Windows e sobe pronto. Fluxo:

```bash
# 1. build local (Prisma gera também o engine debian-openssl-3.0.x: ver schema.prisma)
npx prisma generate && npx next build
cd .next/standalone && rm -rf lojas.avilaops.com/.next/static   && cp -r ../static lojas.avilaops.com/.next/static   && cp -r ../../public lojas.avilaops.com/public; cp -r ../../prisma lojas.avilaops.com/prisma   && tar --force-local -czf "$TMP/lojas-standalone.tgz" .
# 2. envia e reinicia
scp -i ~/.ssh/hetzner_avilaops "$TMP/lojas-standalone.tgz" root@178.105.82.48:/opt/lojas/standalone.tgz
ssh -i ~/.ssh/hetzner_avilaops root@178.105.82.48 '/opt/lojas/deploy.sh'
# 3. migração nova? (do próprio servidor, contra o Postgres do host)
ssh ... 'cd /opt/lojas && tar xzf standalone.tgz ./lojas.avilaops.com/prisma && DATABASE_URL=$(grep ^DATABASE_URL= .env | cut -d= -f2- | sed s/host.docker.internal/127.0.0.1/) npx -y prisma@6 migrate deploy --schema lojas.avilaops.com/prisma/schema.prisma'
```

No servidor (`/opt/lojas`): imagem base `lojas-base` (`deploy/Dockerfile.base`: node + openssl + sharp linux-x64, construída **uma vez**) e `Dockerfile` de runtime (`deploy/Dockerfile.runtime`: `FROM lojas-base` + `ADD standalone.tgz`), o deploy não baixa nem instala nada, e o disco não infla a cada build. O runtime cria o
symlink `@prisma/client-<hash>` que o Turbopack referencia e que o Windows não
gera), `docker-compose.yml` com `network_mode: bridge` (o Postgres do host escuta
em 172.17.0.1), `.env` (segredos gerados no servidor, chmod 600). Container
`lojas-avilaops`, porta `127.0.0.1:3080` (3070 é do Migdolus).

**Nunca rode `docker image prune -af` neste servidor.** Ele apaga a imagem
`lojas-base` (nenhum container a usa; ela só é base de build) e o deploy passa a
falhar tentando baixá-la do Docker Hub, em silêncio, com o container antigo
seguindo no ar. O `deploy/deploy.sh` reconstrói a base se faltar, confere o
healthcheck e limpa só imagens dangling; foi escrito depois de isso acontecer
em 26/08/2026.

**Cloudflare (29/08/2026):** o apex `lojas.avilaops.com` (landing, `/criar`, `/painel`, webhooks) passou a ser **proxied** — o TTFB do Brasil caiu de ~0,9 s para ~0,4 s. O `*.lojas` continua DNS-only (o Universal SSL não cobre dois níveis). Zona `ssl=full`, `always_use_https=on`.

**Webhook do Mercado Pago (29/08/2026):** cada cobrança leva `notification_url` = `https://lojas.avilaops.com/api/webhooks/mercadopago?loja=<slug>` (`MercadoPagoConfig.notificationUrl` no `packages/checkout`), então o webhook do pedido não depende da URL cadastrada na aplicação do MP.

**Circuito comercial no n8n (30/08/2026):** `lojas_leads` (Overpass/OpenStreetMap, segunda 6h) → `/form/lojas-demo` monta a loja e marca o lead → `lojas_demos` → régua diária (dias 2, 5, 12, 30 e 37, com `PATCH status=CANCELADA` no 37). Quatro workflows, nenhuma planilha: `docs/ROTINAS-N8N.md`.

**Loja-demo por formulário (30/08/2026):** o workflow n8n `CE64HzanEWwy6xrn` (`/form/lojas-demo`) monta uma loja de demonstração inteira a partir de dados públicos — cria o tenant, marca ATIVA + `cobrancaIsenta`, importa os produtos com `PUT /api/admin/tenants/:slug/produtos?importarImagens=1&tratar=1` (cada foto é baixada para o nosso `/uploads` e passa pelo removedor de fundo), registra em `lojas_demos` e abre a tarefa de mostrar ao dono. Ver `docs/ROTINAS-N8N.md`.

**Ajuda (30/08/2026):** `/ajuda` é o tutorial em sete capítulos (uma tela por capítulo, cinco passos) que substitui a chamada de vídeo do onboarding; está no menu, no rodapé e no sitemap. Texto em `src/app/plataforma/ajuda/page.tsx`.

**Removedor de fundo (30/08/2026):** `FUNDO_URL` aponta para `odoo-avilaops-recorte-1:5180`, que vive na rede `odoo-avilaops_default`; o `deploy.sh` faz `docker network connect` depois do `up`, senão o nome não resolve da bridge padrão e o botão "Tratar com IA" devolve 503.

**Loja da casa:** `Tenant.cobrancaIsenta` tira a loja da régua de cobrança (rotina diária nunca suspende). Só a API admin marca (`PATCH /api/admin/tenants/:slug {"cobrancaIsenta":true}`); a `demo` está isenta desde 29/08.

**Caddy** (`/etc/caddy/Caddyfile`): o `ask` global do `on_demand_tls` aponta para
`/api/dominio-permitido`, que repassa ao Comandeiro (3040) o que não for loja.
**Domínios próprios** das lojas entram por `import /etc/caddy/lojas.d/*.caddy`:
o timer `lojas-caddy-sync` (a cada 2 min) roda `/opt/lojas/caddy-sync.sh`, que lê
`GET /api/admin/dominios` e regenera o bloco + `systemctl reload caddy` só quando
mudou (fontes em `deploy/`). Sem isso o domínio cairia no `https://` do Comandeiro;
bloco `lojas.avilaops.com, *.lojas.avilaops.com` com `tls { on_demand }` -
não há certificado wildcard (Caddy sem módulo DNS da Cloudflare), cada loja ganha
o seu na primeira visita. **DNS**: `lojas` e `*.lojas` → A 178.105.82.48,
DNS-only (o `*.lojas` tem dois níveis e o Universal SSL da Cloudflare não cobre).

Demo: https://demo.lojas.avilaops.com

## Modelo comercial (resumo: detalhe em `docs/PLANOS.md`)

| | Site | **Loja** | Loja Pro |
|---|---|---|---|
| Setup | R$ 497 | R$ 497 | R$ 1.490 |
| Mensal | R$ 79 | **R$ 119** | R$ 349 |

Custo por loja na infra compartilhada: < R$ 10/mês. Lock-in é pelo padrão:
domínio, DNS, e-mail, automações e painel são da plataforma.
