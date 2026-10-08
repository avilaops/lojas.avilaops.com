# Onboarding de uma loja: do formulário ao ar em minutos

Meta: **zero toque humano até a aprovação**. O que a C2TI faz com um júnior em
2–4 h, aqui é um POST.

## 0. Autoatendimento: conta primeiro (lojas.avilaops.com/criar)

O lojista que chega sozinho não passa pelo portal. A ordem é a pessoa, depois a
loja (`src/lib/cadastro.ts`):

| Passo | Onde | O que acontece |
|---|---|---|
| E-mail | `/criar` → `POST /api/painel/cadastro` | Evento `lojista.confirmar-email` com link assinado de 24 h. Quem já tem conta recebe o link de senha nova; a resposta é a mesma nos dois casos. |
| Senha | `/confirmar?token=` → `POST /api/painel/cadastro/confirmar` | Nasce o `Tenant` em `PROVISIONANDO`, com nome "Minha loja", endereço `nova-…`, `testeAte` = hoje + 7 dias, e a sessão já aberta. |
| Google | `/api/painel/google` → `/retorno` | Alternativa ao par e-mail + senha; só aparece com `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`. Conta nasce sem senha. |
| Loja | painel → `POST /api/painel/primeiros-passos` | Nome, WhatsApp e plano. O endereço definitivo nasce do nome, a loja vira `ATIVA` e saem `loja.criada` e `loja.ativada`. |
| Plano | painel → Configurações → Assinatura | Troca livre até existir assinatura no Mercado Pago; depois, pelo suporte. |

O e-mail sai pelo SMTP da plataforma (`EMAIL_REMETENTE`, ex.: noreply@avilaops.com).
Sem SMTP configurado o tipo volta para o n8n, que precisa conhecê-lo — ver
`docs/MENSAGENS.md`.

**Teste.** Loja nova tem 7 dias gravados em `Tenant.testeAte`; as anteriores à
coluna seguem com 14 dias contados da criação (`fimDoTeste` em
`src/lib/planos.ts`). A suspensão por falta de assinatura vem
`DIAS_TOLERANCIA` depois do fim do teste.

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
`https://<slug>.lojas.avilaops.com` - é esse link que vai para o cliente
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
`pendente:` - não bloqueia nada.

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

## 4. Painel do lojista (portal): endpoints já disponíveis

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

## 6. Checklist no painel

Na "Visão geral" do painel (`/painel`), enquanto falta algo para a loja vender,
aparece o bloco "Para a loja vender" com seis passos, nesta ordem. Cada passo
diz se está feito, o que falta e leva à tela onde se resolve.

| Passo | Está feito quando | Onde se resolve |
|---|---|---|
| Identidade | a loja tem símbolo da marca (`logoUrl`) e WhatsApp | `/painel/configuracoes/marca` |
| Domínio (opcional) | há domínio próprio (`dominioPrincipal`); não consulta DNS | `/painel/configuracoes/dominio` |
| Catálogo | há pelo menos um produto ativo | `/painel/produtos` |
| Recebimento | há credencial do Mercado Pago salva (`mpConfigurado`), por conexão da conta ou por chaves coladas | `/painel/configuracoes/recebimento` |
| Entrega | há CEP de origem com 8 dígitos, ou tabela de frete, ou entrega local, ou retirada com endereço público completo | `/painel/configuracoes/entrega` |
| Publicação | a loja está `ATIVA` e os quatro passos obrigatórios estão feitos | abre a loja |

- **O domínio é opcional.** Sem ele a loja já atende no endereço da plataforma
  (`<slug>.lojas.avilaops.com`), então ele não segura a publicação nem o fim do
  checklist.
- **Retirada sozinha não conta como entrega.** `retiradaNaLoja` nasce `true`;
  vale a mesma regra da vitrine (`retiradaPublicaDisponivel`).
- **O estado é derivado, não gravado.** Não há coluna, migração nem evento de
  "onboarding concluído": o checklist é calculado a cada visita a partir do que
  a loja tem (`checklistDeOnboarding` em `src/lib/checklist-onboarding.ts`, regra
  presa em `src/lib/checklist-onboarding.test.ts`). Por isso vale também para
  lojas antigas e não tem botão de dispensar.
- Quando nenhum passo obrigatório está pendente, o checklist some e volta o
  "Próximo passo" de sempre (imagem principal, fotos e medidas dos produtos).
