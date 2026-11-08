# Domi-Rio: 50 artigos MDX — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Disponibilizar os 50 artigos e sete capas fornecidos pelo proprietário no blog da Domi-Rio.

**Architecture:** MDX versionado, compilado pelo `@next/mdx` já instalado, com índice de metadados e importações explícitas por slug. As rotas da loja resolvem esse conteúdo somente para `domi-rio`; posts existentes do banco continuam disponíveis. Não importar MDX arbitrário do banco nem alterar o catálogo.

**Tech Stack:** Next.js 16, React 19, TypeScript, MDX, CSS Modules, node:test na CI.

**Spec:** Pasta fornecida `domi-rio-50-posts-mdx`, seu `INDICE.md`, 50 arquivos em `posts/` e sete capas WebP em `capas/`.

## Global Constraints

- Builds e testes somente no GitHub CI, conforme `AGENTS.md`.
- Preservar os corpos, as fontes e as capas fornecidos; remover apenas frontmatter e H1 duplicado da cópia compilável.
- Metadados, sumário e tempo de leitura derivam dos arquivos fornecidos.
- Não inventar autor humano, data original de publicação, receita ou recomendação de produto.
- Conteúdo exclusivo da Domi-Rio; outros tenants e blog da plataforma mantêm o comportamento atual.
- Sem PR: publicação direta na main já autorizada pelo proprietário.
- Usar a cópia isolada existente; preservar alterações paralelas no diretório principal.

## Review Focus

- Slug de artigo da Domi-Rio em outra loja deve manter o fluxo de consulta do tenant atual.
- Todos os 50 slugs e sete arquivos de capa devem existir, sem repetição ou truncamento.
- Cabeçalho contém um único H1; sumário aponta para seções reais e únicas.
- Pesquisa com acentos e categoria sem resultados deve funcionar no celular e teclado.
- Sitemap, menu, home e links relacionados devem descobrir os artigos sem duplicar URLs do banco.

## Tarefas

- [x] 1. Criar testes de integridade do conjunto, isolamento, busca e navegação; execução reservada à CI.
- [x] 2. Importar os 50 MDX e sete capas; criar metadados e mapa de imports explícitos.
- [x] 3. Construir índice por tema e página editorial responsiva com sumário, fontes e leitura relacionada.
- [x] 4. Integrar rotas, metadados, menu, sitemap, home e descoberta em texto.
- [x] 5. Conferir manualmente desktop/mobile, todos os slugs e recursos sem executar build/testes locais.
- [x] 6. Publicar commit na main, acompanhar CI e corrigir falhas; registrar evidências verificadas.

## Decisões de execução

- A pasta fornecida já determina conteúdo, formato e capas; não há nova pauta ou texto técnico a aprovar.
- Metadados sem datas permanecem sem data editorial exibida; a autoria é organizacional.
- O ciclo de testes acontece exclusivamente na CI; não executar uma etapa vermelha local.
- O blog existente armazena texto puro; não convertê-lo em MDX nem modificar a interpretação desse conteúdo.
- O lockfile da base estava truncado e não era JSON válido. Recuperar a versão íntegra e reconciliar pelo npm foi necessário para compilar; o commit do gerador 3D declarado no manifesto foi preservado.
- Evidências e estado final: `docs/DOMIRIO-50-POSTS-MDX.md`.
