# @avilaops/checkout

Checkout da Avila Ops. A tela é nossa; o gateway é plugável. Nasceu para a
Brilhax e é feito para servir os outros clientes sem fork.

## O que é código próprio e o que não é

Vale deixar explícito, porque a pergunta aparece sempre:

| Parte | Quem faz |
| --- | --- |
| Tela, passos, validação, máscaras, resumo, estados de erro | **Nosso** |
| CPF, CNPJ, celular, CEP , dígito verificador incluso | **Nosso** (`src/core/brasil.ts`) |
| Cálculo de total, frete, desconto, parcelamento | **Nosso** (`src/core/totais.ts`) |
| Regras do pedido, idempotência, conciliação | **Nosso** |
| Mover dinheiro de fato | Instituição autorizada pelo Banco Central |
| Guardar número de cartão | Ninguém aqui , o SDK tokeniza no navegador |

Não usamos Checkout Pro nem link de pagamento: os dois levam o cliente para uma
tela de terceiro, com a marca do terceiro. Aqui o Mercado Pago entra como
trilho de liquidação, e o cartão é tokenizado no navegador , o número nunca
toca o nosso servidor, o que mantém a operação fora do escopo pesado do PCI-DSS.

## Estrutura

```text
src/core/brasil.ts        CPF, CNPJ, celular, CEP, máscaras, ViaCEP
src/core/types.ts         tipos independentes de gateway
src/core/totais.ts        total, frete, desconto, parcelamento
src/providers/types.ts    contrato PaymentProvider
src/providers/mercadopago.ts    adaptador MP (PIX, cartão, boleto, estorno, webhook)
src/server/pedido.ts      recálculo seguro do pedido no servidor
src/server/rotas.ts       handlers Request/Response de pagamento, status e webhook
src/ui/CheckoutScreen.tsx a tela, agnóstica de gateway
src/ui/MercadoPagoCardBrick.tsx   campos de cartão do MP, plugados por slot
src/ui/tokens.css         tokens de tema , é aqui que cada cliente se personaliza
```

## Montando no Next.js

**Servidor** , três rotas, sempre no servidor, porque o access token vive aqui:

```ts
// app/api/checkout/route.ts
import { MercadoPagoProvider, criarRotaPagamento } from "@avilaops/checkout/server";

const provider = new MercadoPagoProvider({
  accessToken: process.env.MP_ACCESS_TOKEN!,
  webhookSecret: process.env.MP_WEBHOOK_SECRET!,
});

export const POST = criarRotaPagamento({
  provider,
  catalogo: {
    // O preço sai DAQUI, do seu catálogo , nunca do que o navegador mandou.
    resolverItens: async (ids) => buscarProdutosNoBanco(ids),
    resolverFretes: async ({ cep }) => cotarFrete(cep),
  },
  aoCriarPagamento: async ({ referencia, pagamentoId }) =>
    salvarPedido(referencia, pagamentoId),
});
```

`criarRotaStatus` (GET, para a tela do PIX descobrir que foi pago) e
`criarRotaWebhook` (POST, fonte da verdade do pagamento) montam igual.

**Tela** , o slot é o que mantém o componente agnóstico:

```tsx
"use client";
import { CheckoutScreen, MercadoPagoCardBrick } from "@avilaops/checkout/ui";
import "@avilaops/checkout/tokens.css";
import "@avilaops/checkout/checkout.css";

<CheckoutScreen
  itens={itens}
  fretes={fretes}
  aoFinalizar={(dados) =>
    fetch("/api/checkout", { method: "POST", body: JSON.stringify(dados) })
      .then((r) => r.json())
  }
  slotCartao={({ totalEmCentavos, emailCliente, aoTokenizar }) => (
    <MercadoPagoCardBrick
      publicKey={process.env.NEXT_PUBLIC_MP_PUBLIC_KEY!}
      totalEmCentavos={totalEmCentavos}
      emailCliente={emailCliente}
      aoTokenizar={aoTokenizar}
    />
  )}
/>
```

Trocar de gateway é trocar o provider no servidor e o componente do slot. O
`CheckoutScreen` não muda , ele não importa gateway nenhum.

Para personalizar, redefina os tokens depois do import do CSS:

```css
:root { --ck-accent: #e11d2a; }  /* vermelho Brilhax */
```

## Dinheiro é sempre centavo inteiro

Todo valor no pacote é `Centavos` , inteiro. Nunca float.

`0.1 + 0.2` em JavaScript dá `0.30000000000000004`. Num carrinho de dez itens
esse resíduo vira divergência de centavo entre o total exibido e o valor
cobrado, que é o tipo de diferença que gera chargeback e conciliação manual.

A API do Mercado Pago, por outro lado, recebe **reais decimais**. A conversão
acontece num ponto só, dentro do adaptador. Mandar centavos para lá cobra cem
vezes o valor , e o erro passa despercebido no teste feliz, porque a cobrança é
aceita normalmente.

## O total é recalculado no servidor

`calcularTotais` é usada pela tela e de novo pelo servidor antes de cobrar, a
partir dos IDs e das quantidades. Se o servidor confiasse no total enviado pela
tela, qualquer pessoa com o DevTools aberto compraria por um centavo.

## Configuração do Mercado Pago

```ts
import { MercadoPagoProvider } from "@avilaops/checkout/server";

const provider = new MercadoPagoProvider({
  accessToken: process.env.MP_ACCESS_TOKEN!,   // PRIVADO , servidor apenas
  webhookSecret: process.env.MP_WEBHOOK_SECRET!,
  descritorFatura: "BRILHAX",
  pixExpiraEmMinutos: 30,
});
```

| Variável | Onde obter |
| --- | --- |
| `MP_ACCESS_TOKEN` | Mercado Pago → Suas integrações → aplicação → Credenciais de produção |
| `MP_PUBLIC_KEY` | Mesma tela. É a única que pode ir para o navegador, e serve só para tokenizar cartão |
| `MP_WEBHOOK_SECRET` | Suas integrações → Webhooks → assinatura secreta |

O access token dá poder de cobrar **e de estornar**. Exposto no bundle do
front, é dinheiro na mão de quem abrir o DevTools.

## Webhook

`validarWebhook` confere a assinatura `x-signature` com HMAC-SHA256 em
comparação de tempo constante, e devolve `null` quando não bate. Endpoint de
webhook sem validação de assinatura é uma URL pública em que qualquer um chama
dizendo "pagou".

Trate o webhook como a fonte da verdade do pagamento, não a resposta da
cobrança: PIX e boleto são aprovados minutos ou dias depois, e o cliente pode
fechar a aba antes.

## Estorno faz parte do contrato

`estornar` está no `PaymentProvider`, com valor parcial, porque a política de
devolução publicada promete reembolso pelo mesmo meio de pagamento em até 10
dias úteis. Deixar isso de fora do código significa reembolsar abrindo o painel
do gateway na mão , que é de onde saem o reembolso esquecido e o reembolso em
duplicidade. Parcial porque devolver um item de um pedido de cinco é o caso
comum.

## Outras implementações no ecossistema

Existem módulos de pagamento em `cliente.avilaops.com` (Mercado Pago, funcionando),
`erp.avilaops.com` e `minas.avilaops.com` (InfinitePay). Este pacote **não**
tenta unificá-los: o do ERP não está em operação e os providers dele são
`manual`, `sandbox` e `store-credit` , nenhum gateway real. O do Minas resolve
mesa de restaurante, outro domínio.

Duas boas ideias vieram de lá e estão aqui: valor sempre em centavos inteiros, e
"pago" só com confirmação real, nunca otimista.

## O servidor nunca confia no navegador

`montarPedidoSeguro` recebe só IDs e quantidades. Preço, frete e desconto são
resolvidos aqui, e o total é recalculado. `totalExibido` chega junto apenas para
ser **conferido**: se divergir, a compra é recusada em vez de cobrada , preço
que mudou entre montar o carrinho e pagar não pode virar cobrança de valor que
a pessoa não viu.

Toda validação da tela é refeita no servidor. Não é redundância: a da tela
existe para a pessoa não errar, a do servidor porque a requisição pode não ter
vindo da tela.

## Testes

```bash
npm test        # node --test, sem dependência nenhuma
npm run typecheck
```

Rodam direto no Node, sem build e sem runner instalado: o Node 24 apaga os tipos
sozinho. Por isso o pacote não usa *parameter property*
(`constructor(private x)`) , é a única sintaxe TypeScript aqui que exigiria
transformação em vez de remoção, e ela faz o Node recusar o arquivo. Os imports
relativos também levam extensão explícita, como ESM exige.

41 testes cobrindo o que decide quanto o cliente paga e o que impede pagar
menos: totais, desconto, parcelamento, validadores e `montarPedidoSeguro`.

O primeiro deles já pagou o custo: `validarCnpj` reprovava **todo CNPJ válido**.
A sequência de pesos do módulo 11 estava deslocada em uma posição, e o bug era
invisível porque continuava reprovando os inválidos também , só um CNPJ real no
teste expôs. Em produção, nenhuma pessoa jurídica conseguiria fechar pedido.

## Pendente

- [ ] Adaptador do carrinho do Medusa
- [ ] Segundo provider, para exercitar a interface na prática
