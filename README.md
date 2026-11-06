# lojas.avilaops.com: um código, N lojas

Plataforma multi-tenant de comércio digital da Avila Ops: vitrine, catálogo,
checkout, pedidos e operação compartilhados, com identidade, domínio e dados
próprios de cada loja.

**Documentação revisada em 06/11/2026.** A presença de código não comprova
ativação de uma integração, homologação do provedor ou funcionamento em produção.
Consulte as evidências do ambiente e da versão antes de declarar uma entrega.

## Stack e estrutura

- Next.js 16.2.10, React 19.2.8, TypeScript 5 e Tailwind CSS 4.
- PostgreSQL e Prisma 6; migrações em `prisma/migrations`.
- Node.js 22 na preparação de dependências da CI; npm com `package-lock.json`.
- `src/app`: vitrine, plataforma e APIs; `src/lib`: regras de negócio.
- `packages/checkout`: contrato de pagamentos e adaptadores.
- `packages/removedor-de-fundo`: processamento de imagens com ONNX em CPU.
- `scripts`, `tests` e `.github/workflows`: verificações e entrega.

**Regra do produto:** o que varia entre lojas é *dado*, nunca *código*. Layout
único; tema por tokens; políticas padronizadas; checkout único. Pedido fora do
padrão não é "ajuste", é o plano Pro ou um projeto à parte.

## Capacidades e histórico

A tabela abaixo conserva os marcos históricos. Datas e estados descrevem o
registro da época; não substituem uma verificação atual de produção.

| Peça | Origem | Estado |
|---|---|---|
| Resolução de loja pelo `Host` (`<slug>.lojas.avilaops.com` ou domínio próprio) | novo, `src/lib/tenant.ts` | pronto |
| Tema por tokens (cor, fonte, raio, modo) alimentando Tailwind **e** checkout | novo, `src/lib/tema.ts` | pronto |
| Vitrine: home, catálogo, busca, categoria, produto (JSON-LD), sobre, contato, políticas | herdado da Brilhax, generalizado | pronto |
| Carrinho local (sem servidor de carrinho) | novo, `src/components/cart` | pronto |
| Checkout transparente PIX/cartão/boleto | `packages/checkout` (Mercado Pago) | pronto |
| Frete por CEP: Melhor Envio da loja conectada; CepCerto da plataforma para loja sem conexão; tabela por UF, entrega local e retirada conforme cadastro | `src/lib/frete.ts` | implementação existente; operação depende de configuração e prova por provedor |
| **Entrega da própria loja** por faixa de CEP (motoboy, frota): `Tenant.entregaLocal`, com preço, prazo e grátis-acima próprios; concorre em preço com a transportadora e é a única opção que continua de pé quando a cotação online cai | `src/lib/frete.ts` (`entregaLocal`), painel → Entrega | pronto (17/09/2026) |
| Pedidos, webhook de pagamento, status | novo, `src/lib/pedidos.ts` | pronto |
| API administrativa (criar loja, importar produtos, provisionar, listar pedidos) | novo, `src/app/api/admin` | pronto |
| Provisionamento: zona + DNS na Cloudflare, domínio + caixa no `mail.avilaops.com`, evento n8n | novo, `src/lib/provisionar.ts` | pronto, sem teste em produção |
| Eventos para o n8n (loja criada, pedido criado/pago/recusado) | novo, `src/lib/eventos.ts` | pronto |
| **Mensagens próprias** (19/09): a plataforma manda os próprios e-mails (SMTP próprio, sem dependência nova) e os próprios WhatsApps (Cloud API da Meta). Doze tipos de evento saem do n8n; um tipo só é executado aqui quando **todos** os canais dele estão configurados, e `canaisFeitos` impede que uma falha no segundo canal reenvie o primeiro. Nasce desligado: sem as variáveis, tudo volta para o n8n | `src/lib/acoes-do-evento.ts`, `email.ts`, `whatsapp.ts`, `automacoes-consumo.ts`, `docs/MENSAGENS.md` | pronto (19/09/2026) |
| **Agendador interno** (19/09): a plataforma roda as próprias rotinas — fila do Mercado Livre a cada 5 min, carrinho abandonado, reconciliação de pagamento, SEO de categoria, cobrança e relatório semanal. A linha da tabela `Rotina` é a trava, então dois containers nunca fazem o mesmo trabalho; `GET /api/admin/rotinas` diz se ainda está rodando. Antes quem chamava os endpoints era o n8n, e a fila do ML parar não avisava ninguém | `src/lib/rotinas.ts`, `src/lib/rotinas-executor.ts`, `src/instrumentation.ts`, `docs/ROTINAS.md` | pronto (19/09/2026) |
| Certificado sob demanda para domínio próprio (Caddy `on_demand_tls`) | `deploy/Caddyfile.snippet` + `/api/dominio-permitido` | pronto |
| **Variações** (até 3 opções, grade gerada por combinação, SKU/preço/estoque/foto por variação, seletor na página do produto com combinação esgotada desabilitada), **estoque** (produto simples ou por variação; baixa idempotente ao pagar; esgotado some do carrinho) e **cupons** (percentual, valor fixo, frete grátis; mínimo, limite de usos, validade; calculados no servidor; aplicados no carrinho) | `src/lib/cupons.ts`, `src/lib/estoque.ts`, `SeletorVariante.tsx`, `painel/GradeVariantes.tsx`, `painel/Cupons.tsx` | pronto (25/08/2026) |
| **Google Shopping**: feed Merchant Center por loja em `/feed/merchant.xml` (RSS 2.0 + `g:`; variações como itens com `item_group_id`, `sale_price`, `identifier_exists`) | `src/app/feed/merchant.xml/route.ts` | pronto (25/08/2026) |
| **Hardening das automações** (29/08): contrato v1 dos eventos (`eventId`, `versao`, centavos inteiros, `itens` + `itensTexto`), idempotência por `AutomacaoEvento` (o n8n reivindica antes de agir), validação de contrato no fluxo, `loja.provisionada` / `loja.provisionamento-falhou` / `loja.ativada` separados, indicações só com loja ativa, lembrete de PIX consulta um pedido só | `src/lib/eventos.ts`, `api/admin/automacoes/eventos/*`, `api/admin/pedidos/[referencia]/status`, `docs/ROTINAS.md` | no ar desde 29/08/2026 (deploy + fluxo `ruVn7ddvPQB949p9` publicado no mesmo dia) |
| **Conversão e operação** (25/08): carrinho abandonado (checkout identificado → `CheckoutAberto` → rotina horária → evento `carrinho.abandonado` → e-mail/WhatsApp pelo n8n; convertido ao nascer o pedido), busca com filtros (categoria, faixa de preço, ordenação, formulário GET indexável), galeria com zoom e miniaturas + “você também pode gostar”, avaliações moderadas no painel com `aggregateRating`, relatório semanal por e-mail (`loja.relatorio-semanal`, segunda 7h) | `src/lib/carrinhos.ts`, `src/lib/relatorio.ts`, `FiltrosProdutos.tsx`, `GaleriaProduto.tsx`, `Avaliacoes.tsx`, `painel/AvaliacoesPainel.tsx` | pronto |
| **Identidade e marca** (feito com ChatGPT, 25/08): diagnóstico de marca no onboarding → direção visual determinística (`src/lib/identidade.ts`), aba Marca, landing/estúdio redesenhados, `llms.txt`, OG da plataforma | `src/components/plataforma/`, `plataforma.css` | pronto |
| **Imagens**: upload otimizado (≤1600 px, WebP), miniaturas sob demanda (`/uploads/...?w=480`, geradas uma vez em disco), favicon e imagem de compartilhamento **por loja** (`icon.tsx`, `opengraph-image.tsx`), contraste AA automático do texto sobre a cor primária | `src/lib/imagens.ts`, `src/lib/tema.ts` | pronto (25/08/2026), o Dockerfile de runtime instala o `sharp` linux-x64 |
| **Quatro layouts de home** (Clássico, Vitrine, Editorial, Minimal), composições fixas dos mesmos blocos, escolhidas pelo diagnóstico e refinadas na aba Marca; `Tenant.tema.layout` | `src/components/home/*`, `src/lib/tema.ts` (`LAYOUTS`) | pronto (25/08/2026) |
| **Catálogo completo no painel**: edição de produto (várias fotos com ordem, descrição longa, estoque, disponibilidade, ativo/destaque), categorias (criar/editar/ordenar/apagar, imagem) e banner da home | `painel/EditarProduto.tsx`, `painel/Categorias.tsx`, `api/painel/produtos` (GET/PATCH), `api/painel/categorias` | pronto (25/08/2026) |
| **Plataforma autossuficiente** em `lojas.avilaops.com`: landing com planos, `/criar` (estúdio de lançamento em 5 etapas), `/entrar`, `/painel` (marca, produtos, pedidos, entrega e operação) | `src/proxy.ts`, `src/lib/sessao.ts`, `src/app/api/painel/*` | publicado em produção (25/08/2026), substitui a tela que vivia no cliente.avilaops.com |
| **Identidade visual e descoberta**: landing premium responsiva, marca Lojas, imagem hero autoral, prévias dos layouts, favicon/manifesto, Open Graph, sitemap/robots por host e `llms.txt`/`llms-full.txt` para plataforma e tenants | `src/app/plataforma/*`, `public/`, `src/app/{sitemap,robots}.ts`, `src/app/llms*.txt` | pronto e validado localmente (25/08/2026) |
| **Peças por moto (segmento motopeças)** (28/08/2026): `Tenant.segmento = "motopecas"` liga a garagem — o comprador escolhe marca/modelo/ano (cookie `minha-moto` + URL `?marca=&modelo=&ano=`), a loja mostra só o que serve (o universal vem depois, o que não serve some), selo "serve na sua moto" no card, tabela de compatibilidade + código original/equivalentes na página do produto (JSON-LD `mpn`/`isAccessoryOrSparePartFor`, `g:mpn` no feed), busca por código e por moto (gatilho `busca`), home ganha "Qual é a sua moto?", "modelos mais atendidos" e "marcas". Editor de compatibilidade no painel; catálogo-base de motos do Brasil em `src/lib/motos.ts`, mesclado com o que a loja cadastra | `src/lib/motos.ts`, `src/lib/minha-moto.ts`, `SeletorMoto.tsx`, `BarraGaragem.tsx`, `Compatibilidade.tsx`, `home/Garagem.tsx` | pronto; primeira loja: sandromotos |
| **Farmácia e drogaria (segmento `farmacia`)** (17/09/2026): a tarja do medicamento vira dado e passa a mandar na vitrine — controle especial (tarja preta e vermelha com retenção) continua visível com preço mas sem carrinho e sem WhatsApp, porque a RDC 44/2009 veda a venda a distância dele; tarja vermelha vende com aviso de receita na entrega. Busca acha por princípio ativo (gatilho de busca estendido), a página do produto mostra ficha (substância, apresentação, registro Anvisa, tipo) e os **equivalentes** da mesma substância e dose com quanto economizam, JSON-LD `Drug`; farmacêutico responsável, CRF e licença sanitária no rodapé (RDC 44/2009, art. 55) + aviso legal; layout "Farmácia" abre pela busca e por necessidade; campos no painel com cobrança do que falta cadastrar | `src/lib/farmacia.ts`, `components/home/Farmacia.tsx`, `components/Medicamento.tsx`, `docs/FARMACIA.md` | pronto (17/09/2026) |
| **SEO de categorias V1 + três layouts novos** (29/08/2026): `Categoria.seo*` gerado fora do request (painel, MCP ou rotina n8n das 3h; Gemini se houver `GEMINI_API_KEY`, senão fallback determinístico), vitrine só lê o Postgres, IndexNow após publicar; layouts Spotlight, Mercado e Conversão somam-se aos quatro | `src/lib/seo-categorias.ts`, `api/admin/seo/categorias`, `api/painel/categorias/seo`, `components/home/{Spotlight,Mercado,Conversao}.tsx`, `docs/SEO-CATEGORIAS-V1.md` | no ar desde 29/08/2026 |
| **Template Automotivo Premium** (14/09/2026, fechado em 17/09): décimo layout, e o primeiro que compõe a loja inteira — cabeçalho com megamenu e alternância claro/escuro, faixa de categorias, galeria com lightbox na página do produto, carrinho lateral e filtro por marca no catálogo. O conteúdo editorial (selo, títulos, imagens, logo do modo escuro) é campo de `Tenant.tema.premium`, editável na aba Marca. As **etapas da home saem do catálogo** quando o lojista não escreve nenhuma: a mesma trilha do layout Automotivo (lavar → descontaminar → corrigir → proteger), reconhecida pelo nome das categorias; abaixo de duas etapas a seção some em vez de ficar meia-vazia | `src/components/templates/automotivo-premium/*`, `src/lib/etapas-premium.ts`, `src/lib/tema.ts` (`premium`) | pronto (17/09/2026) |
| **Template Catálogo Técnico** (05/10/2026): décimo segundo layout. A home vira tabela de peças (código, marca, código original, equivalentes, medidas e aplicação) com busca por nome, código ou medida; as colunas saem do catálogo, e a que nenhum produto preenche não aparece. Compõe só a home (`escopo: "home"`) | `src/lib/catalogo-tecnico.ts`, `src/components/home/CatalogoTecnico.tsx`, `src/lib/templates.ts` | pronto (05/10/2026) |
| **Políticas do lojista, campos do produto e blog da loja** (17/09/2026): as políticas deixam de ser texto fechado da plataforma — o modelo vira ponto de partida editável, e quem não mexe continua publicando o modelo (que é o que garante CDC e LGPD em loja nova). As **regras de devolução** são número, não prosa, e viram texto sozinhas; o prazo tem piso de 7 dias no leitor, não só na tela, e taxa de reposição, frete de retorno e venda final só alcançam a cortesia depois do prazo legal, porque o art. 49 do CDC manda devolver integralmente. **Campos personalizados**: a loja declara o que pergunta em cada produto (rótulo, tipo, rascunho/ativo), com chave estável que sobrevive a renomear o rótulo; link só aceita `http(s)` e vídeo só YouTube/Vimeo. **Blog da loja** no domínio dela, com rascunho e agendamento que não existem para a vitrine nem para o sitemap | `src/lib/politicas.ts`, `src/lib/campos-personalizados.ts`, `src/lib/publicacoes.ts`, `painel/{Politicas,CamposPersonalizados,Publicacoes}.tsx`, `src/app/blog` | pronto (17/09/2026) |
| **Atribuição: de onde vem quem compra** (17/09/2026): a medição da vitrine que Análises declarava não existir. Sessão por visita (`SessaoVitrine`), canal resolvido de utm/referrer com WhatsApp e marketplace separados — que é o que muda o relatório de uma loja brasileira —, `gclid`/`fbclid` sem utm classificados como pago, e o pedido ligado à sessão em que foi fechado. A venda vai para o **último clique não direto** dos últimos 30 dias, senão o anúncio de segunda perde o crédito para o "Direto" de quinta. A medição é first-party, não guarda IP nem user-agent; ligar a visita de hoje à de ontem depende de "aceito" no banner, e sem isso cada visita conta por si. Sem sessão medida a tela não desenha gráfico em zero: diz por que o número não existe | `src/lib/atribuicao.ts`, `api/vitrine/sessao`, `components/MedirSessao.tsx`, `painel/analises/atribuicao` | pronto (17/09/2026) |
| **Canais de venda: regras comerciais e o que falta preencher** (19/09/2026): a integração com o Mercado Livre estava pronta e comercialmente cega — anunciava pelo preço da própria loja num canal que cobra de 11% a 19% sobre a venda, e a tela só listava quem já estava PRONTO, então quem tinha 180 de 200 produtos travados lia "nenhum produto anunciado ainda" sem poder descobrir por quê. Agora o lojista responde **por quanto e com quanto estoque** o catálogo vai para lá (acréscimo com a conta da comissão feita na tela, arredondamento sempre para cima, estoque reservado contra venda dupla, preço mínimo, tipo de anúncio, condição e garantia), e vê **o que falta agrupado pelo que falta** — "informe a marca" em trezentos produtos é uma tarefa, não trezentas —, com preparo sob demanda que não exige conta conectada. `CANAIS` é o registro central: Amazon, Shopee e Magalu entram como ficha, não como tela nova | `src/lib/canais.ts`, `painel/Canais.tsx`, `pendenciasDoCatalogo`, `docs/CANAIS-MARKETPLACES.md` | pronto (19/09/2026) |
| **Canal do Mercado Livre, o resto dele** (19/09/2026): a venda do canal baixava a **apresentação padrão**, seja qual fosse a vendida — vender o G tirava o P do estoque, errando duas de uma vez até virar cancelamento. `resolverVariante` reconhece pelo SKU, pelos atributos escolhidos ou pela apresentação única, e quando não reconhece **não baixa**, com o aviso chegando ao lojista em Automações. Item não casado com o catálogo deixou de derrubar a baixa do pedido inteiro. E quem **já vende no ML** — quase todo lojista que conecta — passa a poder adotar os anúncios existentes, casando por SKU e GTIN, nunca por título, com a decisão sendo dele e a prévia mostrando o que a loja mandaria | `resolverVariante`, `agruparParaBaixa`, `planejarSincronia`, `src/lib/mercadolivre-adocao.ts`, `painel/AdotarAnunciosMl.tsx` | pronto (19/09/2026) |
| **Marca Lojas** (13/10/2026): símbolo do toldo (três cores da Avila Ops sobre a fachada com porta em arco), logotipo desenhado, tokens `--lj-*` num arquivo só, componente único de marca, site e painel na tinta em vez do azul-marinho, favicon/manifesto/OG próprios, selo monocromático no rodapé das lojas e manual em `/marca` | `docs/MARCA-LOJAS.md`, `src/app/plataforma/marca-lojas.css`, `src/components/marca/MarcaLojas.tsx`, `public/media/marca/`, `public/media/lojas/` | pronto (13/10/2026) |
| **Direção de marca por loja**: diagnóstico de público, diferencial, personalidade, voz, objetivo e fotografia; geração determinística de paleta/tipografia/layout; persistência no tenant e revisão via n8n/Todoist | `src/lib/identidade.ts`, `Tenant.identidade`, wizard e aba Marca | publicado em produção (25/08/2026) |

## Integrações e pendências

- **Frete:** `src/lib/frete.ts` seleciona Melhor Envio para a loja conectada e
  CepCerto para loja sem conexão. Falha do Melhor Envio não troca para a conta
  CepCerto. Tabela, entrega local e retirada dependem do cadastro da loja.
- **Melhor Envio:** o roteiro versionado mantém sandbox como padrão e descreve
  OAuth, cotação e operações explícitas de postagem. Configuração privada,
  autorização da loja e prova autenticada são etapas distintas. Consulte
  [sandbox e demonstração](docs/MELHOR-ENVIO-SANDBOX.md); o guia
  [histórico de frete](docs/MELHOR-ENVIO.md) contém instruções antigas e não
  comprova o estado atual do servidor.
- **Mercado Pago:** checkout e conexão OAuth possuem documentação própria em
  [Mercado Pago OAuth](docs/MERCADO-PAGO-OAUTH.md). Credenciais e webhooks
  precisam ser verificados por conta e ambiente.
- **Mercado Livre:** [canais](docs/CANAIS-MARKETPLACES.md) e
  [integração](docs/MERCADO-LIVRE.md). Vincular anúncio existente transfere
  responsabilidades operacionais e exige revisão da correspondência.
- **CMS e B2B:** acompanhe lacunas de contrato e evidências no
  [desenvolvimento MLOps](docs/DESENVOLVIMENTO-MLOPS.md).
- **Planejamento:** o [roadmap](docs/ROADMAP-PLATAFORMA.md) e o
  [controle da equipe](.agents/equipe/README.md) registram escopo, responsáveis
  e critérios. Pendências históricas devem ser revalidadas antes de execução.

## Desenvolvimento

Leia [AGENTS.md](AGENTS.md) antes de alterar o projeto. Builds e testes são
executados no GitHub CI, conforme a política do repositório. Não compile nem
execute rotinas de configuração ad hoc nos servidores.

Para preparar um ambiente de desenvolvimento isolado:

```bash
npm ci
cp .env.example .env
npx prisma generate
npm run dev
```

Preencha somente no ambiente privado as variáveis necessárias. Use banco
isolado e siga [banco de teste](docs/BANCO-DE-TESTE.md) para preparar dados e
migrações; não aponte desenvolvimento para o banco de produção. A aplicação de
desenvolvimento usa a porta 3080 e o host depende de `LOJAS_BASE_DOMAIN` e do
tenant cadastrado.

Scripts disponíveis para a CI incluem `typecheck`, `lint`, `test`,
`test:integracao`, `test:auditoria` e `banco:ensaio`. A lista exata está em
[package.json](package.json); a existência do script não significa que passou.

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

## CI e deploy

O fluxo vigente está em
[Build e deploy](.github/workflows/deploy-production.yml). Ele prepara
dependências, executa testes unitários, tipos, lint, contratos, integração
PostgreSQL e verificações de navegador; reúne os artefatos e empacota a imagem
aprovada. Publicações fora de pull requests usam GHCR e identificam a imagem
por digest.

A entrega exige a branch padrão, evento permitido e `DEPLOY_ENABLED=true`,
com ambiente `production`. Pull requests executam verificações sem publicar
a imagem nem entregar ao servidor. A preparação e o deploy usam a ação local
`.github/actions/entregar-imagem`.

Após a entrega, o job `fumaca` executa
`scripts/smoke-publicacao.mjs` contra `SMOKE_URL` ou a plataforma. A verificação
adicional de uma loja só roda com `SMOKE_LOJA_URL` definido; sem essa variável,
a foto do catálogo de um tenant não é verificada por esse passo.

Consulte [backup e rollback](docs/BACKUP-E-ROLLBACK.md) e
[etapas da CI](docs/CI-ETAPAS-CURTAS.md). Os comandos antigos de build no
Windows, envio de `standalone.tgz` e execução manual de `deploy.sh` foram
retirados deste guia para não serem confundidos com o fluxo vigente.

## Registros operacionais históricos

Os registros abaixo preservam contexto de agosto e setembro. IPs, caminhos,
configurações e workflows mencionados precisam ser conferidos no ambiente
antes de qualquer ação.

**Cloudflare (29/08/2026):** o apex `lojas.avilaops.com` (landing, `/criar`, `/painel`, webhooks) passou a ser **proxied** — o TTFB do Brasil caiu de ~0,9 s para ~0,4 s. O `*.lojas` continua DNS-only (o Universal SSL não cobre dois níveis). Zona `ssl=full`, `always_use_https=on`.

**Webhook do Mercado Pago (29/08/2026):** cada cobrança leva `notification_url` = `https://lojas.avilaops.com/api/webhooks/mercadopago?loja=<slug>` (`MercadoPagoConfig.notificationUrl` no `packages/checkout`), então o webhook do pedido não depende da URL cadastrada na aplicação do MP.

**Circuito comercial no n8n (30/08/2026):** `lojas_leads` (Overpass/OpenStreetMap, segunda 6h) → `/form/lojas-demo` monta a loja e marca o lead → `lojas_demos` → régua diária (dias 2, 5, 12, 30 e 37, com `PATCH status=CANCELADA` no 37). Quatro workflows, nenhuma planilha: `docs/ROTINAS.md`.

**Loja-demo por formulário (30/08/2026):** o workflow n8n `CE64HzanEWwy6xrn` (`/form/lojas-demo`) monta uma loja de demonstração inteira a partir de dados públicos — cria o tenant, marca ATIVA + `cobrancaIsenta`, importa os produtos com `PUT /api/admin/tenants/:slug/produtos?importarImagens=1&tratar=1` (cada foto é baixada para o nosso `/uploads` e passa pelo removedor de fundo), registra em `lojas_demos` e abre a tarefa de mostrar ao dono. Ver `docs/ROTINAS.md`.

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

## Contratos comerciais

Cada loja possui versões imutáveis de `ContratoComercial`, com plano,
mensalidade em centavos, comissão em pontos-base e período de vigência. Novos
cadastros recebem o preço vigente do plano mais 5% sobre vendas; contratos
anteriores permanecem sem comissão, exceto os acordos formalizados de Vedashow
(R$ 350 + 5%) e Bereta Rodas (3%). O pedido guarda a versão vigente no momento
da criação, portanto uma renegociação não altera vendas antigas.

A administração consulta o histórico e cria uma nova versão por
`GET/POST /api/admin/tenants/:slug/contratos`. A faixa antiga continua como
compatibilidade para registros legados; cobrança e painel preferem o contrato
vigente quando ele existe. Relatório de migração e recuperação estão em
`docs/CONTRATOS-COMERCIAIS.md`.

## Modelo comercial (resumo: detalhe em `docs/PLANOS.md`)

| | Site | **Loja** | Loja Pro |
|---|---|---|---|
| Setup | R$ 497 | R$ 497 | R$ 1.490 |
| Mensal | R$ 79 | **R$ 119** | R$ 349 |

Custo por loja na infra compartilhada: < R$ 10/mês. Lock-in é pelo padrão:
domínio, DNS, e-mail, automações e painel são da plataforma.

## Documentação por assunto

| Assunto | Referência |
| --- | --- |
| APIs e acesso por agentes | [API](docs/API.md), [MCP](docs/MCP.md) |
| Entrada de lojas e identidade | [Onboarding](docs/ONBOARDING.md), [marca Lojas](docs/MARCA-LOJAS.md) |
| Catálogo e comércio B2B | [Catálogo padronizado](docs/CATALOGO-PADRONIZADO.md), [contrato B2B](docs/CONTRATO-CATALOGO-B2B.md) |
| Google Merchant e descoberta | [Merchant Center](docs/MERCHANT-CENTER.md), [descoberta](docs/DESCOBERTA.md) |
| Automações e mensagens | [Rotinas](docs/ROTINAS.md), [mensagens](docs/MENSAGENS.md) |
| Fiscal e armazenamento | [Fluxos fiscais](docs/FLUXOS-FISCAIS.md), [cache R2](docs/FISCAL-CACHE-R2.md) |
| Observabilidade | [Métricas](docs/METRICAS.md), [Langfuse](docs/LANGFUSE.md) |
| Contratos e desenvolvimento | [Experiments](docs/CONTRATOS-EXPERIMENTS.md), [MLOps](docs/DESENVOLVIMENTO-MLOPS.md) |
