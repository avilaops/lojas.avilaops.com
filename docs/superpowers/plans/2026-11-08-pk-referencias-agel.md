# Referências Agel no catálogo PK

Objetivo: mostrar as 34 referências documentais verificadas na ficha pública e permitir localizar a peça PK pelo código Agel.

Arquitetura: dados versionados com página e edição do PDF; seleção restrita ao tenant pkvedacoes, slug e medidas conferidas. MDX renderizado no servidor junto à ficha existente. A busca acrescenta as condições dos produtos verificados sem alterar filtros ou inventar equivalência de aplicação.

- [x] Importar os 34 registros verificados, preservando evidências e excluindo os 24 casos divergentes.
- [x] Criar regra pura de consulta/validação com testes de isolamento entre lojas, normalização e medidas divergentes.
- [x] Integrar a busca do catálogo e o bloco MDX visível na página do produto.
- [x] Validar testes, tipos e build no GitHub CI conforme instruções do projeto.

Não alterar preço, estoque, fabricante, MPN nem códigos legados. Não criar páginas duplicadas para cada código. Não usar texto oculto.

Evidência: CI 42485749340 aprovado em 08/11/2026; 1.415 testes unitários, integrações PostgreSQL, navegador, TypeScript, ESLint e build aprovados. Revisão técnica corrigiu divergência entre critérios de busca e ficha e drift de material. Publicação e verificação em produção ainda pendentes do fluxo automático.
