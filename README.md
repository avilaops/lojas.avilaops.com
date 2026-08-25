# lojas.avilaops.com — um código, N lojas

Plataforma multi-tenant de lojas virtuais da Avila Ops. Nasceu em 24/08/2026 da
pergunta "como a C2TI vende loja a R$ 497 + R$ 92/mês?" — resposta: um único
app (`c2tiapps.com/sites/013/…`) com N clientes. Isto é o nosso, mais barato de
operar (Hetzner + Docker) e com mais coisa dentro (PIX transparente, frete por
CEP, e-mail próprio, automações n8n).

**Regra do produto:** o que varia entre lojas é *dado*, nunca *código*. Layout
único; tema por tokens; políticas padronizadas; checkout único. Pedido fora do
padrão não é "ajuste" — é o plano Pro ou um projeto à parte.

## O que já está aqui

| Peça | Origem | Estado |
|---|---|---|
| Resolução de loja pelo `Host` (`<slug>.lojas.avilaops.com` ou domínio próprio) | novo — `src/lib/tenant.ts` | pronto |
| Tema por tokens (cor, fonte, raio, modo) alimentando Tailwind **e** checkout | novo — `src/lib/tema.ts` | pronto |
| Vitrine: home, catálogo, busca, categoria, produto (JSON-LD), sobre, contato, políticas | herdado da Brilhax, generalizado | pronto |
| Carrinho local (sem servidor de carrinho) | novo — `src/components/cart` | pronto |
| Checkout transparente PIX/cartão/boleto | `packages/checkout` (Mercado Pago) | pronto |
| Frete por CEP (CepCerto no servidor, uma conta para todas) + tabela por UF + retirada | `Websites/brilhax.com/src/lib/frete.ts`, generalizado | pronto |
| Pedidos, webhook de pagamento, status | novo — `src/lib/pedidos.ts` | pronto |
| API administrativa (criar loja, importar produtos, provisionar, listar pedidos) | novo — `src/app/api/admin` | pronto |
| Provisionamento: zona + DNS na Cloudflare, domínio + caixa no `mail.avilaops.com`, evento n8n | novo — `src/lib/provisionar.ts` | pronto, sem teste em produção |
| Eventos para o n8n (loja criada, pedido criado/pago/recusado) | novo — `src/lib/eventos.ts` | pronto |
| Certificado sob demanda para domínio próprio (Caddy `on_demand_tls`) | `deploy/Caddyfile.snippet` + `/api/dominio-permitido` | pronto |
| **Plataforma autossuficiente** em `lojas.avilaops.com`: landing com planos, `/criar` (wizard 4 passos + senha), `/entrar`, `/painel` (produtos um a um ou CSV, pedidos com separar/enviar/entregar, aparência, entrega/tabela de frete, Mercado Pago, senha) | `src/proxy.ts` (reescreve o domínio-base para `src/app/plataforma`), `src/lib/sessao.ts` (scrypt + token HMAC em cookie), `src/app/api/painel/*` | pronto (25/08/2026) — substitui a tela que vivia no cliente.avilaops.com |

## O que falta (ordem sugerida)

1. ~~Tela de onboarding~~ — o portal `cliente.avilaops.com` foi apagado do servidor
   em 24/08/2026; a tela agora vive na própria plataforma (`/criar`, `/entrar`,
   `/painel`). Recuperação de senha (`/recuperar` → evento `lojista.recuperar-senha`
   no n8n → e-mail) e upload de foto/logo (`/api/painel/imagens`, servido em
   `/uploads/<slug>/<arquivo>`, volume `/opt/lojas/uploads`) feitos em 25/08/2026.
2. ~~Fluxo n8n `lojas-onboarding`~~ — criado em 24/08/2026 no n8n ("Lojas —
   Onboarding e Pedidos"; fonte em `docs/n8n-lojas-onboarding.ts`). Falta no n8n:
   preencher credenciais Twilio, "Lojas Webhook Auth" (header `authorization`,
   valor `Bearer <N8N_WEBHOOK_TOKEN>`) e "Lojas Admin Token"; o número WhatsApp
   do Twilio; publicar o fluxo e apontar `N8N_WEBHOOK_URL` para o webhook.
3. ~~Upload de imagem~~ — feito 25/08/2026. Falta ligar o removedor de fundo
   (`/opt/removedor-de-fundo`) para padronizar a foto.
4. **PayPal e Éfi** como adaptadores no `packages/checkout` (regra: sempre os três).
5. ~~Cobrança da mensalidade~~ — feita 25/08/2026: assinatura (preapproval) no
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
7. ~~Marcar pedido como enviado + rastreio pelo painel~~ — feito em 24/08/2026
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

## Deploy (Hetzner, Docker) — em produção desde 24/08/2026

O servidor (CX23, 4 GB, disco Docker sempre perto de 95%) **não builda**: o
build Next `standalone` é feito aqui no Windows e sobe pronto. Fluxo:

```bash
# 1. build local (Prisma gera também o engine debian-openssl-3.0.x — ver schema.prisma)
npx prisma generate && npx next build
cd .next/standalone && rm -rf lojas.avilaops.com/.next/static   && cp -r ../static lojas.avilaops.com/.next/static   && cp -r ../../public lojas.avilaops.com/public; cp -r ../../prisma lojas.avilaops.com/prisma   && tar --force-local -czf "$TMP/lojas-standalone.tgz" .
# 2. envia e reinicia
scp -i ~/.ssh/hetzner_avilaops "$TMP/lojas-standalone.tgz" root@178.105.82.48:/opt/lojas/standalone.tgz
ssh -i ~/.ssh/hetzner_avilaops root@178.105.82.48 'cd /opt/lojas && docker compose up -d --build && docker image prune -f'
# 3. migração nova? (do próprio servidor, contra o Postgres do host)
ssh ... 'cd /opt/lojas && tar xzf standalone.tgz ./lojas.avilaops.com/prisma && DATABASE_URL=$(grep ^DATABASE_URL= .env | cut -d= -f2- | sed s/host.docker.internal/127.0.0.1/) npx -y prisma@6 migrate deploy --schema lojas.avilaops.com/prisma/schema.prisma'
```

No servidor (`/opt/lojas`): `Dockerfile` de runtime (node:22-slim + `openssl`, cria o
symlink `@prisma/client-<hash>` que o Turbopack referencia e que o Windows não
gera), `docker-compose.yml` com `network_mode: bridge` (o Postgres do host escuta
em 172.17.0.1), `.env` (segredos gerados no servidor, chmod 600). Container
`lojas-avilaops`, porta `127.0.0.1:3080` (3070 é do Migdolus).

**Caddy** (`/etc/caddy/Caddyfile`): o `ask` global do `on_demand_tls` aponta para
`/api/dominio-permitido`, que repassa ao Comandeiro (3040) o que não for loja.
**Domínios próprios** das lojas entram por `import /etc/caddy/lojas.d/*.caddy`:
o timer `lojas-caddy-sync` (a cada 2 min) roda `/opt/lojas/caddy-sync.sh`, que lê
`GET /api/admin/dominios` e regenera o bloco + `systemctl reload caddy` só quando
mudou (fontes em `deploy/`). Sem isso o domínio cairia no `https://` do Comandeiro;
bloco `lojas.avilaops.com, *.lojas.avilaops.com` com `tls { on_demand }` —
não há certificado wildcard (Caddy sem módulo DNS da Cloudflare), cada loja ganha
o seu na primeira visita. **DNS**: `lojas` e `*.lojas` → A 178.105.82.48,
DNS-only (o `*.lojas` tem dois níveis e o Universal SSL da Cloudflare não cobre).

Demo: https://demo.lojas.avilaops.com

## Modelo comercial (resumo — detalhe em `docs/PLANOS.md`)

| | Site | **Loja** | Loja Pro |
|---|---|---|---|
| Setup | R$ 497 | R$ 497 | R$ 1.490 |
| Mensal | R$ 79 | **R$ 119** | R$ 349 |

Custo por loja na infra compartilhada: < R$ 10/mês. Lock-in é pelo padrão:
domínio, DNS, e-mail, automações e painel são da plataforma.
