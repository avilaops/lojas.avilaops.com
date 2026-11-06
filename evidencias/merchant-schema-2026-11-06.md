# Marcação de comerciante, 06/11/2026

Responsável: codex. Ambiente de implementação: GitHub.

## Contrato

- Cada oferta usa Offer com preço positivo em BRL, URL da apresentação, disponibilidade real e referência à política da loja.
- Variantes sem seleção produzem uma lista de Offer, sem AggregateOffer.
- Preço anterior maior que o atual produz UnitPriceSpecification com StrikethroughPrice. Datas não são inventadas.
- Imagens relativas viram URLs absolutas HTTP(S). Sem imagem ou oferta válida, a página não emite Product. A indexação do catálogo continua seguindo publicavel; catálogo indexável não implica elegibilidade Merchant.
- Frete dependente de CEP continua omitido do JSON-LD. Configuração da conta Merchant Center precisa de conferência operacional por loja.
- A política de devolução continua na organização, referenciada por @id na oferta.

## Verificação

Regressões em src/lib/merchant-schema.test.ts, incluídas no glob unitário existente.
Lint, typecheck, testes e build executam exclusivamente no GitHub CI.
Nenhum teste ou deploy foi executado localmente.
Após publicação, validar URLs de produtos simples, variantes e promoções no Teste de pesquisa aprimorada e inspecionar Search Console e Merchant Center.
O código não comprova resolução, dimensões ou acesso HTTP de cada imagem cadastrada.
