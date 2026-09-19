# O e-mail da plataforma

**A plataforma manda os próprios e-mails desde 19/09/2026.** Antes ela emitia o
evento e um fluxo do n8n decidia o texto e apertava o botão.

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

## Os tipos que saíram do n8n

| Tipo | Vai para | O quê |
|---|---|---|
| `lojista.recuperar-senha` | lojista | link para escolher senha nova |
| `loja.voltou-ao-estoque` | quem pediu aviso | produto disponível de novo |
| `pedido.em-separacao` | comprador | pedido entrou em separação |
| `pedido.enviado` | comprador | saiu para entrega, com transportadora e rastreio se houver |
| `pedido.entregue` | comprador | consta como entregue |
| `pedido.cancelado` | comprador | cancelado, com motivo e valor |
| `loja.relatorio-semanal` | lojista | os cinco números da semana |
| `categoria.seo-pendente` | ninguém | encerra o ciclo sem notificar |
| `categoria.seo-publicado` | ninguém | idem |

**O que continua no n8n, e por quê.** `pedido.pago`, `pedido.criado`,
`pedido.recusado`, `carrinho.abandonado`, `loja.criada` e `loja.provisionada`
mandam **e-mail e WhatsApp**. Trazer só a metade de e-mail para cá faria o
aviso do lojista sumir sem ninguém notar. Eles saem do n8n quando o WhatsApp
sair junto — a lista de templates está em `docs/WHATSAPP-TEMPLATES.md`.

A lista viva é `TIPOS_COM_EMAIL_PROPRIO` em `src/lib/emails-do-evento.ts`, e um
teste cobra que nenhum tipo com WhatsApp entre nela por engano.

## Ligar (e desligar)

```bash
SMTP_HOST=mail.avilaops.com
SMTP_PORTA=465          # 465 = TLS direto; 587 = STARTTLS
SMTP_USUARIO=...
SMTP_SENHA=...
EMAIL_REMETENTE=lojas@avilaops.com
EMAIL_REMETENTE_NOME="Avila Ops"
```

**Sem estas variáveis nada disso vale**: `emailConfigurado()` devolve `false`,
`emitir()` volta a mandar tudo para o n8n e o consumidor não reivindica um
evento sequer. É o que faz esta mudança nascer desligada — tirar as variáveis é
o rollback, sem deploy.

Remetente por loja: quando a plataforma provisionou `pedidos@<apex>`, o evento
traz `emailRemetente` e é ele que assina. Sem isso, o endereço é o da
plataforma e o **nome** que aparece é o da loja. `Reply-To` é sempre o lojista:
quem responde ao comprador é ele, não a Avila Ops.

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

## Como conferir sem mandar e-mail a ninguém

O ciclo foi provado contra um servidor SMTP de verdade, falando o protocolo
numa porta local, e contra Postgres. O que ficou provado:

- emitir um `lojista.recuperar-senha` faz o e-mail sair sem o n8n no caminho,
  com o assunto acentuado chegando inteiro do outro lado;
- duas passadas ao mesmo tempo mandam **uma** mensagem;
- `pedido.pago` (que ainda é do n8n) não é tocado;
- sem `SMTP_HOST`, nada é reivindicado e nada é fechado.
