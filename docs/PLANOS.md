# Planos e resposta à proposta C2TI

## Como a C2TI chega em R$ 497 + R$ 92,60/mês

Verificado em 24/08/2026 nos sites chiarodesign.com.br e infomaq.com.br:

- Os dois são o **mesmo app** ASP.NET WebForms (`__VIEWSTATEGENERATOR` idêntico),
  servido de `c2tiapps.com/sites/013/Index.aspx` num único servidor Windows/Plesk.
  Cliente novo = pasta numerada, não projeto.
- Scripts, máscara de campo e ícone de WhatsApp saem do domínio da C2TI.
- Custo por cliente: ~R$ 5–10/mês (Plesk compartilhado, domínio .br, SSL grátis).
- "2 indicações" = CAC deles. "Logo no rodapé por R$ 20 de desconto" = mídia
  paga pelo cliente. "De R$ 1.307 por R$ 497" = ancoragem.
- Margem: ~R$ 85/mês por loja. 200 lojas ≈ R$ 17 mil/mês recorrentes.

## Nossa tabela (três planos: barato / âncora / caro)

| | **Site** | **Loja** ← âncora | **Loja Pro** |
|---|---|---|---|
| Setup | R$ 497 (12x R$ 49,70) | R$ 497 (12x R$ 49,70) | R$ 1.490 |
| Mensal | R$ 110 | **R$ 269** | R$ 497 |
| Hospedagem, domínio, SSL, e-mail profissional (1 caixa), painel, treinamento em vídeo | ✔ | ✔ | ✔ |
| Catálogo + botão de WhatsApp | ✔ | ✔ | ✔ |
| Carrinho + checkout PIX / cartão / boleto na própria loja | | ✔ | ✔ |
| Frete por CEP + retirada na loja | | ✔ | ✔ |
| Aviso de pedido pago no WhatsApp do lojista | | ✔ | ✔ |
| Automações (carrinho abandonado, reposição, cupom, pós-venda) | | | ✔ |
| Relatórios semanais + NF-e | | | ✔ |

Condição do setup promocional: 2 indicações após a aprovação (igual à deles
funciona). Sem desconto por logo no rodapé: o "Loja por Avila Ops" é fixo.

## Por que ganhamos a comparação sem brigar por R$ 27

| C2TI | Nós |
|---|---|
| Loja em ASP.NET WebForms, 2009 | Next.js 16, Core Web Vitals, JSON-LD de produto (Google Shopping grátis) |
| "Gerenciador simples" | Painel no cliente.avilaops.com + tudo por API |
| Pagamento: não descrito | PIX com QR na hora, cartão tokenizado, boleto, dinheiro cai na conta do lojista |
| E-mail terceirizado | mail.avilaops.com, DKIM/DMARC prontos, webmail próprio |
| Manutenção = "suporte" | Automações n8n que vendem: WhatsApp de pedido pago, carrinho abandonado |
| Aprovação em dias | Loja no ar em minutos (`<slug>.lojas.avilaops.com`) |

## Custo nosso por loja (Hetzner)

- CX32 (~R$ 50/mês) segura 20–30 lojas neste modelo (um Next.js, um Postgres).
- Domínio .br R$ 40/ano ≈ R$ 3,30/mês. E-mail: infra própria, custo marginal ~R$ 1.
- Melhor Envio: uma conta da plataforma cota o frete para todas as lojas, diluída.
- **Total < R$ 10/mês por loja. Margem no plano Loja ≈ R$ 109/mês.**

## Lock-in (decisão de 24/08/2026)

Domínio registrado pela Avila Ops, DNS na nossa Cloudflare, e-mail no nosso
mail, painel nosso, automações nossas. Cancelou, sai do ar. Único limite: LGPD
obriga a entregar os dados de clientes finais (cadastros/pedidos) se pedido por
escrito, entrega-se um CSV; nada mais sai.
