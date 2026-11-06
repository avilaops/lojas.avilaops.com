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

## Curadoria aplicada e bloqueio da entrega

Em produção foram selecionados oito destaques automotivos (dois kits, V-Floc
500 ml, Sintra Fast 500 ml, Delet 500 ml, pincel Zacs, V-Eco Fast e aromatizante
Bugatti). O item de Natal e as categorias Enfeites para Árvores e Mouses foram
desativados. Preços e estoques foram preservados por releitura do catálogo.

A consulta pública real retornou somente retirada. A chave pública CepCerto
está vazia e o tenant não conectou Melhor Envio. A credencial operacional
existente retornou HTTP 500 na cotação de uma rota com CEP válido. A chave
de consultas existente retornou HTTP 422: cliente sem ciclo transacional
ativo. Nenhuma etiqueta ou cobrança foi criada. É necessário regularizar
o acesso/plano da CepCerto e fornecer a chave pública com origem autorizada,
ou configurar uma alternativa de entrega real. Não preencher tabela fictícia.

## Continuação de 06/11/2026

A primeira entrega foi publicada pelo PR #217, commit
`c82b56c469f1f3edb99148c6af5f3dca4f7f81e2`. O run `42240400965` aprovou CI,
deploy e fumaça. Home, produto, carrinho e consulta antes do cadastro foram
conferidos na loja real; a imagem em execução corresponde ao digest do CI.
As evidências e o impedimento CepCerto estão registrados na AVL-408.

Após novo pedido para continuar, a segunda entrega corrige as sugestões:
estoque zero é filtrado pela regra comum; itens com opções exigem abrir a ficha;
itens já no carrinho deixam de aparecer e a adição tem confirmação acessível.
O local público de retirada e o horário cadastrado acompanham a cotação, com
orientação para aguardar o pedido ficar pronto. Endereço privado não é exposto.
Os textos distinguem preparo do pedido de prazo de transporte; consultar o CEP
não promete disponibilidade de envio. Preços, estoque e condições são preservados.

## Distribuição com origem identificada

Usar cinco destinos para a primeira divulgação orgânica. Os parâmetros abaixo
já são interpretados pelo mecanismo de atribuição existente; não criam anúncios.

- Lavagem: `/produtos/v-floc-500ml?utm_source=instagram&utm_medium=social&utm_campaign=primeira_compra&utm_content=lavagem`
- Interior: `/produtos/sintra-fast-500ml?utm_source=instagram&utm_medium=social&utm_campaign=primeira_compra&utm_content=interior`
- Pneus: `/produtos/delet-500ml?utm_source=instagram&utm_medium=social&utm_campaign=primeira_compra&utm_content=pneus`
- Kits: `/categoria/kits-completos?utm_source=instagram&utm_medium=social&utm_campaign=primeira_compra&utm_content=kits`
- Atendimento local: `/categoria/kits-completos?utm_source=whatsapp&utm_medium=messaging&utm_campaign=primeira_compra&utm_content=retirada`

Concentrar a divulgação local em retirada até restabelecer envio. Comparar
preço final da cesta antes de mídia paga. Não substituir prova de vendas
por cliques, não inventar metas de receita ou prometer conversão.
