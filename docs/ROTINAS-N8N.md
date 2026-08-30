# Rotinas que o n8n precisa chamar

A plataforma nunca manda e-mail nem WhatsApp por conta própria: ela emite o
evento e expõe o endpoint. Quem executa é o fluxo **Lojas, Onboarding e
Pedidos** (`ruVn7ddvPQB949p9`). **O fluxo vivo é a fonte da verdade** — não
existe mais cópia em código dele neste repositório (a que existia ficou fora
de sincronia e induziu uma revisão inteira a erro).

## Contrato dos eventos (v1) e o caminho de entrada: 29/08/2026

Todo evento sai de `src/lib/eventos.ts` num envelope:

```json
{ "eventId": "evt_…", "versao": 1, "ocorridoEm": "2026-08-29T16:20:00Z", "origem": "lojas.avilaops.com",
  "tipo": "pedido.pago", "slug": "vedashow", "…dados achatados ao lado" }
```

Regras do contrato: dinheiro é inteiro em centavos (`totalCentavos`,
`precoCentavos`, nunca `total`); listas vão como array (`itens`) **e** como
texto pronto (`itensTexto`); `emailRemetente` só vem preenchido quando a
plataforma provisionou `pedidos@<apex>` — nunca é entrada do usuário.

O que acontece no n8n antes de qualquer WhatsApp/e-mail:

```
Receber Evento → Validar Contrato → Contrato Válido? ─não→ Todoist "Evento inválido" (nada é enviado)
                                          │sim
                                   Reivindicar Evento (POST /api/admin/automacoes/eventos/reivindicar)
                                          │
                                   Evento Novo? ─duplicado→ fim (o webhook é at-least-once)
                                          │novo
                                   Normalizar → Rotear por Tipo → … → Encerrar: Processado | Ignorado
```

- `Validar Contrato` (Code) exige `eventId`, `versao = 1`, `tipo`, `slug` e os
  campos obrigatórios do tipo. Tipo desconhecido **não** é inválido: passa,
  cai no fallback do switch e é encerrado como `IGNORADO`.
- `Reivindicar Evento` é a trava de idempotência: um `UPDATE … WHERE status =
  'EMITIDO'` na tabela `AutomacaoEvento`. Dois webhooks iguais nunca passam os
  dois. Se a plataforma não conseguiu registrar o evento na emissão (banco
  fora), a reivindicação cria a linha na hora.
- `Encerrar: Processado` / `Encerrar: Ignorado` (PATCH
  `/api/admin/automacoes/eventos/:eventId`) fecham o ciclo:
  `EMITIDO → PROCESSANDO → PROCESSADO | IGNORADO`. Evento parado em
  `PROCESSANDO` por horas = execução que morreu no meio (o error workflow
  `weeyGMEHqlw9ZEG0` avisa). `GET` no mesmo endpoint responde "o n8n chegou a
  executar isso?".
- A plataforma responde 200 ao n8n no `onReceived`; a responsabilidade é
  dividida: a plataforma garante "entreguei", o n8n registra "executei".

### Eventos de provisionamento

`loja.provisionada` (tudo ok) e `loja.provisionamento-falhou` são tipos
distintos — o n8n não deduz erro lendo `passos`, só reage ao tipo. Além deles,
`loja.ativada` sai **uma única vez**, na virada `PROVISIONANDO → ATIVA`: é o
gatilho do pedido de indicações (3 dias depois, e só se a loja **continuar**
`ATIVA` — o fluxo consulta `GET /api/admin/tenants/:slug` antes de mandar).
Antes o prazo contava a partir de `loja.criada`, o que cobrava indicação de
loja ainda nem aprovada.

### Lembrete de PIX

30 min depois de `pedido.criado` com `meioPagamento = pix`, o fluxo consulta
`GET /api/admin/pedidos/:referencia/status` (só o pedido, só o estado) e manda
o template `pix_pendente` se `aguardandoPagamento` for `true`. Antes ele
listava os 200 pedidos da loja para achar um.

### Sequência de deploy desta mudança

O fluxo novo depende dos endpoints novos. Ordem obrigatória:

1. deploy da plataforma + `prisma migrate deploy` (`20260829000000_automacao_evento`);
2. só então **publicar** a versão em rascunho do fluxo `ruVn7ddvPQB949p9`
   ("Hardening: contrato v1, idempotência, PIX por referência, ciclo fechado").

Publicar antes do deploy faz `Reivindicar Evento` receber 404 e nenhum aviso
sair.

Todos os POST abaixo vão com `Authorization: Bearer $LOJAS_ADMIN_TOKEN`.

| Quando | Endpoint | O que faz |
|---|---|---|
| a cada hora | `POST /api/admin/carrinhos/verificar` | marca carrinho parado há 45 min e emite `carrinho.abandonado` |
| a cada hora | `POST /api/admin/estoque/avisos` | avisa quem esperava produto que voltou |
| diário, 3h | `POST /api/admin/seo/categorias` | gera e publica SEO pendente em lote, sem IA no acesso público |
| diário | `POST /api/admin/cobranca/verificar` | suspende quem passou da tolerância |
| segunda 7h | `POST /api/admin/relatorios/semanal` | emite `loja.relatorio-semanal` por loja com movimento |

## SEO de categorias V1

O fluxo diário envia `{ "limite": 10 }` para
`POST /api/admin/seo/categorias`. O endpoint reivindica cada categoria com uma
trava de 15 minutos, gera o texto com Gemini ou fallback determinístico,
publica no Postgres e avisa o IndexNow. Execuções concorrentes não processam a
mesma categoria; falhas liberam a trava e mantêm `seoPendente=true`.

Para monitorar sem consumir IA, use `GET /api/admin/seo/categorias`. A resposta
informa `pendentes`, `processando`, `comErro` e `maisAntigaEm`. O evento
`categoria.seo-pendente` permite uma execução antecipada; o agendamento diário
continua sendo a rede de segurança. Depois da publicação sai
`categoria.seo-publicado`.

**Ligado em 29/08/2026** no fluxo `ruVn7ddvPQB949p9`: `Todo Dia às 3h` → `Gerar SEO de
Categorias` (`{"limite": 10}`, credencial Lojas Admin Token, `onError` continua) →
`SEO com Falha?` → `Todoist: SEO de Categoria Falhou` (número, motivo, id da
execução, regra 12 do QUADRO). Primeira rodada manual em 29/08 processou `drones`
(avila-ops-store) e `Pneus` (sandromotos) por fallback; a loja `demo` está
SUSPENSA e o lote só pega tenant ATIVA.

Nós sugeridos: **Schedule Trigger (3h)** → **HTTP Request / lote** →
**IF falhas.length > 0** → alerta operacional. Não coloque o token administrativo
no corpo ou na URL; use a credencial de header do n8n.

## `loja.voltou-ao-estoque`: ligado em 26/08/2026

Pendurado no gatilho **A Cada Hora** que já existia (não foi criado outro
schedule): ele dispara `Verificar Carrinhos Abandonados` e `Verificar Fila de
Estoque` em paralelo. O evento cai na saída `loja.voltou-ao-estoque` do switch
e vai para o nó **E-mail: Voltou ao Estoque**.

Campos que o `Normalizar Evento` passou a expor: `destinatario`, `precoReais`
(`produtoNome`, `nome`, `url` e `emailRemetente` já existiam). O Reply-To sai
de `lojistaEmail`, que vem do `emailContato` no evento.

O endpoint é idempotente (`AvisoEstoque.avisadoEm`): rodar de novo não avisa
ninguém duas vezes.

## E-mails ao comprador: credencial trocada em 26/08/2026

A credencial **"SMTP account"** devolvia `535 5.7.8 authentication failed`.
Ela era a dos três e-mails que vão para o comprador, confirmação de pedido,
carrinho abandonado e o novo aviso de estoque -, ou seja, **nenhum deles
chegava a ninguém**. Os três passaram a usar a mesma credencial dos e-mails ao
lojista (`SMTP mail.avilaops.com`, id `tSZlEjwt75qo2MwC`), com remetente
`<nome da loja> <lojas@avilaops.com>` e Reply-To do lojista.

O ideal ainda é cada loja enviar pelo próprio domínio (o provisionamento já
cria `contato@` no mail.avilaops.com), mas isso exige uma credencial SMTP por
loja no n8n, não é padronizável hoje. Enquanto isso, o endereço que autentica
é o da plataforma e o nome que aparece é o da loja.
