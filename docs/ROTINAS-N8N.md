# Rotinas que o n8n precisa chamar

A plataforma nunca manda e-mail nem WhatsApp por conta própria: ela emite o
evento e expõe o endpoint. Quem executa é o fluxo **Lojas — Onboarding e
Pedidos** (`ruVn7ddvPQB949p9`). **O fluxo vivo é a fonte da verdade** — o
`docs/n8n-lojas-onboarding.ts` já ficou fora de sincronia uma vez.

Todos os POST abaixo vão com `Authorization: Bearer $LOJAS_ADMIN_TOKEN`.

| Quando | Endpoint | O que faz |
|---|---|---|
| a cada hora | `POST /api/admin/carrinhos/verificar` | marca carrinho parado há 45 min e emite `carrinho.abandonado` |
| a cada hora | `POST /api/admin/estoque/avisos` | **novo** — avisa quem esperava produto que voltou |
| diário | `POST /api/admin/cobranca/verificar` | suspende quem passou da tolerância |
| segunda 7h | `POST /api/admin/relatorios/semanal` | emite `loja.relatorio-semanal` por loja com movimento |

## `loja.voltou-ao-estoque` — o que falta ligar

O endpoint já está no ar e é idempotente: cada pessoa é avisada uma vez por
produto (`AvisoEstoque.avisadoEm`). Falta a saída do switch no fluxo, com um nó
de e-mail usando estes campos do evento:

| Campo | Uso na mensagem |
|---|---|
| `destinatario` | para quem vai o e-mail |
| `emailRemetente` | remetente da loja (`pedidos@dominio`) |
| `nome` | nome da loja |
| `produtoNome` | "O <produto> voltou" |
| `precoCentavos` | preço atual, em centavos |
| `url` | link direto para a página do produto |
| `telefone` | só quando a pessoa deixou; hoje ninguém pede |

Assunto sugerido: `<produtoNome> voltou para a loja`. Corpo curto, com o botão
apontando para `url` — a pessoa já quis comprar, não precisa ser convencida de
novo.

Enquanto a saída não existe, ninguém é avisado e **a fila não se perde**: o
`avisadoEm` só é preenchido quando o evento é emitido, e o painel do lojista já
mostra quem está esperando (Visão geral → "Gente esperando produto que acabou").
