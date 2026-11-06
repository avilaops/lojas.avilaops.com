# Brilhax: entrega, compra e descoberta

## Objetivo e escopo autorizado

Em 06/11/2026 o proprietário autorizou desenvolver as melhorias necessárias
após a auditoria comercial. Os dados medidos dos 30 dias anteriores eram 185
sessões, 89 com produto e 7 com adição ao carrinho; nenhuma compra do canal loja.
Consentimento, visitas internas e retomadas limitam a interpretação dos totais.
Não tratar aumento de catálogo ou publicação de código como prova de conversão.

## Plano

1. Interface: consultar entrega pelo CEP na ficha simples, carrinho e abertura
   do checkout, antes de identidade. Mostrar preço, prazo, total estimado,
   retirada separada de envio e contato quando faltar entrega.
2. Requisição: POST /api/frete, mesmos IDs/quantidades e cupom do carrinho.
   O endpoint público existente resolve tenant pelo host e preços pelo banco.
   Não enviar nome, e-mail, documento nem CEP para ferramentas de analytics.
3. Domínio: estimativa não cria contato, reserva, pedido ou cobrança. O checkout
   continua recotando no servidor. Alterar CEP, itens, preço ou cupom invalida
   a estimativa; ignorar respostas tardias e rejeitar payload inválido.
4. Falhas: erro de rede/HTTP não é frete grátis. Ao mudar CEP no checkout,
   limpar seleção anterior, atualizar mesmo quando a lista vier vazia e
   impedir avanço durante consulta. Retirada é decisão explícita.
5. Pagamento: perda de resposta conserva a referência de idempotência e abre
   acompanhamento; não afirmar que nada foi cobrado nem abrir nova cobrança.
6. Descoberta: acesso a kits e atendimento na composição automotiva. Curadoria
   da Brilhax por configurações e catálogo, sem código condicional por tenant.
7. Medição: manter contagens independentes e calcular as taxas entre a mesma
   coorte; não fabricar view_item/add_to_cart para encaixar o funil.
8. Verificação: unitários e navegador desktop/mobile no GitHub CI, banco
   isolado, snapshots e resposta real em produção após deploy da imagem CI.

## Limites comerciais

Comparar cinco produtos de entrada por apresentação, GTIN e preço final com
frete. Não reduzir preço sem custo/margem, não prometer desconto/frete grátis,
não inventar depoimentos, estoque ou certificação de distribuidor.
Selecionar kits já existentes e produtos vendáveis para a vitrine.
O tráfego exige distribuição: usar links UTM para distinguir Instagram,
WhatsApp e campanhas. Verificar resultados por sessões, produto, carrinho,
checkout, pedido e pagamento; sitemap enviado não comprova indexação.

## Evidências

Os testes de pagamento usam provedor Pix manual em tenant efêmero, nunca
credenciais reais. Pix gerado não é pagamento aprovado. A comprovação do
gateway real e a definição de orçamento de mídia permanecem independentes
das alterações de interface.
