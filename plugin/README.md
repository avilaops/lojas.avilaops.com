# Lojas por Avila Ops

Opere sua loja virtual pelo Claude. Este plugin conecta o Claude à sua loja na
plataforma [Lojas por Avila Ops](https://lojas.avilaops.com) e permite
cadastrar produtos, ajustar preços e estoque, acompanhar pedidos, emitir
etiquetas de envio, criar cupons e ver resumos de vendas por conversa.

## Requisitos

- Loja ativa na plataforma Lojas por Avila Ops.
- Plano **Loja Pro**. Em outros planos o conector recusa a conexão e informa
  como fazer upgrade.

## O que vem no plugin

| Componente | O que é |
|---|---|
| Conector MCP `lojas-avilaops` | Servidor remoto em `https://lojas.avilaops.com/api/mcp` (Streamable HTTP, OAuth 2.1). |
| Habilidade `operar-loja` | Orienta o Claude a ler antes de alterar, confirmar com o lojista antes de mudar preço, estoque, pedido, cupom ou etiqueta, e a tratar os dados de clientes só para a tarefa pedida. |

## Ferramentas do conector

O Claude só vê as ferramentas que o lojista autorizou para a conexão.

| Área | Consultar | Alterar |
|---|---|---|
| Loja | `obter_loja` | `atualizar_marca` |
| Catálogo | `listar_produtos`, `obter_produto`, `listar_categorias`, `listar_estoque_baixo` | `criar_produto`, `atualizar_produto`, `gerenciar_fotos_produto`, `atualizar_categoria`, `gerar_seo_categoria`, `ajustar_estoque` |
| Avaliações | `listar_avaliacoes` | `moderar_avaliacao` |
| Pedidos | `listar_pedidos`, `obter_pedido` | `atualizar_status_pedido`, `emitir_etiqueta_envio` |
| Clientes | `listar_clientes`, `obter_cliente` | — |
| Promoções | `listar_cupons` | `criar_cupom`, `atualizar_cupom` |
| Análises | `resumo_vendas`, `resumo_marketing`, `resumo_atribuicao` | — |

Toda ferramenta declara `title`, `readOnlyHint` e `destructiveHint`, para o
Claude saber quando pedir confirmação. Toda ferramenta que altera a loja é
marcada como destrutiva (sobrescreve, muda status ou exclui), exceto
`criar_produto`, que só acrescenta.

## Como conectar

1. Instale o plugin e peça ao Claude algo sobre a sua loja.
2. O Claude abre a tela de login da plataforma. Entre com a conta do painel.
3. Escolha a loja e o acesso: consultar e alterar, só consultar, ou por área
   (loja, catálogo, pedidos, clientes, promoções, análises).
4. Pronto. Para mudar o acesso ou desconectar, use Painel > IA e API.

## Exemplos

- "Quais produtos estão com estoque baixo?"
- "Aumente em 10% o preço da categoria Camisetas." O Claude mostra a lista com
  preço atual e novo e só altera depois da sua confirmação.
- "Marque o pedido 1042 como enviado e emita a etiqueta."
- "Crie um cupom BEMVINDO10 de 10% válido até o fim do mês."
- "Como foram as vendas desta semana comparadas à anterior?"

## Privacidade e tratamento de dados

- **Dados pessoais:** as ferramentas de clientes e pedidos leem nome, e-mail e
  endereço de entrega dos compradores da loja. Esses dados já estão na
  plataforma; o plugin não cria cópias.
- **Destinos:** nenhum dado vai para serviço além do conector declarado acima.
- **Histórico de uso:** a plataforma registra uma linha por chamada
  (ferramenta, horário, se alterou, se deu certo e o código do item tocado),
  sem argumentos e sem resultados, para o lojista auditar o que o assistente
  fez. Uma faxina diária apaga de todas as lojas o que passou de 90 dias.
- **O que o Claude cria ou altera** (produtos, preços, cupons, status) passa a
  fazer parte da loja e fica enquanto a loja existir, como qualquer alteração
  feita no painel.
- **Credenciais:** o login é feito por OAuth na própria plataforma. O token
  vale 1 hora, renova sozinho e é guardado apenas como hash. Revogue a
  qualquer momento em Painel > IA e API.
- **Limite:** 120 chamadas por minuto por conexão.

Política de privacidade do conector: <https://lojas.avilaops.com/developers/privacidade>

## Suporte

- Documentação: <https://lojas.avilaops.com/developers>
- E-mail: <nicolas@avilaops.com>

## Licença

MIT. Veja [LICENSE](LICENSE).
