# WhatsApp — templates a aprovar no Meta Business Manager

O fluxo n8n `Lojas — Onboarding e Pedidos` envia WhatsApp pela **API oficial da
Meta** (Cloud API), sem Twilio. Toda mensagem que a loja inicia (fora da janela
de 24 h) exige um **template aprovado**; por isso os sete envios abaixo usam
`type: "template"`.

## Antes de tudo

1. Criar um **app novo** no Meta for Developers (o anterior foi apagado — a API
   responde `Error validating application. Application has been deleted.`, code 190).
2. Gerar um **token de System User permanente** com `whatsapp_business_messaging`
   e `whatsapp_business_management` (não use o token temporário de 24 h).
3. Conferir o **Phone Number ID**. O que está nos nós é `1165155426689680`; se
   mudar, editar a URL dos 7 nós (`graph.facebook.com/v21.0/<id>/messages`).
4. Atualizar a credencial **WhatsApp Cloud API (Meta)** no n8n
   (`Authorization: Bearer <token>`).
5. Aprovar os templates abaixo em **WhatsApp Manager → Modelos de mensagem**,
   idioma **Português (BR)** — o `language.code` enviado é `pt_BR`.

Regras da Meta que o texto abaixo já respeita: o corpo não começa nem termina
com variável, nenhum parâmetro contém quebra de linha, e nada promete prazo ou
resultado que a loja não controle.

## Os sete templates

| Nome | Categoria | Quando dispara |
|---|---|---|
| `loja_no_ar` | UTILITY | Loja criada |
| `loja_configurada` | UTILITY | DNS e e-mail provisionados |
| `loja_indicacoes` | MARKETING | 3 dias depois da criação |
| `pedido_pago_lojista` | UTILITY | Pagamento aprovado (vai para o lojista) |
| `pix_pendente` | UTILITY | 30 min sem pagar o PIX (vai para o comprador) |
| `pagamento_recusado` | UTILITY | Cartão recusado (vai para o comprador) |
| `carrinho_abandonado` | MARKETING | 45 min de checkout parado (vai para o comprador) |

### 1. `loja_no_ar` — UTILITY

```
Olá! A loja {{1}} já está no ar para você aprovar: {{2}}
Entre em lojas.avilaops.com/painel para cadastrar produtos e ajustar as cores. Qualquer dúvida, é só responder aqui.
```

`{{1}}` nome da loja · `{{2}}` endereço da loja
Exemplos: `Vedashow` · `https://vedashow.lojas.avilaops.com`

### 2. `loja_configurada` — UTILITY

```
Pronto: domínio, DNS e e-mail da loja {{1}} estão configurados. Sua loja está em {{2}} e já pode receber pedidos.
```

`{{1}}` nome da loja · `{{2}}` endereço da loja

### 3. `loja_indicacoes` — MARKETING

```
Oi! Tudo certo com a loja {{1}}? Para manter o valor promocional do setup, combinamos 2 indicações (nome e telefone) de quem também pode querer vender pela internet. Pode mandar por aqui mesmo. Obrigado!
```

`{{1}}` nome da loja

### 4. `pedido_pago_lojista` — UTILITY

```
Pedido #{{1}} pago: R$ {{2}}. Cliente {{3}}. Itens: {{4}}. Separe e envie pelo painel em lojas.avilaops.com/painel.
```

`{{1}}` número do pedido · `{{2}}` total em reais · `{{3}}` nome do cliente · `{{4}}` itens
Exemplos: `12` · `189,90` · `Ana Silva` · `2x Camiseta básica, 1x Boné`

### 5. `pix_pendente` — UTILITY

```
Oi, {{1}}! Seu pedido na loja {{2}} (R$ {{3}}) ainda está aguardando o PIX. O código expira em breve; se precisar de um novo, é só responder esta mensagem.
```

`{{1}}` primeiro nome · `{{2}}` nome da loja · `{{3}}` total em reais

### 6. `pagamento_recusado` — UTILITY

```
Oi, {{1}}! O pagamento do seu pedido na loja {{2}} não foi aprovado pelo cartão. Você pode refazer com PIX em {{3}} — a aprovação é na hora. Se preferir, responda aqui que a gente ajuda.
```

`{{1}}` primeiro nome · `{{2}}` nome da loja · `{{3}}` link do carrinho

### 7. `carrinho_abandonado` — MARKETING

```
Oi, {{1}}! Seu carrinho na loja {{2}} ({{3}} — R$ {{4}}) ainda está guardado. Para finalizar, é só abrir {{5}}.
```

`{{1}}` primeiro nome · `{{2}}` nome da loja · `{{3}}` itens · `{{4}}` total em reais · `{{5}}` link do carrinho

## Depois de aprovar

- Rodar uma vez cada evento (criar uma loja de teste, deixar um carrinho parado)
  e conferir a aba **Executions** do n8n: erro de template aparece como
  `(#132001) Template name does not exist` ou `(#132000) parameter count mismatch`.
- Os nós estão com `onError: continueRegularOutput`: WhatsApp que falha **não**
  interrompe o e-mail nem o resto do fluxo.
- Enquanto os templates não existirem, o e-mail cobre todos os avisos.
