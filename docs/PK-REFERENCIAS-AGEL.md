# Referências documentais Agel na PK Vedações

Implementação introduzida pelo PR #231 (commit 26a779f).

- 34 relações com referência, diâmetro externo, seção e altura coincidentes, extraídas do Catálogo de Componentes e Conjuntos Diversos Agel, edição 02/2019, páginas 4–10.
- 24 relações com medidas divergentes foram excluídas da associação automática.
- A ficha usa conteúdo MDX visível e renderizado no servidor, no endereço canônico do produto existente.
- A busca aceita o código exato e a forma com marca: `5721`, `AGEL 5721`.
- Busca e ficha exigem tenant `pkvedacoes`, slug, referência, material e medidas documentados; cadastro alterado perde o vínculo até nova conferência.
- Não altera fabricante, MPN, preço, estoque nem afirma intercambiabilidade de aplicação.

Exemplo: AGEL 5721 e PK GNY.5030 compartilham a referência W2-3250-500, diâmetro externo 82,55 mm, seção 3,17 mm e altura 12,7 mm.

## Evidências e publicação

Os CIs 42485749340, 42486516411 e 42487078255 aprovaram a implementação, incluindo unitários, PostgreSQL, navegador, TypeScript, ESLint e build. A publicação deve usar uma execução nova e completa: artefatos do pipeline são imutáveis e vinculados à tentativa; uma retomada parcial não pode consumir os artefatos da tentativa anterior.

A consulta pública `https://pkvedacoes.com.br/produtos?q=AGEL%205721` deve encontrar GNY.5030. Sua ficha deve conter o bloco “Códigos relacionados Agel”. A validação pública precisa ocorrer após o deploy; CI aprovado e PR integrado não comprovam publicação. A indexação externa depende de novo rastreamento dos buscadores.
