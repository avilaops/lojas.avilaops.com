# Onboarding de uma loja — do formulário ao ar em minutos

Meta: **zero toque humano até a aprovação**. O que a C2TI faz com um júnior em
2–4 h, aqui é um POST.

## 1. Formulário (cliente.avilaops.com → `/dashboard/loja`)

Campos, na ordem em que o cliente consegue responder sem pensar:

| Passo | Campos | Vai para |
|---|---|---|
| Sua loja | nome, slogan, WhatsApp, Instagram, e-mail de contato | `Tenant` |
| Visual | logo (upload), cor principal, fonte, modo claro/escuro | `Tenant.logoUrl`, `Tenant.tema` |
| Endereço | CEP → ViaCEP preenche; número; retirada na loja? horário | `Tenant.endereco`, `cepOrigem`, `retiradaNaLoja` |
| Produtos | planilha (nome, categoria, preço, sku, descrição, foto) ou "cadastro depois" | `PUT /api/admin/tenants/:slug/produtos` |
| Domínio | tem domínio? (qual) / quer registrar (busca no portal) / só o subdomínio por enquanto | `Tenant.dominioPrincipal` + `DomainOrder` do portal |
| Pagamento | Mercado Pago: public key + access token (com vídeo de 1 min de onde pegar) | `Tenant.mercadoPago` (cifrado) |

Ao enviar, o portal chama:

```http
POST /api/admin/tenants?provisionar=1
authorization: Bearer LOJAS_ADMIN_TOKEN
```

e recebe `{ slug, url, status, provisionamento }`. A loja já responde em
`https://<slug>.lojas.avilaops.com` — é esse link que vai para o cliente
aprovar.

## 2. O que `provisionar` faz sozinho

```
criarTenant ─► evento loja.criada (n8n)
     │
     ├─ dns   Cloudflare: zona (cria se não existir), A/AAAA apex, CNAME www → plataforma
     │        (padrão avilaops.com; NS da zona são devolvidos para o Registro.br)
     ├─ mail  mail.avilaops.com: POST /domains → MX/SPF/DKIM/DMARC gravados na zona
     │        POST /mailboxes contato@ (5 GB) + aliases pedidos@ e vendas@
     │        Tenant.emailRemetente = pedidos@dominio
     └─ n8n   evento loja.provisionada com o resultado de cada passo
```

Cada passo é idempotente; `POST /api/admin/tenants/:slug/provisionar` pode
rodar de novo depois de corrigir uma credencial. Passo sem credencial fica
`pendente:` — não bloqueia nada.

## 3. Fluxo n8n `lojas-onboarding` (a construir)

Webhook único (`N8N_WEBHOOK_URL`) recebendo `{ tipo, slug, ... }`:

| Evento | Ação |
|---|---|
| `loja.criada` | WhatsApp (Twilio) para o lojista com o link de aprovação + e-mail com 3 vídeos (cadastrar produto, ver pedido, trocar cor). Cria tarefa no Todoist "Aprovar loja <slug>" para 48 h. |
| `loja.provisionada` | Se algum passo `erro:` → tarefa no Todoist para a Avila Ops. Se tudo `ok` → WhatsApp "sua loja está no ar em <domínio>". |
| `pedido.criado` | Nada (aguarda pagamento). Se em 30 min não virar `pedido.pago` e for PIX → WhatsApp de carrinho quase fechado para o comprador. |
| `pedido.pago` | WhatsApp para o lojista: "Pedido #N pago, R$ X, separar até <data>". E-mail de confirmação ao comprador via `pedidos@dominio` (SMTP 587 do mail). |
| `pedido.recusado` | WhatsApp ao comprador oferecendo PIX. |
| 3 dias após aprovação | Pede as 2 indicações (condição do desconto do setup) e registra no CRM. |

## 4. Painel do lojista (portal) — endpoints já disponíveis

| Tela | Endpoint |
|---|---|
| Produtos (lista/importar) | `GET/PUT /api/admin/tenants/:slug/produtos` |
| Pedidos | `GET /api/admin/tenants/:slug/pedidos` |
| Aparência / contato / frete / pagamento | `PATCH /api/admin/tenants/:slug` |
| Reprovisionar | `POST /api/admin/tenants/:slug/provisionar` |

O portal fala com esta API pelo token de serviço, nunca o navegador do lojista.

## 5. Webhook do Mercado Pago

Cadastrar no painel MP da loja:
`https://<dominio-da-loja>/api/webhooks/mercadopago?loja=<slug>`
com o "segredo de assinatura" copiado para `mercadoPago.webhookSecret`.
