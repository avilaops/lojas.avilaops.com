# Automações do Lojas no n8n

O que está aqui é a cópia versionada do fluxo vivo. **O fluxo vivo manda**:
antes de editar este JSON, baixe o atual pela API (`GET
/api/v1/workflows/p063mxq8dQijjBDL`), aplique a mudança sobre ele e suba com
`PUT`. Editar o arquivo do repositório sem baixar antes é o erro que já
derrubou uma revisão inteira (ver `ROTINAS-N8N.md`).

## Divisão de responsabilidades

| Camada | Faz | Não faz |
|---|---|---|
| Painel do Lojas | tela, formulário, estado, botão de reenviar | chamar serviço externo |
| Backend do Lojas | valida, persiste, emite o evento com outbox, expõe endpoints internos, transações de pedido/estoque/saldo | mandar WhatsApp ou e-mail |
| n8n | recebe o evento, reivindica, executa o efeito externo (Meta, SMTP, Todoist), encerra o ciclo; rotinas agendadas chamam endpoints internos | escrever direto no Postgres do Lojas |
| Postgres do Lojas | fonte oficial: `Pedido`, `Pagamento`, `AutomacaoEvento` | depender do histórico de execução do n8n |

## Fluxos

| Arquivo | id no n8n | Gatilho | Finalidade |
|---|---|---|---|
| `lojas-onboarding-e-pedidos.json` | `p063mxq8dQijjBDL` | webhook `POST /webhook/lojas-eventos` (header `Lojas Webhook Auth`) + 4 schedules | todo evento da plataforma e todas as rotinas |

Subfluxos reutilizados (não são deste repositório): `Conector: e-mail padrão`
(`QG7wbU8SfM9ldM8E`), `Handler de Erro Central → Todoist` (`dtk7UwKorqvDIqfu`).

## Contrato de entrada (v1)

```json
{ "eventId": "evt_<32 hex>", "versao": 1, "ocorridoEm": "ISO", "origem": "lojas.avilaops.com",
  "correlationId": "pedido:<referencia> | loja:<slug>", "tipo": "pedido.pago", "slug": "vedashow",
  "...campos do tipo achatados" }
```

Regras: dinheiro em centavos inteiros; `itens` como array **e** `itensTexto`;
`emailRemetente` só quando a plataforma provisionou; `correlationId` vem da
plataforma e o n8n o devolve no `reivindicar`. A lista de campos obrigatórios
por tipo vive no nó `Validar Contrato` e em `src/lib/eventos.ts`
(`EventoPlataforma`); os dois têm que concordar.

Tipos conhecidos (23): `loja.criada`, `loja.provisionada`,
`loja.provisionamento-falhou`, `loja.ativada`, `loja.identidade-atualizada`,
`loja.suspensa`, `loja.reativada`, `loja.mensalidade-paga`,
`loja.mensalidade-recusada`, `loja.relatorio-semanal`,
`loja.voltou-ao-estoque`, `lojista.recuperar-senha`, `pedido.criado`,
`pedido.pago`, `pedido.recusado`, `pedido.em-separacao`, `pedido.enviado`,
`pedido.entregue`, `pedido.cancelado`, `carrinho.abandonado`,
`avaliacao.recebida`, `categoria.seo-pendente`, `categoria.seo-publicado`.
Tipo desconhecido não é inválido: cai no fallback e encerra `IGNORADO`.

## Ciclo de vida e idempotência

```
plataforma: grava AutomacaoEvento (EMITIDO, payload) → POST webhook (timeout 5 s)
n8n:        Validar Contrato → Reivindicar (EMITIDO→PROCESSANDO, único UPDATE condicional)
            → duplicado? fim : efeito externo → Encerrar PROCESSADO | IGNORADO
rotina:     A Cada Hora → Varrer: EMITIDO >15 min ou PROCESSANDO >5 dias → FALHOU
painel:     Configurações → Automações lista por loja; FALHOU tem "Reenviar"
reenvio:    mesmo payload, eventId novo, tentativas+1, teto 3 (REENVIOS_MAXIMOS)
```

O reenvio nunca reconstrói o evento: reabre o corpo guardado. Um evento FALHOU
sem `payload` (anterior a 12/09/2026) não pode ser reenviado, e a tela diz isso.

## Contrato de saída (o que o n8n chama no Lojas)

Todos com `Authorization: Bearer $LOJAS_ADMIN_TOKEN` (credencial `Lojas Admin
Token`, `BIftJgoyPwxr2d55`):

| Endpoint | Quando |
|---|---|
| `POST /api/admin/automacoes/eventos/reivindicar` | antes de qualquer efeito |
| `PATCH /api/admin/automacoes/eventos/:eventId` | fim do ramo (`PROCESSADO`/`IGNORADO`/`FALHOU`) |
| `POST /api/admin/automacoes/eventos/varrer` | a cada hora |
| `GET /api/admin/pedidos/:referencia/status` | 30 min após `pedido.criado` Pix |
| `GET /api/admin/tenants/:slug` | 3 dias após `loja.ativada` |
| `POST /api/admin/carrinhos/verificar`, `/estoque/avisos`, `/pedidos/verificar` | a cada hora |
| `POST /api/admin/cobranca/verificar` | diário 6h |
| `POST /api/admin/seo/categorias` | diário 3h |
| `POST /api/admin/relatorios/semanal` | segunda 7h |

## Credenciais que o fluxo usa (sem valor aqui)

`Lojas Webhook Auth` (header no webhook de entrada), `Lojas Admin Token`
(bearer), `WhatsApp Cloud API (Meta)` (header), `Todoist OAuth2` (OAuth, só
pelo navegador), SMTP via subfluxo. Valores: `/etc/avilaops/tokens.env` no
servidor e o cofre em `app.avilaops.com/operacao/automacoes`.

## Variáveis de ambiente do Lojas

`N8N_WEBHOOK_URL`, `N8N_WEBHOOK_TOKEN`, `LOJAS_ADMIN_TOKEN` em
`/opt/lojas/.env`.

## Importar / atualizar / reverter

```
# baixar o vivo
curl -H "X-N8N-API-KEY: $K" https://n8n.avilaops.com/api/v1/workflows/p063mxq8dQijjBDL > vivo.json
# aplicar mudança sobre vivo.json (script, nunca à mão) e subir
curl -X PUT -H "X-N8N-API-KEY: $K" -H "content-type: application/json" \
  --data-binary @novo.json https://n8n.avilaops.com/api/v1/workflows/p063mxq8dQijjBDL
```

Reverter é subir a versão anterior do arquivo deste diretório (ou a cópia
`vivo.json` que se baixou antes). O n8n também guarda `versionId` por save.
Ordem obrigatória quando o fluxo depende de endpoint novo: **deploy do Lojas
primeiro, PUT do fluxo depois**.

## Validação

1. `npx tsx --test src/lib/eventos.test.ts` (contrato).
2. Emitir um evento de teste e conferir em Configurações → Automações que
   ficou `Feito` (`PROCESSADO`) com `concluidoEm`.
3. `GET /api/admin/automacoes/eventos?status=FALHOU` vazio, ou cada item com
   motivo em `detalhe`.
4. Reenviar um FALHOU pela tela e ver a linha nova nascer `EMITIDO` → `Feito`.

## Estado (12/09/2026)

| Item | Estado |
|---|---|
| fluxo `p063mxq8dQijjBDL` | ativo, 62 nós, 23 tipos roteados |
| `pedido.em-separacao / entregue / cancelado` | emitidos pelo Lojas e roteados (e-mail ao comprador) |
| `pedidos/verificar` | agendado no `A Cada Hora` |
| `correlationId` | no envelope, no outbox e devolvido pelo `reivindicar` |
| reenvio | endpoint + botão no painel |
| tela Configurações → Automações | no ar |
| Todoist OAuth | credencial precisa ser reconectada no navegador (perdida em 08/09) |
| Mercado Livre sync, cotação de frete | já são síncronos no backend (CepCerto, ML API); não passam pelo n8n de propósito: precisam responder no checkout |
