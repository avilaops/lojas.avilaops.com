# Isolamento operacional

O servidor de produção é dividido por todas as lojas. Uma loja que manda um
arquivo enorme, ou uma integração que pendura a conexão, não pode tirar
memória nem tempo das outras. Este documento diz o que já tem teto e o que
falta. Os números saem do código: se mudar lá, mude aqui no mesmo commit.

Item de roadmap: `docs/ROADMAP-PLATAFORMA.md`, Tranche 3, "Melhorar isolamento
operacional".

## Tetos de upload

As constantes moram em `src/lib/limites-upload.ts`.

| Caminho | Teto | Resposta ao passar |
|---|---|---|
| `POST /api/painel/imagens` (corpo, pelo `content-length`) | 5 MB + 64 KB de folga do multipart | 413 "Imagem acima de 5 MB." |
| `POST /api/painel/imagens` (arquivo) | 5 MB | 422 "Imagem acima de 5 MB." |
| `POST /api/painel/imagens?tratar=1` (arquivo) | 5 MB | 422 "Imagem acima de 5 MB." |
| `POST /api/painel/produtos/planilha` (corpo, pelo `content-length`) | 12 MB + 64 KB de folga do multipart | 413 "Arquivo muito grande (máximo 12 MB). Divida a planilha em partes." |
| `POST /api/painel/produtos/planilha` (arquivo) | 12 MB | 413, mesma mensagem |
| Qualquer `/api/painel/*` (corpo, no Caddy, com ou sem `content-length`) | 13 MiB | 413 do Caddy, sem chegar à aplicação |
| `importarImagemDeUrl` (`src/lib/uploads.ts`, imagem baixada de URL) | 10 MB | `UploadInvalido` "Imagem acima de 10 MB." |
| `removerFundo` (`src/lib/fundo.ts`, entrada do removedor) | 30 MB | `FundoIndisponivel` |

Como o teto vale:

- **Antes de ler o corpo.** As duas rotas multipart chamam `corpoAcimaDoTeto`
  antes de `request.formData()`, que carrega o corpo inteiro na memória. A
  ordem está em `src/lib/envios-do-painel.ts` e presa em teste
  (`src/lib/envios-do-painel.test.ts`): 413 sem ler o corpo, e 422 do
  `?tratar=1` sem chamar o removedor. A
  conferência vem depois do `exigir("catalogo")`: quem não está logado continua
  recebendo o erro de acesso. A folga de 64 KB cobre o envelope multipart; a
  regra exata continua sendo o `arquivo.size`, conferido em seguida.
- **Durante a leitura.** `importarImagemDeUrl` lê a resposta em fluxo com
  `lerComTeto` e para no teto. Origem que não manda `content-length` não
  consegue mais entregar o arquivo inteiro à memória.
- **`?tratar=1` não fura o teto.** O removedor aceita 30 MB porque tem outros
  chamadores; a rota do painel recusa acima de 5 MB antes de chamá-lo.

## Tempo-limite por integração

Toda chamada de saída feita em requisição de loja ou em rotina usa
`AbortSignal.timeout(...)`. No estouro o `fetch`
rejeita e quem chamou decide o que fazer; nenhuma chamada é repetida sozinha.

| Arquivo | Integração | Tempo-limite |
|---|---|---|
| `packages/checkout/src/providers/mercadopago.ts` | Mercado Pago: cobrar, estornar | 20 s |
| `packages/checkout/src/providers/mercadopago.ts` | Mercado Pago: consultar | 10 s |
| `src/lib/mercadopago-assinatura.ts` | Mercado Pago: assinatura do plano | 20 s |
| `src/lib/recebimento.ts` | Mercado Pago: conta do lojista | 10 s |
| `src/lib/mercado-pago-conta.ts` | Mercado Pago: conectar e renovar o acesso (OAuth) | 20 s |
| `src/lib/mercadolivre.ts` | Mercado Livre | 20 s (token), 30 s (`chamarMl`), 15 s (demais chamadas) |
| `src/lib/canal-shopee.ts` | Shopee | 20 s (token), 15 s (API) |
| `src/lib/canal-amazon.ts` | Amazon | 20 s (token), 15 s (API) |
| `src/lib/canal-magalu.ts` | Magalu | 20 s (token), 15 s (API) |
| `src/lib/melhor-envio.ts` | Melhor Envio: cotação | 8 s |
| `src/lib/melhor-envio-conta.ts` | Melhor Envio: conta do lojista | 20 s (token), 15 s (API) |
| `src/lib/postagem.ts` | Melhor Envio: etiqueta e postagem | 30 s |
| `src/lib/frete.ts` | ViaCEP | 5 s |
| `src/lib/eventos.ts` | Webhook de eventos (n8n) | 5 s |
| `src/lib/whatsapp.ts` | WhatsApp | 15 s |
| `src/lib/email.ts` | SMTP (tempo-limite do socket) | 20 s |
| `src/lib/google-entrada.ts` | Entrada com Google | 10 s |
| `src/lib/sso.ts` | SSO | 8 s |
| `src/lib/indexnow.ts` | IndexNow | 8 s |
| `src/lib/provisionar.ts` | Cloudflare e API de e-mail (provisionamento) | 15 s |
| `src/lib/uploads.ts` | Download de imagem por URL | 20 s |
| `src/app/api/dominio-permitido/route.ts` | Repasse da pergunta de domínio do Caddy | 3 s |

Mercado Pago, cobrança: estourar o tempo **não** quer dizer que a cobrança não
foi criada. `POST /api/checkout` marca a tentativa como `INCERTA`, mantém a
reserva de estoque e responde 503 `pagamento_a_confirmar`; a chave
`x-idempotency-key` (a referência do pedido) protege a nova tentativa. Não
baixar os 20 s para "responder mais rápido".

**O incerto é resolvido, não esquecido (08/10/2026).** Até essa data nada lia a
tentativa `INCERTA`, e a reserva ficava para sempre. Pior: *qualquer* erro do
gateway caía ali, inclusive uma recusa com resposta (cartão inválido,
credencial errada), que é conclusiva. Agora:

- recusa com resposta do gateway (`CobrancaRecusada`, 4xx menos 408) solta a
  reserva na hora e responde 502 `falha_gateway`;
- tempo-limite, 5xx e conexão caída continuam `INCERTA`, e a rotina
  `reservas.reconciliar` (`src/lib/reservas-reconciliar.ts`, a cada 10 min)
  pergunta ao gateway pela referência depois de 15 min: sem cobrança, ou
  recusada/cancelada, solta o estoque; pendente, espera; **aprovada sem
  pedido**, não solta e abre o alerta `pagamento.sem-pedido`.

A cobrança inteira mora em `criarCobranca` (`src/lib/checkout-cobranca.ts`),
com o gateway por parâmetro, e é provada em `tests/integration/checkout.test.ts`.
O corpo passa por schema antes de tudo: meio de pagamento que a loja não
aceita, parcelas acima de 12 e carrinho acima de 50 itens são recusados sem
reservar estoque.

Mercado Pago, consulta: a reconciliação (`src/lib/pedidos-reconciliar.ts`)
consulta em laço. Com tempo-limite, um pedido preso conta como falha e o laço
segue para o próximo.

Rotas genéricas do pacote (`packages/checkout/src/server/rotas.ts`), presas em
`packages/checkout/src/server/rotas.test.ts`: nenhuma devolve 500 cru no
estouro.

| Rota | No estouro do tempo-limite |
|---|---|
| `criarRotaPagamento` (cobrar) | 503 `pagamento_a_confirmar`, com a referência. Antes respondia 502 "Nada foi cobrado", que no estouro não se sabe. Vale também quando a cobrança passou e a gravação (`aoCriarPagamento`) falhou |
| `criarRotaStatus` (consultar) | 502 "Não foi possível consultar o pagamento."; a tela do PIX pergunta de novo |
| `criarRotaWebhook` (consultar) | 200 `{ recebido: true }` sem atualizar o status. O gateway não reenvia, então a notificação se perde e quem recupera o pedido é a reconciliação |

## Idempotência (08/10/2026)

O levantamento das entradas que um serviço de fora pode repetir mostrou que
**estoque, pedido e fatura já estavam protegidos no banco** (transação com
`FOR UPDATE`, `@@unique` e `upsert`). O que repetia era **mensagem**: quase todo
`emitir()` era decidido por uma leitura feita antes da escrita, e duas
notificações no mesmo instante mandavam dois avisos.

A simultaneidade é real, não teórica: o Mercado Pago reenvia até receber 2xx, e
cada rotina é chamada no mesmo horário pelo agendador da plataforma e pelo n8n.

O que mudou:

- **Chave do fato na emissão.** `emitir(evento, { chave })` (`src/lib/eventos.ts`)
  tira o `eventId` do fato (`eventIdDaChave`), e a segunda emissão esbarra na
  chave primária de `AutomacaoEvento`. Levam chave: `pedido.pago`,
  `pedido.recusado`, as quatro viradas de status do pedido, `carrinho.abandonado`,
  mensalidade paga e recusada, `canal.pergunta-recebida` e todo alerta.
  **Evento novo que vira mensagem para comprador ou lojista leva chave.**
- **Reivindicar antes de avisar** onde o fato pode se repetir de verdade:
  carrinho abandonado (`ABERTO` → `LEMBRADO`) e volta ao estoque
  (`avisadoEm`), com `updateMany` condicional antes do `emitir`.
- **Suspender e reativar** a loja mudam a linha com o status atual no `where`;
  quem não mudou não avisa.
- **Pedido do Mercado Livre não regride.** O ML manda a ordem de novo a cada
  mudança, e o aviso devolvia a "pago" o pedido que a loja já tinha enviado
  (`statusDepoisDoAviso`, `src/lib/mercadolivre-pedidos.ts`).
- **Fila do Mercado Livre.** A rota de notificações só engole a repetição
  (P2002); outro erro sobe, para o ML tentar de novo. A varredura de eventos
  não marca mais `mercadolivre.*` como "n8n não reivindicou".

Prova: `tests/integration/idempotencia.test.ts` (o mesmo fato em chamadas
simultâneas, contra o Postgres) e `src/lib/idempotencia.test.ts`.

O que **não** mudou, e por quê:

- O webhook de mensalidade trata como "repetida" a segunda notificação com o
  mesmo `tópico:id`. Se o Mercado Pago reutiliza o id a cada mudança de estado,
  uma mudança legítima é descartada e só a varredura diária a pega. Não há como
  confirmar o comportamento do Mercado Pago pelo repositório, e nunca houve uma
  cobrança de mensalidade em produção para observar. Fica para quando houver.
- O webhook de pagamento não tem janela de tempo na assinatura (o de
  mensalidade tem, de 10 minutos). O efeito de uma notificação antiga
  reapresentada é uma consulta a mais ao gateway.
- Os quatro retornos de OAuth mostram "falhou" se o mesmo `code` for
  apresentado duas vezes, mesmo com a conta já conectada. Nenhum dado se perde.

## Alertas acionáveis (08/10/2026)

Falha de pagamento, de webhook e de rotina morria em `console.error`. Agora sai
como evento `operacao.alerta` (`src/lib/alertas.ts`), que já chega dizendo:

| Campo | O que traz |
|---|---|
| `slug`, `lojaNome` | a loja (`plataforma` quando não é de loja nenhuma) |
| `codigo` | estável, para o fluxo rotear: ver a lista abaixo |
| `recurso` | o que foi atingido: referência do pedido, nome da rotina |
| `oQueQuebrou`, `oQueFazer` | frases prontas, escritas no código e não no fluxo |
| `detalhe`, `link` | a mensagem do erro e a tela onde resolver, quando existe |

| Código | Quando |
|---|---|
| `pagamento.divergencia` | o valor pago difere do total do pedido |
| `pagamento.sem-estoque` | pagamento aprovado e a baixa de estoque falhou |
| `mensalidade.webhook-falhou` | notificação de mensalidade que não pôde ser processada |
| `pagamento.sem-pedido` | pagamento aprovado no gateway sem pedido registrado |
| `rotina.falhando` | a terceira falha seguida de uma rotina |
| `canal.aviso-falhou` | reservado; ainda sem emissor |

Um alerta por fato: a chave é `codigo` + `recurso`, então o gateway reenviando
a mesma notificação não abre dez tarefas.

**Falta do lado do n8n.** O evento vai para o fluxo
(`docs/n8n/lojas-onboarding-e-pedidos.json`), que hoje não conhece o tipo e o
encerra como ignorado. Falta um ramo `operacao.alerta` que abra a tarefa com
`oQueQuebrou` no título e `oQueFazer` no corpo. A publicação é no n8n, fora
deste repositório. Até lá o alerta existe só na fila
(`GET /api/admin/automacoes/eventos`).

Fora do código da aplicação:

- **Corpo sem `content-length`** (envio em pedaços) não é recusado pela rota:
  navegador sempre manda o cabeçalho em `FormData`, e responder 411 pode
  quebrar cliente legítimo atrás do proxy. Quem corta nesse caso é o Caddy do
  servidor de produção, desde 08/10/2026: o snippet `lojas_teto_corpo` recusa
  com 413 qualquer corpo acima de 13 MiB em `/api/painel/*`, com ou sem o
  cabeçalho. Ele é importado nos três blocos que levam à plataforma (o de
  `lojas.avilaops.com`, o da Brilhax e o dos domínios próprios, este gerado
  por `deploy/caddy-sync.sh`); a cópia de referência está em
  `deploy/Caddyfile.snippet`. **13 MiB é o maior teto da aplicação (planilha,
  12 MB + 64 KB) arredondado para cima: se `TETO_PLANILHA_BYTES` subir, o
  `max_size` do Caddy sobe no mesmo dia**, senão o Caddy passa a recusar o que
  a aplicação aceitaria. Uma foto de 6 MB enviada em pedaços passa pelo Caddy
  e é lida para a memória antes do 422: o teto do proxy limita o estrago a
  13 MiB por requisição, não a 5.
- **Consulta ao Postgres** não tem tempo-limite por chamada; ver a nota em
  `src/lib/passada-unica.ts`.
- **Download do modelo do removedor**
  (`packages/removedor-de-fundo/src/modelo.ts`) não tem tempo-limite: roda na
  preparação do modelo, não em requisição de loja.
