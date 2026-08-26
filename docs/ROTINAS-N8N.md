# Rotinas que o n8n precisa chamar

A plataforma nunca manda e-mail nem WhatsApp por conta própria: ela emite o
evento e expõe o endpoint. Quem executa é o fluxo **Lojas — Onboarding e
Pedidos** (`ruVn7ddvPQB949p9`). **O fluxo vivo é a fonte da verdade** — o
`docs/n8n-lojas-onboarding.ts` já ficou fora de sincronia uma vez.

Todos os POST abaixo vão com `Authorization: Bearer $LOJAS_ADMIN_TOKEN`.

| Quando | Endpoint | O que faz |
|---|---|---|
| a cada hora | `POST /api/admin/carrinhos/verificar` | marca carrinho parado há 45 min e emite `carrinho.abandonado` |
| a cada hora | `POST /api/admin/estoque/avisos` | avisa quem esperava produto que voltou |
| diário | `POST /api/admin/cobranca/verificar` | suspende quem passou da tolerância |
| segunda 7h | `POST /api/admin/relatorios/semanal` | emite `loja.relatorio-semanal` por loja com movimento |

## `loja.voltou-ao-estoque` — ligado em 26/08/2026

Pendurado no gatilho **A Cada Hora** que já existia (não foi criado outro
schedule): ele dispara `Verificar Carrinhos Abandonados` e `Verificar Fila de
Estoque` em paralelo. O evento cai na saída `loja.voltou-ao-estoque` do switch
e vai para o nó **E-mail: Voltou ao Estoque**.

Campos que o `Normalizar Evento` passou a expor: `destinatario`, `precoReais`
(`produtoNome`, `nome`, `url` e `emailRemetente` já existiam). O Reply-To sai
de `lojistaEmail`, que vem do `emailContato` no evento.

O endpoint é idempotente (`AvisoEstoque.avisadoEm`): rodar de novo não avisa
ninguém duas vezes.

## E-mails ao comprador — credencial trocada em 26/08/2026

A credencial **"SMTP account"** devolvia `535 5.7.8 authentication failed`.
Ela era a dos três e-mails que vão para o comprador — confirmação de pedido,
carrinho abandonado e o novo aviso de estoque —, ou seja, **nenhum deles
chegava a ninguém**. Os três passaram a usar a mesma credencial dos e-mails ao
lojista (`SMTP mail.avilaops.com`, id `tSZlEjwt75qo2MwC`), com remetente
`<nome da loja> <lojas@avilaops.com>` e Reply-To do lojista.

O ideal ainda é cada loja enviar pelo próprio domínio (o provisionamento já
cria `contato@` no mail.avilaops.com), mas isso exige uma credencial SMTP por
loja no n8n — não é padronizável hoje. Enquanto isso, o endereço que autentica
é o da plataforma e o nome que aparece é o da loja.
