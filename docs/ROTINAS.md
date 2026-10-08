# As rotinas da plataforma

**A plataforma se agenda sozinha.** O relógio mora no mesmo container que
serve a loja (`src/instrumentation.ts` → `src/lib/rotinas-agendador.ts`), acorda
de minuto em minuto e roda o que venceu. Até 19/09/2026 quem chamava os
endpoints de tempos em tempos era o n8n — isto é, a parte mais crítica da
operação dependia de um serviço de fora estar de pé, sem ninguém ser avisado
quando não estava.

O catálogo do que roda sozinho é `ROTINAS`, em `src/lib/rotinas.ts`. O nome é
chave estável e vai para a tabela `Rotina`: renomear é migração, não
refatoração.

## O que roda, quando e o que faz

Cada rotina tem um nome de chave (estável, vai para o banco), um **título**
curto e uma descrição. O título existe porque a frase inteira não cabe como
título de linha num celular — no painel da Ávila Ops ela saía cortada em "Gera
e publica em lote o …". O teto é de 22 caracteres, medido num iPhone de 375 px
e preso por teste. Quem muda um deles mexe em `ROTINAS`, não na tela.

| Rotina | Título | Quando | O que faz | Disparo manual |
|---|---|---|---|---|
| `mercadolivre.avisos` | Vendas do ML | a cada 5 min | processa a fila de notificações do Mercado Livre: venda vira pedido e baixa estoque, envio vira rastreio, anúncio mexido vira pendência. **Quanto mais espaçado, maior a janela de vender a mesma peça duas vezes** | `POST /api/admin/canais/mercadolivre/avisos` |
| `mercadolivre.rodar` | Anúncios do ML | a cada hora | publica o que o lojista aprovou e empurra preço e estoque para os anúncios | `POST /api/admin/canais/mercadolivre/rodar` |
| `automacoes.eventos` | Fila de eventos | a cada minuto | executa os eventos que a plataforma resolve sozinha (`docs/MENSAGENS.md`) | — |
| `webhooks.entregar` | Webhooks da API | a cada minuto | entrega aos sistemas dos lojistas os avisos de pedido, com assinatura e novas tentativas (`docs/API.md`, "Webhooks") | — |
| `reservas.reconciliar` | Reservas sem resposta | a cada 10 min | confere no gateway as cobranças que estouraram o tempo: solta o estoque das que não nasceram e alerta as pagas sem pedido (`docs/ISOLAMENTO-OPERACIONAL.md`) | — |
| `pix.lembrete` | Lembrete de Pix | a cada 10 min | avisa quem gerou Pix há mais de 30 min e não pagou. Dorme enquanto `N8N_WEBHOOK_URL` existir | — |
| `loja.indicacoes` | Pedido de indicações | todo dia às 10h | 3 dias depois de a loja entrar no ar, se continuar ATIVA. Dorme enquanto `N8N_WEBHOOK_URL` existir | — |
| `carrinhos.verificar` | Carrinho abandonado | a cada hora | marca carrinho parado há 45 min e emite `carrinho.abandonado` | `POST /api/admin/carrinhos/verificar` |
| `estoque.avisos` | Voltou ao estoque | a cada hora | avisa quem esperava produto que voltou | `POST /api/admin/estoque/avisos` |
| `pedidos.verificar` | Pagamento pendente | a cada hora | confere no gateway os pedidos aguardando pagamento (Pix, boleto) dos últimos 7 dias. Rede de segurança do webhook | `POST /api/admin/pedidos/verificar` |
| `mercadopago.renovar` | Acesso ao MP | todo dia às 4h | renova o acesso das lojas conectadas ao Mercado Pago por OAuth que vence em até 30 dias. Termina em erro se alguma loja não renovar (`docs/MERCADO-PAGO-OAUTH.md`) | — |
| `seo.categorias` | SEO de categoria | todo dia às 3h | gera e publica SEO pendente em lote, sem IA no acesso público | `POST /api/admin/seo/categorias` |
| `cobranca.verificar` | Régua de cobrança | todo dia às 6h | suspende quem passou da tolerância | `POST /api/admin/cobranca/verificar` |
| `relatorios.semanal` | Relatório semanal | segunda às 7h | emite `loja.relatorio-semanal` por loja com movimento | `POST /api/admin/relatorios/semanal` |

**Loja atendida pela Ávila Ops sai da régua por dado.** A régua suspende toda
loja ATIVA sem assinatura autorizada, sem `setupPagoEm` e sem `cobrancaIsenta`
21 dias depois de criada (14 de teste + 7 de tolerância). Loja que nós montamos,
sem login do lojista ou com mensalidade paga por fora, não tem como assinar:
precisa de `cobrancaIsenta: true` logo depois de criada —
`PATCH /api/admin/tenants/:slug` (a criação pelo `POST` não aceita o campo).
Foi a falta disso que suspendeu a Brilhax em 06/10/2026
(migração `20261006130000_lojas_atendidas_isentas`).

Horário é o de São Paulo (`America/Sao_Paulo`), não o do servidor: "3h" é 3h de
quem usa a loja. Os endpoints continuam existindo e continuam pedindo
`Authorization: Bearer $LOJAS_ADMIN_TOKEN` — o que mudou é que eles viraram o
disparo manual, não mais o agendamento.

## Enquanto o agendamento antigo do n8n não for desligado

Os nós de Schedule do fluxo `p063mxq8dQijjBDL` continuam apontando para os
mesmos endpoints. Até serem desligados, cada rotina é chamada **duas vezes** no
mesmo horário — uma pelo agendador, outra pelo n8n. Nenhuma das duas sabe da
outra, então quem tem que aguentar isso é o trabalho em si:

| Rotina | Chamada duas vezes faz mal? |
|---|---|
| `mercadolivre.avisos` | não — cada aviso é reivindicado antes do efeito |
| `mercadolivre.rodar` | não — publica só o aprovado e sincroniza o que mudou |
| `carrinhos.verificar` | não — o checkout vira `LEMBRADO` e sai da fila |
| `estoque.avisos` | não — `AvisoEstoque.avisadoEm` |
| `pedidos.verificar` | não — só lê o gateway e concilia |
| `seo.categorias` | não — trava de 15 min por categoria |
| `cobranca.verificar` | não — fatura é upsert por `externalId`, e `suspender()` confere de novo |
| `relatorios.semanal` | **fazia** — ver abaixo |

O relatório semanal era o único que não se defendia: cada execução emitia outro
`loja.relatorio-semanal`, e o lojista receberia dois e-mails na segunda de
manhã. Passou a valer **uma vez por loja por semana**, olhando o próprio
`AutomacaoEvento` para saber o que já saiu — o que também protege contra um
disparo manual no mesmo dia. A janela é de 6 dias, não 7, para o relatório
legítimo da semana seguinte não ser recusado por alguns segundos de diferença.

Desligar os Schedule do n8n continua valendo, mas deixou de ser condição para
este deploy.

## Como um container não atropela o outro

A linha da tabela `Rotina` **é** a trava. Reivindicar é um
`UPDATE … WHERE proximaEm <= agora AND (executandoDesde IS NULL OR trava
vencida)`: dois containers do mesmo deploy tentam e só um recebe `count = 1`.
É o mesmo padrão do `AutomacaoEvento` e da fila de perguntas do Mercado Livre.

Decisões que estão no código e valem a pena conhecer:

- **Intervalo conta do fim da execução anterior**, não de um relógio fixo.
  Rotina que demorou 7 min não dispara duas vezes seguidas "recuperando o
  atraso".
- **O horário avança mesmo quando a rotina falha.** Rotina quebrada que não
  avança vira laço apertado a cada tique, martelando um serviço que já está com
  problema. Quem sinaliza a quebra é `falhasSeguidas`, não a fila parada.
- **Rotina de intervalo nasce vencida; rotina de horário, não.** Subir o
  container numa terça não pode disparar o relatório semanal de segunda.
- **Uma rotina por vez, em série.** São trabalhos de fundo no mesmo processo
  que serve a vitrine; disparar oito de uma vez às 3h competiria com o
  comprador.
- **Trava vencida volta para a fila.** Container que morreu no meio não deixa a
  rotina presa para sempre (`travaMinutos` por rotina).
- **A passada tem prazo: 10 minutos.** "Uma por vez" é uma trava dentro do
  processo, e trava cria a falha que ela mesma não vê — passada que nunca
  termina não falha, emudece: sem erro, sem `falhasSeguidas`, sem nada no
  endpoint de saúde, e o relógio inteiro para até alguém reiniciar o container.
  Não é hipótese: toda chamada de rede daqui tem prazo próprio, mas consulta ao
  banco não tem, e um lock no Postgres segura o `await` pelo tempo que durar.
  Vencido o prazo, o trabalho pendurado **não** é cancelado (não há como) — o
  que acontece é a guarda ser solta, para o próximo tique andar. A rotina que
  ficou pendurada segue com a linha travada até a `travaMinutos` dela vencer, o
  que é o tratamento certo: do ponto de vista da tabela, passada pendurada e
  container morto são a mesma coisa. Sai no log como
  `[rotina] passada não voltou em 10 min`. Ver `src/lib/passada-unica.ts`.

## Como saber que ainda está rodando

`GET /api/admin/rotinas` devolve, por rotina, quando rodou, quanto demorou, o
que devolveu, há quantas execuções está falhando e se está atrasada. O campo
`saudavel` no topo é a pergunta que um monitor deve fazer.

```bash
curl -s -H "Authorization: Bearer $LOJAS_ADMIN_TOKEN" \
  https://lojas.avilaops.com/api/admin/rotinas | jq '.saudavel, .rotinas[] | {nome, ultimaEm, falhasSeguidas}'
```

`POST /api/admin/rotinas/:nome` roda uma rotina agora, fora do horário,
respeitando a trava (apertar duas vezes não coloca duas execuções no ar).

Atraso é medido contra a própria cadência: 9 minutos de atraso não são nada no
relatório semanal e são sintoma na fila do Mercado Livre.

**O que ainda falta:** uma tela. Hoje a saúde das rotinas só existe como JSON
nesse endpoint — o lugar natural dela é o módulo Lojas do painel da Ávila OS,
que já lê esta API. Enquanto a tela não existe, o rastro de cada execução sai
no log do container, uma linha por rodada (`[rotina] <nome> <ms> <resumo>`).

## Desligar o relógio num container

`ROTINAS_AGENDADOR=0` desliga; `=1` liga. Sem a variável, o agendador fica
ligado em produção e desligado em desenvolvimento — `next dev` reinicia o
processo a cada salvamento, e disparar cobrança ou e-mail a partir daí seria um
acidente esperando acontecer. A variável é o que permite subir um container só
para servir requisições, sem relógio.

---

# O que ainda depende do n8n

O agendamento saiu; **executar o evento, não.** A plataforma continua emitindo
o evento e expondo o endpoint, e quem manda e-mail e WhatsApp ainda é o fluxo
**Lojas, Onboarding e Pedidos** (`p063mxq8dQijjBDL`). **O fluxo vivo é a fonte
da verdade** — não existe mais cópia em código dele neste repositório (a que
existia ficou fora de sincronia e induziu uma revisão inteira a erro).

Enquanto isso não for trazido para dentro, evento emitido sem o n8n de pé é
mensagem que não chega a ninguém.

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
2. só então **publicar** a versão em rascunho do fluxo `p063mxq8dQijjBDL`
   ("Hardening: contrato v1, idempotência, PIX por referência, ciclo fechado").

Publicar antes do deploy faz `Reivindicar Evento` receber 404 e nenhum aviso
sair.

## SEO de categorias V1

O roteador (`Rotear por Tipo de Evento`) conhece `categoria.seo-pendente` e
`categoria.seo-publicado` desde 29/08/2026 (saídas 18 e 19 → `Encerrar:
Processado`); a saída extra do fallback é a 20 e continua em `Encerrar: Ignorado`.

A rotina `seo.categorias` processa 10 por vez. O endpoint reivindica cada categoria com uma
trava de 15 minutos, gera o texto com Gemini ou fallback determinístico,
publica no Postgres e avisa o IndexNow. Execuções concorrentes não processam a
mesma categoria; falhas liberam a trava e mantêm `seoPendente=true`.

Para monitorar sem consumir IA, use `GET /api/admin/seo/categorias`. A resposta
informa `pendentes`, `processando`, `comErro` e `maisAntigaEm`. O evento
`categoria.seo-pendente` permite uma execução antecipada; a rotina diária
continua sendo a rede de segurança. Depois da publicação sai
`categoria.seo-publicado`.

**Ligado em 29/08/2026** no fluxo `p063mxq8dQijjBDL`: `Todo Dia às 3h` → `Gerar SEO de
Categorias` (`{"limite": 10}`, credencial Lojas Admin Token, `onError` continua) →
`SEO com Falha?` → `Todoist: SEO de Categoria Falhou` (número, motivo, id da
execução, regra 12 do QUADRO). Primeira rodada manual em 29/08 processou `drones`
(avila-ops-store) e `Pneus` (sandromotos) por fallback; a loja `demo` está
SUSPENSA e o lote só pega tenant ATIVA.

Desde 19/09/2026 quem chama às 3h é o agendador da plataforma, não o
`Todo Dia às 3h` do fluxo: o nó do n8n pode sair, e o alerta de falha passa a
sair de `falhasSeguidas` em `GET /api/admin/rotinas`.

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

## Loja-demo por formulário: 30/08/2026

Workflow **Lojas — Loja-demo por formulário** (`CE64HzanEWwy6xrn`), formulário
interno em `https://n8n.avilaops.com/form/lojas-demo` (login n8n). Existe para a
meta da ficha comercial: **5 lojas-demo por semana** a partir de dados públicos,
sem mão de dev.

```
Formulário (nome, segmento, cidade, CEP, WhatsApp, Instagram, cor, produtos, origem)
  └─ Montar Loja e Catálogo (Code)      slug, tema, endereço; uma linha por produto:
  │                                      nome; preço; categoria; link da foto
  ├─ POST /api/admin/tenants            cria a loja (sem provisionar: demo não precisa de DNS/e-mail)
  ├─ PATCH /api/admin/tenants/:slug     { status: ATIVA, cobrancaIsenta: true }
  ├─ PUT  …/produtos?importarImagens=1&tratar=1
  │                                      baixa cada foto para /uploads e passa no removedor de fundo
  ├─ Resumo (Code) → data table `lojas_demos` (rU1kKJ0XMPIn8OYA)
  ├─ Todoist "Mostrar a loja-demo ao dono" (amanhã, P3)
  └─ Página final com o link da loja
```

Regras que o fluxo respeita: a loja nasce **sem Mercado Pago** (vitrine e
carrinho funcionam, ninguém é cobrado) e **isenta da régua** (`cobrancaIsenta`),
então a rotina diária nunca a suspende. Linha de produto inválida não derruba a
importação: entra em "Linhas ignoradas" na tarefa. Foto que não baixa fica com a
URL original e é listada em "Fotos que não baixaram".

Testado em 30/08/2026 (execução 1296): loja criada, 2 produtos, 2 fotos baixadas
e tratadas, linha inválida reportada, linha na data table e tarefa no Todoist.
A loja de teste (`teste-demo-automatica`) e a tarefa foram apagadas depois.

## O circuito comercial das Lojas: 30/08/2026

Nada de planilha solta: leads, demos e régua vivem em data tables do n8n e a
informação volta para a mesma tabela de onde saiu.

```
Lojas — Leads de comércio local (ZYyy9O4CqDDR95nz)
  segunda 6h + /form/lojas-leads
  Overpass (OpenStreetMap) → filtra sem site, sem marca de rede, com telefone ou Instagram
  → upsert em `lojas_leads` (JovFRMuQg4xG9tNr) → Todoist "escolher 5 leads da semana"
                    │
                    ▼  (o operador copia a chave do lead)
Lojas — Loja-demo por formulário (CE64HzanEWwy6xrn)
  /form/lojas-demo → cria o tenant, ATIVA + cobrancaIsenta, importa produtos com foto tratada
  → marca o lead como DEMO_MONTADA com o slug  → grava em `lojas_demos` (rU1kKJ0XMPIn8OYA)
  → Todoist "mostrar ao dono"
                    │
                    ▼
Lojas — Régua da loja-demo (KmADL5B0HkeToNWY)
  diário 9h → lê `lojas_demos` → dia 2, 5, 12, 30 e 37 (ficha comercial §6)
  → Todoist por passo → grava o passo na própria linha (MONTADA→D2→D5→D12→D30→ENCERRADA)
  → no dia 37: PATCH /api/admin/tenants/:slug { status: CANCELADA }

Lojas — Manutenção das tabelas (wqW9qasy4oLYWC3P)
  /form/lojas-manutencao apaga linha de lojas_demos (slug) ou lojas_leads (chave)
```

Regras que fazem o circuito não se atropelar:

- O upsert dos leads **não escreve** `status` nem `demo_slug`: o que a mão
  humana (ou a demo) escreveu fica. Coluna `status` vazia = lead novo.
- A régua só age quando o marco calculado é **maior** que o status gravado, então
  rodar duas vezes no mesmo dia não duplica tarefa. `CLIENTE` ou `PAUSADA` na
  linha tira a demo da régua.
- A contagem parte de `mostrada_em` quando existir; senão, de `montada_em`.
- Um lead marcado `DEMO_MONTADA` cuja loja não abre significa demo apagada:
  remontar pelo formulário.

Testado em 30/08/2026: 70 leads de Ribeirão Preto gravados (execução 1298), demo
da Tatinha Modas montada com o lead marcado (execução 1305), régua rodando sem
duplicar (execuções 1309 e 1313). As lojas e linhas de teste foram apagadas.

## Backup e restauração: conferidos em 30/08/2026

O dump de todos os bancos roda às 3h30 (cron `backup-todos-bancos`, dumps em
`/opt/backups/db`, rotação diária às 3h40 pelo timer `avilaops-rotacionar-backups`).

**Quatro bancos de produtos no ar estavam fora da lista** e nunca haviam sido
copiados: `lojas`, `ia`, `migdolus` e `sms`. A lista do script é explícita, e
quem cria banco novo precisa acrescentar ali. Corrigido no mesmo dia; a lista
também perdeu `jurisflow_poc`, `pkvedacoes_medusa` e `pkvedacoes_site`, que não
existem mais.

**A restauração foi testada de verdade**, não presumida: o dump de
`host-lojas-20260830.sql.gz` foi restaurado num banco descartável
(`restore_teste`, criado pelo superusuário porque o usuário `lojas` não cria
banco) e comparado com o vivo. Bateu tudo: 3 lojas, 32 produtos, 8 categorias,
23 migrações, com status e isenção de cobrança preservados. O banco de teste foi
apagado depois.

Para refazer o teste:

```bash
sudo -u postgres psql -c "create database restore_teste owner lojas"
gunzip -c /opt/backups/db/host-lojas-AAAAMMDD.sql.gz | psql "postgresql://lojas:SENHA@127.0.0.1:5432/restore_teste"
# comparar contagens com o banco vivo, depois:
sudo -u postgres psql -c "drop database restore_teste"
```

O mesmo procedimento (dump, migração, volta ao dump, migração de novo) tem um
ensaio que roda sem servidor, no Postgres descartável: `npm run banco:ensaio`.
O que ele prova e o que fica de fora está em `docs/BACKUP-E-ROLLBACK.md`.
