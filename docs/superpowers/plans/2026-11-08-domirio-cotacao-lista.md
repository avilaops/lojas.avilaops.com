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

- [x] Regras e testes de lista, armazenamento, limites e mensagem.
- [x] Página MDX, formulário e importação do carrinho.
- [x] Links na home, fichas, carrinho e rodapé; sitemap.
- [x] CI, publicação e revisão mobile/desktop sem envio de WhatsApp.

## Evidências

Implementação e77a815, CI 42498692977 aprovada com deploy e fumaça.
Entrega repetida após timeout de download da imagem. Publicação conferida
em 08/11/2026: /cotacao, home, ficha, carrinho, sitemap e llms.txt HTTP 200
com links; mesma rota 404 em PK e Bereta. Revisão pública em 390/1440 px:
43 apresentações, adicionar duas linhas, mensagem com ISO015/1 L/12 unidades
e ISO276/3 unidades; dois itens restaurados, CEP não salvo; importação do
carrinho somou Sanepec de 3 para 5; edição e remoção funcionaram. Sem overflow
ou erros de página. Mensagem apenas inspecionada, nenhum WhatsApp enviado.
