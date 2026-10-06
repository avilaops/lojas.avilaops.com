# As mensagens da plataforma

**A plataforma manda as próprias mensagens desde 19/09/2026** — e-mail por SMTP
próprio, WhatsApp pela Cloud API da Meta. Antes ela emitia o evento e um fluxo
do n8n decidia o texto e apertava o botão.

O motivo de trazer para dentro está no histórico: em agosto a credencial SMTP
do n8n passou a devolver `535 5.7.8 authentication failed`, e **a confirmação
de pedido, o aviso de carrinho abandonado e o aviso de estoque simplesmente
não chegaram a ninguém** — por semanas, sem alarme nenhum, porque quem sabia
que a mensagem devia ter saído era um serviço que ninguém aqui monitorava
(`docs/ROTINAS.md`, "E-mails ao comprador: credencial trocada em 26/08/2026").

## Como funciona

```
emitir(evento) ─┬─ tipo que sabemos resolver e SMTP configurado?
                │      └─ grava AutomacaoEvento (EMITIDO) e dispara o consumo aqui mesmo
                │         (sem await: quem emitiu está no meio de um checkout)
                └─ senão: POST no webhook do n8n, como sempre foi

rotina automacoes.eventos (a cada minuto)
  └─ rede de proteção: pega o que o disparo imediato perdeu
     (processo reiniciado, SMTP fora do ar na hora)
```

Quem executa reivindica antes: o mesmo `UPDATE … WHERE status = 'EMITIDO'` que
já impedia duas entregas do webhook de agirem as duas. Se o n8n ainda estiver
ligado para um tipo, quem perder a corrida não vê a linha — nunca saem dois.

## Os tipos que saíram do n8n, e por qual canal

A tabela viva é `CANAIS_POR_TIPO`, em `src/lib/acoes-do-evento.ts`.

| Tipo | E-mail | WhatsApp |
|---|---|---|
| `lojista.recuperar-senha` | lojista: link para escolher senha nova | — |
| `lojista.confirmar-email` | quem está se cadastrando: link para confirmar o e-mail e criar a senha | — |
| `loja.voltou-ao-estoque` | quem pediu o aviso | — |
| `pedido.em-separacao` | comprador | — |
| `pedido.enviado` | comprador, com transportadora e rastreio se houver | — |
| `pedido.entregue` | comprador | — |
| `pedido.cancelado` | comprador, com motivo e valor | — |
| `loja.relatorio-semanal` | lojista: os cinco números da semana | — |
| `pedido.pago` | comprador: confirmação, itens e total | lojista: `pedido_pago_lojista` |
| `pedido.recusado` | comprador | comprador: `pagamento_recusado` |
| `carrinho.abandonado` | comprador | comprador: `carrinho_abandonado` |
| `loja.criada` | lojista | lojista: `loja_no_ar` |
| `loja.provisionada` | lojista | lojista: `loja_configurada` |
| `categoria.seo-pendente` · `categoria.seo-publicado` | — | — (só encerram o ciclo) |

**Um tipo só é nosso quando todos os canais dele estão configurados.** Sem
`WHATSAPP_TOKEN`, `pedido.pago` volta inteiro para o n8n — com e-mail e
WhatsApp — porque executar metade faria o aviso do lojista sumir sem ninguém
notar. Um teste cobra que nenhum tipo com WhatsApp declare só o e-mail.

### Os dois avisos que esperam

`pix_pendente` (30 min depois do pedido) e `loja_indicacoes` (3 dias depois de
a loja entrar no ar) **não são reação a um evento**: são espera. No n8n isso
era um nó de espera pendurado em `pedido.criado` e em `loja.ativada`.

Aqui viraram varredura (`src/lib/avisos-que-esperam.ts`), porque varredura
sobrevive a reinício de container e espera pendurada em execução não:

| Rotina | Cadência | O que procura |
|---|---|---|
| `pix.lembrete` | a cada 10 min | pedido Pix `AGUARDANDO_PAGAMENTO` criado entre 30 min e 24 h atrás |
| `loja.indicacoes` | todo dia às 10h | loja com `loja.ativada` emitido há 3 a 5 dias e que **continua** ATIVA |

Duas decisões dentro delas:

- **A data de entrada no ar não é coluna: é o próprio `loja.ativada`.** Ele sai
  uma vez só, na virada `PROVISIONANDO → ATIVA`, e a caixa de saída serve de
  registro. A regra "conta a partir de quando a loja ficou no ar" não depende
  de ninguém lembrar de preencher um campo.
- **Quem já foi avisado está na própria caixa de saída**, pelo `correlationId`.
  Sem coluna nova, e o reenvio manual pela tela continua funcionando como em
  qualquer outro evento.

**As duas dormem enquanto `N8N_WEBHOOK_URL` existir**, e dizem isso no resumo
da rotina em vez de parecer que rodaram e não acharam ninguém. O fluxo continua
recebendo `pedido.criado` e `loja.ativada` e fazendo o que sempre fez; ligar os
dois lados ao mesmo tempo mandaria o lembrete de Pix duas vezes, e a segunda
ninguém saberia de onde veio.

Também dormem quando nenhum canal do tipo está configurado — emitir um evento
que ninguém vai executar só encheria a fila.

### Como desligar o n8n

1. Pôr `SMTP_*` e `WHATSAPP_*` no ambiente do Lojas.
2. Conferir em `GET /api/admin/rotinas` que `automacoes.eventos` está rodando e
   em Configurações → Automações que os eventos estão fechando `PROCESSADO`.
3. **Tirar `N8N_WEBHOOK_URL`.** É isso que acorda `pix.lembrete` e
   `loja.indicacoes`.

Depois do passo 3, os tipos que ainda não têm canal aqui (`loja.ativada`,
`loja.suspensa`, `avaliacao.recebida`, `canal.pergunta-recebida` e os de
mensalidade) ficam `EMITIDO` na fila, visíveis na tela de Automações, sem
efeito externo. Eles são o que sobra para trazer depois — e ficar parado e
visível é melhor do que sair por um caminho que ninguém monitora.

## Quando um evento tem dois canais

Um `pedido.pago` manda e-mail ao comprador **e** WhatsApp ao lojista. Se o
segundo falhar, a nova tentativa não pode reenviar o primeiro: quem já recebeu
receberia duas vezes.

`AutomacaoEvento.canaisFeitos` guarda o que já saiu, gravado no instante em que
cada canal sai — não no fim. Container que morre entre um canal e outro não
custa uma mensagem repetida.

- Todos os canais cumpridos → `PROCESSADO`.
- Algum falhou → `FALHOU`, com o que saiu **e** o que falhou no detalhe. A
  nova tentativa cumpre só o que faltou.
- Nenhum canal tem destinatário → `IGNORADO`, com o motivo.

Um canal falhar não impede o outro de ser tentado: WhatsApp fora do ar não pode
segurar a confirmação de pedido do comprador.

## Ligar (e desligar)

```bash
# E-mail
SMTP_HOST=mail.avilaops.com
SMTP_PORTA=465          # 465 = TLS direto; 587 = STARTTLS
SMTP_USUARIO=...
SMTP_SENHA=...
EMAIL_REMETENTE=lojas@avilaops.com
EMAIL_REMETENTE_NOME="Avila Ops"

# WhatsApp (Cloud API da Meta) — ver docs/WHATSAPP-TEMPLATES.md
WHATSAPP_TOKEN=...      # System User permanente, não o temporário de 24 h
WHATSAPP_PHONE_ID=...   # o Phone Number ID, não o número
```

Os dois são independentes: ligar só o SMTP traz os sete tipos de e-mail e deixa
os cinco mistos no n8n. Ligar os dois traz os doze.

**Sem estas variáveis nada disso vale**: `emailConfigurado()` devolve `false`,
`emitir()` volta a mandar tudo para o n8n e o consumidor não reivindica um
evento sequer. É o que faz esta mudança nascer desligada — tirar as variáveis é
o rollback, sem deploy.

Remetente por loja: quando a plataforma provisionou `pedidos@<apex>`, o evento
traz `emailRemetente` e é ele que assina. Sem isso, o endereço é o da
plataforma e o **nome** que aparece é o da loja. `Reply-To` é sempre o lojista:
quem responde ao comprador é ele, não a Avila Ops.

## O cliente do WhatsApp

`src/lib/whatsapp.ts`. Toda mensagem que a loja inicia fora da janela de 24 h
exige **template aprovado** — não existe texto livre. Os sete templates estão
transcritos em `docs/WHATSAPP-TEMPLATES.md`; `src/lib/whatsapp-do-evento.ts`
só diz qual template e em que **ordem** os parâmetros vão. Errar a ordem manda
o nome do cliente no lugar do valor, e a Meta não tem como saber.

- **O número é normalizado, ou recusado.** O que está no banco veio de
  formulário: `(16) 99999-0000`, `+55 16 99999 0000`, `16999990000`. Número sem
  DDD é recusado em vez de chutado: mandar para o lugar errado é pior que não
  mandar.
- **Parâmetro não leva quebra de linha.** A Meta recusa a mensagem inteira com
  `(#132000)`, e um nome de produto com `\n` no meio derrubaria o aviso.
- **O valor vai sem o `R$`**, porque o template já o escreve.
- **O token nunca aparece no erro.** O que a Meta devolve em `error.message` é
  o que vira o detalhe do evento — "template não existe", "contagem de
  parâmetros" —, e isso é o que a tela mostra.

## O cliente SMTP

`src/lib/email.ts`, sem dependência nova — mesma decisão do escritor de
`.xlsx`. O que ele faz é um subconjunto pequeno e estável: EHLO, STARTTLS
quando preciso, AUTH LOGIN, MAIL/RCPT/DATA.

Decisões que estão no código:

- **O corpo sempre sai em base64.** Resolve de uma vez linha longa demais,
  ponto no começo da linha (que encerraria a mensagem no meio) e acento.
- **Cabeçalho não aceita quebra de linha** — é removida, não escapada. O nome
  da loja e o do produto são dados do lojista, e um `\r\n` ali acrescentaria
  um `Bcc:` à mensagem.
- **Acento em cabeçalho vai em RFC 2047**, senão a caixa de entrada mostra
  "PadÃ¡ria".
- **Senha nunca vai para o log.** A conferência de resposta troca o comando por
  `<credencial>` quando ele é do AUTH — justamente o caso em que alguém vai ler
  o log.
- **`Auto-Submitted: auto-generated`** em tudo: sem isso a resposta automática
  de férias do comprador volta e vira laço com o próximo aviso.
- **Um destinatário por mensagem.** E-mail em lote é lista de envios, não um
  envio com lista.
- **Erro de envio nunca é engolido.** Evento que fecha como "processado" sem a
  mensagem ter saído é pior que evento falhado: some da fila e ninguém procura.

## O que acontece quando dá errado

| Situação | Estado do evento | Onde aparece |
|---|---|---|
| e-mail saiu | `PROCESSADO`, com o destinatário e o Message-ID no detalhe | Configurações → Automações |
| evento não notifica ninguém (SEO) | `IGNORADO`, com o motivo | idem |
| sem endereço, ou endereço inválido | `IGNORADO` | idem |
| falta campo obrigatório | `FALHOU`, com o nome do campo | idem, com botão de reenviar |
| SMTP recusou ou caiu | `FALHOU`, com a resposta do servidor | idem |

Um evento `FALHOU` continua reenviável pela tela, com o mesmo corpo e um
`eventId` novo (teto de 3, `REENVIOS_MAXIMOS`).

A rotina `automacoes.eventos` não fica vermelha quando um envio falha — ela fez
o trabalho dela. Quem acusa é o próprio evento, e o resumo da rotina carrega a
contagem de falhas da última passada.

## Como conferir sem mandar mensagem a ninguém

O ciclo foi provado contra um **servidor SMTP de verdade** e uma **Graph API de
verdade**, os dois falando o protocolo em portas locais, e contra Postgres:

- emitir um `lojista.recuperar-senha` faz o e-mail sair sem o n8n no caminho,
  com o assunto acentuado chegando inteiro do outro lado;
- num `pedido.pago`, o e-mail vai ao comprador e o WhatsApp ao **lojista**;
- com o WhatsApp fora do ar, o e-mail ainda sai, o evento fica `FALHOU` com
  `canaisFeitos = ["email"]`, e a nova tentativa manda **só** o WhatsApp — o
  comprador não recebe duas vezes;
- template inexistente e contagem de parâmetros errada chegam como a Meta
  escreve (`#132001`, `#132000`), e o token não aparece no erro;
- duas passadas ao mesmo tempo mandam **uma** mensagem;
- sem `WHATSAPP_TOKEN`, `pedido.pago` volta inteiro para o n8n;
- sem canal nenhum, nada é reivindicado e nada é fechado.
