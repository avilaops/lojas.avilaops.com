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

## O que falta (ordem sugerida)

1. ~~Tela de onboarding no `cliente.avilaops.com`~~ — feita em 24/08/2026:
   `/dashboard/loja` (wizard de 4 passos + painel com produtos via CSV,
   pedidos, tema, domínio e credenciais Mercado Pago). Ponte em
   `cliente.avilaops.com/src/lib/lojas.ts`; precisa de `LOJAS_API_URL` e
   `LOJAS_ADMIN_TOKEN` no `.env` do portal e da migração `20260824150000_loja_virtual`.
2. ~~Fluxo n8n `lojas-onboarding`~~ — criado em 24/08/2026 no n8n ("Lojas —
   Onboarding e Pedidos"; fonte em `docs/n8n-lojas-onboarding.ts`). Falta no n8n:
   preencher credenciais Twilio, "Lojas Webhook Auth" (header `authorization`,
   valor `Bearer <N8N_WEBHOOK_TOKEN>`) e "Lojas Admin Token"; o número WhatsApp
   do Twilio; publicar o fluxo e apontar `N8N_WEBHOOK_URL` para o webhook.
3. **Upload de imagem** de produto (hoje é URL). Reaproveitar o removedor de
   fundo do catálogo para padronizar foto.
4. **PayPal e Éfi** como adaptadores no `packages/checkout` (regra: sempre os três).
5. **Cobrança da mensalidade** da loja (Mercado Pago recorrente, como no mail) e
   suspensão automática → `status: SUSPENSA` some o checkout, mantém a vitrine.
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
npm run dev                     # http://demo.localhost:3070
```

Criar loja pela API:

```bash
curl -X POST http://127.0.0.1:3070/api/admin/tenants?provisionar=1 \
  -H "authorization: Bearer $LOJAS_ADMIN_TOKEN" -H "content-type: application/json" \
  -d '{"slug":"vedashow","nome":"Vedashow","dominioPrincipal":"vedashow.com.br","whatsapp":"5516999990000","cepOrigem":"14075240","tema":{"corPrimaria":"#c62828"}}'
```

## Deploy (Hetzner, Docker)

O build usa a raiz do monorepo como contexto por causa de `packages/checkout`:

```bash
# no servidor, dentro de /opt/avilaops (raiz do monorepo)
cd lojas.avilaops.com && docker compose up -d --build
docker compose exec lojas npx prisma migrate deploy
```

Porta `127.0.0.1:3070`. Caddy: colar `deploy/Caddyfile.snippet` (curinga
`*.lojas.avilaops.com` via DNS-01 Cloudflare + `on_demand_tls` para domínios
próprios). DNS: `*.lojas.avilaops.com` → A do host, proxied.

## Modelo comercial (resumo — detalhe em `docs/PLANOS.md`)

| | Site | **Loja** | Loja Pro |
|---|---|---|---|
| Setup | R$ 497 | R$ 497 | R$ 1.490 |
| Mensal | R$ 79 | **R$ 119** | R$ 349 |

Custo por loja na infra compartilhada: < R$ 10/mês. Lock-in é pelo padrão:
domínio, DNS, e-mail, automações e painel são da plataforma.
