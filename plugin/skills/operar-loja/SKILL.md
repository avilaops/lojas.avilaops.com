---
name: operar-loja
description: Opera a loja do lojista na plataforma Lojas por Avila Ops pelo conector lojas-avilaops. Use quando o usuário pedir para cadastrar ou alterar produtos, preços, estoque, fotos ou categorias; ver ou avançar pedidos; emitir etiqueta de envio; criar cupons; consultar clientes; moderar avaliações; ou ver resumos de vendas e marketing da loja.
---

# Operar a loja

O conector `lojas-avilaops` lê e altera a loja de verdade. O que você muda
aparece para os clientes da loja na hora.

## Antes de alterar

1. Leia antes de escrever. Use `obter_loja`, `obter_produto`, `obter_pedido` ou
   a listagem correspondente para confirmar o item e o valor atual.
2. Mostre ao lojista o que vai mudar, com o valor atual e o novo, e espere a
   confirmação dele antes de chamar a ferramenta. Vale para: preço, estoque,
   status de pedido, etiqueta de envio, cupom, marca e layout, moderação de
   avaliação e publicação de SEO.
3. Um item por vez quando a mudança for em lote: liste o que será alterado,
   confirme uma vez com o lojista e execute item a item, relatando o resultado
   de cada um.

## Regras do domínio

- Valores em reais, com ponto decimal (`129.90`). Nunca em centavos.
- `atualizar_status_pedido` só avança pedido pago e dispara o aviso ao cliente.
  O status de pagamento muda só pelo meio de pagamento; não tente mudá-lo.
- `emitir_etiqueta_envio` emite a etiqueta oficial da transportadora e consome
  o saldo de frete da loja. Confirme sempre.
- `ajustar_estoque` só serve para produto sem variações. Produto com variações
  é ajustado pela grade no painel da loja.
- `atualizar_produto` com `imagens` substitui a galeria inteira. Para incluir
  ou tirar uma foto, use `gerenciar_fotos_produto`.
- `gerar_seo_categoria` devolve rascunho por padrão. Só use `publicar=true`
  depois que o lojista revisar o texto.
- `moderar_avaliacao` com exclusão não tem volta. Prefira reprovar (ocultar).
- `atualizar_cupom` com `excluir` não tem volta. Prefira desativar (`ativo: false`).

## Dados de clientes

`listar_clientes`, `obter_cliente` e os pedidos trazem nome, e-mail e endereço
de quem comprou. Use só para a tarefa pedida. Não copie esses dados para
outros serviços, documentos ou conversas sem pedido explícito do lojista.

## Quando a ferramenta recusa

- Permissão faltando: o lojista escolheu o que esta conexão pode fazer. Diga
  qual permissão falta e que ele muda em Painel > IA e API > Mudar acesso.
- Plano: o conector é do plano Loja Pro. Diga isso ao lojista e não tente
  contornar.
- Limite de chamadas (120 por minuto): espere e retome, sem repetir em laço.
