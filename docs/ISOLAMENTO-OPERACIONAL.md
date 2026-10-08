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
| `importarImagemDeUrl` (`src/lib/uploads.ts`, imagem baixada de URL) | 10 MB | `UploadInvalido` "Imagem acima de 10 MB." |
| `removerFundo` (`src/lib/fundo.ts`, entrada do removedor) | 30 MB | `FundoIndisponivel` |

Como o teto vale:

- **Antes de ler o corpo.** As duas rotas multipart chamam `corpoAcimaDoTeto`
  antes de `request.formData()`, que carrega o corpo inteiro na memória. A
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

Mercado Pago, consulta: a reconciliação (`src/lib/pedidos-reconciliar.ts`)
consulta em laço. Com tempo-limite, um pedido preso conta como falha e o laço
segue para o próximo.

## Falta

- **Idempotência.** Levantar os webhooks de entrada (Mercado Pago, Melhor
  Envio, marketplaces) e as escritas da API que ainda aceitam repetição.
- **Alertas n8n acionáveis.** O payload do evento precisa dizer a loja, o que
  quebrou e o que fazer. O fluxo vive em
  `docs/n8n/lojas-onboarding-e-pedidos.json`; a publicação é no n8n, fora
  deste repositório.

Fora do código da aplicação:

- **Corpo sem `content-length`** (envio em pedaços) não é recusado pela rota:
  navegador sempre manda o cabeçalho em `FormData`, e responder 411 pode
  quebrar cliente legítimo atrás do proxy. O teto de corpo nesse caso é
  configuração do Caddy no servidor de produção.
- **Consulta ao Postgres** não tem tempo-limite por chamada; ver a nota em
  `src/lib/passada-unica.ts`.
- **Download do modelo do removedor**
  (`packages/removedor-de-fundo/src/modelo.ts`) não tem tempo-limite: roda na
  preparação do modelo, não em requisição de loja.
