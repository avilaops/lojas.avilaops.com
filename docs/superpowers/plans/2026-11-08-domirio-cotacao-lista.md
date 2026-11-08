# Cotação de vários produtos Domi-Rio

**Objetivo:** reunir apresentações e quantidades em uma mensagem comercial.
**Escopo aprovado:** continuidade das melhorias comerciais; execução inline
com as skills de planejamento e conversão já aplicadas.

## Desenho

Página /cotacao exclusiva de domi-rio, com introdução MDX e catálogo público
projetado no servidor. Variantes ativas resolvidas pelas ofertas existentes,
sem custo ou dados internos. Cliente escolhe apresentação, adiciona quantidade,
edita/remove linhas e pode importar os itens atuais do carrinho. A lista local
guarda apenas IDs e quantidades; nomes/códigos são resolvidos novamente contra
o catálogo. CEP opcional vai somente na mensagem, sem persistência ou analytics.
Não cria pedido, envia mensagem, negocia desconto ou reserva estoque.

## Contratos

- Máximo 50 apresentações, quantidades inteiras entre 1 e 99999.
- Duplicados somam quantidades; saldo insuficiente é informado para confirmação.
- Variante sempre leva seu SKU e URL próprios; itens ausentes são descartados.
- Mensagem limitada a 7500 caracteres para manter o link utilizável.
- Página e links exclusivos do tenant; checkout permanece disponível no carrinho.
- Eventos de contato existentes, sem CEP ou conteúdo da cotação no evento.
- Testes/build somente na CI; revisão visual local e pública permitida.

## Entregas

- [ ] Regras e testes de lista, armazenamento, limites e mensagem.
- [ ] Página MDX, formulário e importação do carrinho.
- [ ] Links na home, fichas, carrinho e rodapé; sitemap.
- [ ] CI, publicação e revisão mobile/desktop sem envio de WhatsApp.
