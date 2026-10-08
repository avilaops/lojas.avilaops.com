# Recebimento: conta do Mercado Pago conectada por OAuth

Desde 08/10/2026 o lojista conecta a própria conta do Mercado Pago em
`/painel/configuracoes/recebimento`, com um botão. Antes ele precisava criar uma
aplicação no painel de desenvolvedor do Mercado Pago, copiar public key e access
token, cadastrar a URL do webhook e colar a assinatura secreta — na prática,
quem fazia isso era a Ávila Ops, loja por loja.

O dinheiro continua caindo direto na conta do lojista. A autorização dá à
plataforma o mesmo que as chaves coladas davam: cobrar, consultar e estornar em
nome dele. Não há saque nem taxa de aplicação.

## O que precisa existir uma vez (é da plataforma, não da loja)

Uma aplicação em <https://www.mercadopago.com.br/developers/panel/app>, na conta
da Ávila Ops:

1. Produto: pagamentos online, Checkout Transparente (API de Pagamentos).
2. **URL de redirecionamento:** `https://lojas.avilaops.com/mercado-pago/callback`.
3. **PKCE desligado.** A troca do código é feita no servidor com o client secret.
4. **Webhooks**, modo produção, evento **Pagamentos**, URL
   `https://lojas.avilaops.com/api/webhooks/mercadopago`. Cada cobrança já sai
   com a `notification_url` da loja (`?loja=<slug>`), que é a que vale; cadastrar
   aqui é o que gera a **assinatura secreta**.
5. No `.env` do servidor: `MP_APP_ID` (Client ID), `MP_APP_SECRET` (Client
   Secret) e `MP_APP_WEBHOOK_SECRET` (assinatura secreta).

**As três variáveis, ou nenhuma.** Faltando uma, o botão não aparece e a tela
fica como era. Sem o segredo do webhook a loja conectaria e passaria a confirmar
pagamento só na verificação de hora em hora, sem que o lojista pudesse resolver.

Não é a mesma coisa que `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET`: essas são da
mensalidade das lojas, cobrada na conta da Ávila Ops.

## Como funciona

| Passo | Onde |
|---|---|
| Botão "Conectar Mercado Pago" | `GET /api/painel/recebimento/mercado-pago` redireciona para `auth.mercadopago.com.br/authorization` com `state` assinado (`src/lib/oauth-state.ts`) |
| Retorno | `GET /mercado-pago/callback` confere o `state` com a assinatura **e** com a sessão, troca o `code` e grava |
| O que fica no `Tenant` | `mpPublicKey`, `mpAccessTokenEnc`, `mpRefreshTokenEnc`, `mpExpiraEm`, `mpConectadoEm`, `mpUserId`, `mpConta` |
| Cobrança | igual: `providerDaLoja` (`src/lib/gateway.ts`) |
| Webhook | mesma rota; a assinatura é conferida com `MP_APP_WEBHOOK_SECRET` |
| Renovação | rotina `mercadopago.renovar`, todo dia às 4h |
| Desconectar | `DELETE /api/painel/recebimento/mercado-pago` |

**Quem diz se a loja é OAuth ou chave colada é `mpRefreshTokenEnc`.** Só a
conexão preenche. Salvar chaves à mão apaga os campos da conexão; conectar apaga
o segredo de webhook colado. Não existe estado misto.

**A renovação é rotina, não acontece na hora da cobrança.** O acesso vale 180
dias e o refresh é de uso único: dois compradores fechando pedido ao mesmo tempo
gastariam o mesmo refresh e um deles derrubaria a conexão. A rotina renova quem
vence em até 30 dias, uma tentativa por dia, e termina em erro na tela de
operação quando alguma loja falha.

**Conta de teste é recusada** (`live_mode: false`): a loja "venderia" sem
dinheiro de verdade entrar.

## Lojas que já colaram as chaves

Nada muda para elas: seguem cobrando com o que está salvo. Com o aplicativo
configurado, a tela mostra o botão de conectar acima e o formulário antigo vira
"Chaves da sua aplicação (avançado)". Quando o lojista conecta, as chaves
coladas deixam de ser usadas. Pagamento criado antes da troca continua sendo
confirmado pela rotina `pedidos.verificar`, que consulta com o token novo — é a
mesma conta.

## O que ainda não foi provado em produção

Em 08/10/2026 o código foi entregue com testes de unidade do `state`, da URL de
autorização e das rotas de retorno. **Nenhuma conexão real foi feita**: depende
de a aplicação existir no Mercado Pago e de as três variáveis estarem no
servidor. Ao ligar, conferir com uma loja de verdade:

- o retorno grava a conta e o "Testar recebimento" responde com o apelido dela;
- um Pix de valor baixo é confirmado pelo webhook (e não só pela verificação de
  hora em hora) — é a prova de que o aviso chega assinado com o segredo do
  aplicativo;
- o cartão abre no checkout com a public key que veio da conexão.
