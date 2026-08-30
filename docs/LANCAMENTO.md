# O que falta para lançar o lojas.avilaops.com

> Levantamento do Comercial em 29/08/2026, logo depois do deploy completo.
> "Lançar" aqui não é uma data: é a **primeira loja paga**. Até ela, o
> produto está em pré-lançamento e nada de feature nova entra
> (proposta ao conselho para a revisão de 01/09).

## Como está hoje (medido)

| Fato | Número |
|---|---|
| Lojas no banco | 3: `avila-ops-store` (ATIVA, 0 produtos), `sandromotos` (ATIVA, 28 produtos), `demo` (**SUSPENSA** em 29/08, assinatura CANCELADA) |
| Pedidos / checkouts abertos / compradores / avaliações | **0 / 0 / 0 / 0** |
| Lojas com Mercado Pago do lojista configurado (`mpAccessTokenEnc`) | **0 de 3** → o checkout lança `GatewayNaoConfigurado` em todas |
| Faturas de mensalidade emitidas | 0 (6 eventos de cobrança, todos da demo) |
| Tempo de resposta no celular (Brasil) | TTFB 0,9–1,1 s; o servidor responde em 40–90 ms — a diferença é rede/TLS, `lojas.avilaops.com` está DNS-only |
| Landing no celular | 13.263 px de altura, 108 KB de HTML |
| Sitemap da plataforma | 2 URLs (`/` e `/criar`) |

Ou seja: **nunca houve uma compra em produção.** O portão 1 ("fluxo principal
100% de ponta a ponta") ainda não é verdade, e o portão 2 (cobrança) nunca
foi exercitado com dinheiro.

## Bloqueia a venda (semana de 01 a 05/09)

| # | O que | Dono | Por quê |
|---|---|---|---|
| 1 | **Uma compra real de R$ 1** numa loja com o Mercado Pago do lojista configurado: PIX → webhook → pedido pago → WhatsApp/e-mail → separar → enviado com rastreio. Registrar o print de cada passo. | Dev | É a única prova do portão 1. Hoje nenhuma loja consegue receber. |
| 2 | **Reativar a `demo` e isentá-la da cobrança** (assinatura interna ou flag), para a rotina diária não suspender de novo. | Dev | A única loja de demonstração está sem checkout desde hoje. |
| 3 | **Rotacionar `MP_ACCESS_TOKEN`/`MP_WEBHOOK_SECRET`** (colados no chat em 28/08), corrigir a URL do webhook de assinatura no painel do MP (ainda aponta para host morto) e **provar a mensalidade com R$ 0,10**. | Dev + Nicolas | Portão 2. Credencial em conversa está queimada. |
| 4 | **Fotos reais na loja do Sandro Motos.** Hoje "Baú Givi" é uma moto na estrada e "Pneu" é uma montanha (stock). Fotos do Instagram/fornecedor ou fundo branco pelo removedor. | Dev (Comercial passa as fontes) | É a demo que vai para o celular do dono; foto errada desmonta a conversa. |
| 5 | **Templates de WhatsApp aprovados na Meta** (os nós do fluxo já apontam para a Cloud API, mas sem template não sai nada). | Nicolas | Régua e avisos de pedido pago dependem disso. |

## Landing e palavras (portão 4, semana de 01 a 05/09)

| # | O que | Dono |
|---|---|---|
| 6 | **Um nome só para os planos.** Landing diz Essencial / Negócio / Escala; wizard `/criar`, ficha e docs dizem Site / Loja / Loja Pro. | GPT decide, Dev aplica |
| 7 | **Promessa do hero.** "Sua loja começa bonita. E cresce pronta." é frase de agência. A ficha vende: *loja pronta em um dia, Pix na hora, sem comissão, R$ 119 fixo, dinheiro na conta do lojista*. Nada disso aparece no primeiro scroll. | GPT |
| 8 | **Preço honesto.** "Implantação a partir de R$ 497 (12x de R$ 49,70)" = R$ 596 com juros apresentado como parcela; e "PayPal e Éfi em implantação" é promessa. Tirar os dois até serem verdade. | GPT |
| 9 | **Prova real no lugar de exemplos inventados** (Doce Brasa, Norte Studio, Casa Serena). "Explorar uma loja" hoje leva à demo suspensa. Usar Sandro Motos (com autorização) ou Brilhax. | GPT + Comercial |
| 10 | **Cortar a landing pela metade** e mostrar os 7 layouts (a página mostra 3). | GPT + Dev |
| 11 | Página `/lojas` + conteúdo para "criar loja virtual Ribeirão Preto"; sitemap com mais do que 2 URLs; propriedade no Search Console. | GPT (já no quadro, 05/09) |

## Técnico, não bloqueia (até 12/09)

| # | O que | Dono |
|---|---|---|
| 12 | Ligar o proxy da Cloudflare no apex `lojas.avilaops.com` (o `*.lojas` não dá — Universal SSL não cobre dois níveis — mas a landing dá). Corta ~0,8 s no primeiro byte. | Dev |
| 13 | Roteador do n8n não conhece `categoria.seo-pendente` / `categoria.seo-publicado`: caem em "Encerrar: Ignorado". Adicionar ao switch ou parar de emitir. | Dev |
| 14 | `GEMINI_API_KEY` não existe no servidor: o SEO de categorias sai só pelo fallback. Decidir se vale a chave. | Conselho |
| 15 | WhatsApp obrigatório no `/criar` (hoje é opcional; a régua inteira depende dele). | Dev |
| 16 | Removedor de fundo nas fotos e contrato server-side da CepCerto (já no quadro, outubro). | Dev |
| 17 | Tutorial/ajuda da plataforma (já no quadro, 05/09). | GPT + Dev |

## O que está bom e não precisa de mão

Vitrine no celular (home, produto, carrinho) está limpa e rápida no servidor;
garagem de motos funciona; `/criar` é claro; robots/sitemap por host; JSON-LD;
feed do Merchant; automações v1 com idempotência; rotina de SEO ligada.

## Proposta ao conselho (revisão de 01/09)

1. **Lançamento = primeira loja paga.** Sem data.
2. **Congelar feature** nas Lojas até lá; só os itens 1–11 desta lista.
3. **Critério de "pronto para vender"**: compra real de R$ 1 numa loja +
   cobrança de R$ 0,10 da mensalidade + demo no celular do Sandro.

— Comercial, 29/08/2026
