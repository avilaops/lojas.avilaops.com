# Cotação de vários produtos Domi-Rio

## Comportamento

A página `/cotacao` pertence somente ao tenant ativo `domi-rio`. O servidor
projeta variantes ativas desse tenant, usando os contratos de oferta e grade
existentes. O formulário recebe somente identificadores, nome público, código,
apresentação e disponibilidade; não recebe custos, margens ou credenciais.
O conteúdo de abertura está em `src/content/domirio/cotacao.mdx`.

É possível buscar por nome/código, adicionar apresentações, somar repetidos,
editar quantidades, remover itens e importar a seleção do carrinho. O carrinho
de compra não é modificado. IDs simples são relacionados à variante padrão;
IDs com variante preservam a apresentação escolhida. Produtos que saíram do
catálogo não são importados. A lista guarda somente IDs e quantidades em
`loja:domi-rio:cotacao`; a restauração usa novamente o catálogo recebido.

O CEP opcional fica somente no estado da página e na mensagem que o comprador
decidir enviar. Não é salvo no armazenamento nem transmitido nos eventos de
analytics. O contato usa `technical_contact`; não cria pedido ou conversão
de compra. Não há disparo de WhatsApp até clicar, e o envio é confirmado pelo
comprador no aplicativo.

## Limites

- 50 apresentações por lista; quantidade inteira de 1 a 99999 por item.
- Mensagem de até 7500 caracteres; listas maiores precisam ser divididas.
- Saldo insuficiente ou oferta indisponível recebe aviso de confirmação.
- Sem preço total ou promessa de desconto: condições são confirmadas no atendimento.
- Lista no navegador, sem gravação em banco, reserva ou envio automático.

## Integração e verificação

Links na home, navegação, fichas, carrinho, rodapé, sitemap e llms.txt da Domi-Rio.
O checkout existente continua disponível no carrinho.

Testes de domínio em `src/lib/domirio-cotacao.test.ts` cobrem soma/imutabilidade,
limites de lista e quantidade, restauração de dados inválidos, exclusão de IDs
ausentes do catálogo, importação de produto simples/variante, CEP e mensagem.
Execução exclusiva na CI, conforme AGENTS.md. Evidências operacionais de
inspeção ficam em `.work/domirio-lista`.

Implementação e77a815 publicada e validada na
[CI 42498692977](https://github.com/avilaops/lojas.avilaops.com/actions/runs/42498692977).
Conferência pública em 08/11/2026: 43 apresentações; página e seis caminhos
de integração HTTP 200. PK e Bereta responderam 404 na mesma rota. Inspeção
em 390/1440 px sem overflow e sem erros de navegador; criação de lista,
restauração, edição, remoção e importação do carrinho conferidas. Mensagem
com duas apresentações manteve código/URL da variante, quantidades e CEP;
nenhuma mensagem foi enviada. CEP permaneceu vazio após recarregar.
