# Lojas por Avila Ops

Plugin que conecta o Claude à loja do lojista na plataforma
[Lojas por Avila Ops](https://lojas.avilaops.com).

## O que faz

Declara um único conector MCP remoto:
`https://lojas.avilaops.com/api/mcp` (Streamable HTTP, OAuth 2.1).

Ferramentas disponíveis, limitadas ao que o lojista autoriza na conexão:

- Loja e marca: `obter_loja`, `atualizar_marca`
- Catálogo: `listar_produtos`, `obter_produto`, `criar_produto`,
  `atualizar_produto`, `gerenciar_fotos_produto`, `listar_categorias`,
  `atualizar_categoria`, `gerar_seo_categoria`
- Estoque: `listar_estoque_baixo`, `ajustar_estoque`
- Pedidos: `listar_pedidos`, `obter_pedido`, `atualizar_status_pedido`,
  `emitir_etiqueta_envio`
- Clientes: `listar_clientes`, `obter_cliente`
- Cupons: `listar_cupons`, `criar_cupom`, `atualizar_cupom`
- Avaliações: `listar_avaliacoes`, `moderar_avaliacao`
- Resumos: `resumo_vendas`, `resumo_marketing`, `resumo_atribuicao`

## Autenticação

Ao conectar, o Claude abre o login da plataforma. O lojista entra, escolhe a
loja e marca quais ferramentas a conexão pode usar. A conexão pode ser
revogada a qualquer momento no painel da loja.

## Tratamento de dados

- Lê dados pessoais de clientes da loja (nome, e-mail, endereço de entrega)
  quando o lojista usa `listar_clientes`, `obter_cliente` ou as ferramentas de
  pedidos. Esses dados já estão na plataforma; o plugin não cria cópia.
- Não envia dados a nenhum serviço além do conector declarado.
- Histórico de uso: a plataforma registra uma linha por chamada (ferramenta,
  horário, sucesso e o identificador do item tocado), sem argumentos nem
  resultados, guardada por 90 dias para o lojista auditar o que o assistente fez.
- Limite de 120 chamadas por minuto por conexão.

Política de privacidade: <https://avilaops.com/politica-de-privacidade/>

## Suporte

nicolas@avilaops.com
