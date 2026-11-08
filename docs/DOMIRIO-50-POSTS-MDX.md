# Domi-Rio: coleção de 50 artigos MDX

## Entrega

Disponível em [Central Domi-Rio](https://domiriodistribuidora.com.br/blog).
Os 50 textos e sete capas foram fornecidos pelo proprietário em
`domi-rio-50-posts-mdx`; a origem permanece intacta no diretório principal.

O conteúdo versionado está em `src/content/domirio/posts`. O frontmatter foi
transferido para `indice.json`, com sumário e tempo de leitura derivados dos
arquivos. Apenas o H1 duplicado foi removido dos corpos: a página o apresenta
no cabeçalho. As fontes dos artigos foram preservadas e não houve ampliação
de recomendações agronômicas ou afirmações sobre legislação nesta implementação.

`carregar.ts` contém uma importação explícita por artigo. Nenhum conteúdo
recebido de visitante ou do banco é compilado como MDX. Datas de publicação
não fornecidas não foram inventadas. A autoria exibida é organizacional.

## Experiência e integração

- Índice com busca que ignora acentos, filtro em sete temas e estado vazio.
- Página responsiva com capa, sumário, fontes, anterior, próxima e relacionados.
- Home com entradas para a coleção; rodapé, sitemap e llms.txt com descoberta.
- Metadados canônicos, Open Graph, Twitter e Article JSON-LD.
- Conteúdo estático exclusivo de `domi-rio`; publicações existentes do banco
  mantêm seu fluxo de texto puro. Em colisão de slug, a coleção MDX é a entrada
  canônica e não há URL duplicada no índice ou sitemap.

As capas ficam em `public/media/domirio/blog`. Os estilos usam os tokens da loja.
Catálogo, preços, estoque, pedidos e configurações de produção não foram editados.

## Verificação

A implementação `abbbe07` foi enviada diretamente à main, sem PR.
[Execução da CI](https://github.com/avilaops/lojas.avilaops.com/actions/runs/42486895808):
unitários, tipos, lint, build, integração PostgreSQL, contratos, navegador e
empacotamento concluíram com sucesso. O deploy registrou a troca de container
concluída; o job foi cancelado durante a limpeza após uma atualização concorrente
da main. O smoke desse workflow foi pulado. Não se declara o workflow inteiro
como aprovado: a confirmação pública abaixo foi feita depois da implantação.

Conferência HTTP pública em **2026-11-08 às 13:59:46 UTC**:

| Item | Resultado |
| --- | --- |
| 50 artigos | HTTP 200 em todos |
| H1, canonical, capa e seção de fontes | Presentes em todos os artigos |
| Sete capas WebP | HTTP 200 e MIME image/webp |
| Índice /blog | 50 slugs presentes |
| Sitemap | 50 slugs presentes |

Conferência manual local adicional: desktop de 1440 px e mobile de 390 px,
sem overflow horizontal; consulta `receituario` encontrou um artigo; filtro
Legislação e segurança retornou seis. O primeiro slug devolveu 404 no domínio
da Bereta e no blog da plataforma. Os testes de isolamento e integridade da
coleção ficam em `src/lib/artigos-domirio.test.ts` e rodaram apenas na CI.

Os relatórios e capturas operacionais ficam em `.work/domirio-inspecao/`
na cópia isolada, incluindo `50-paginas.json`, `leituras.json` e `producao.json`.
O lockfile truncado herdado da base foi recuperado e reconciliado com o npm,
preservando o commit do gerador 3D já declarado; a preparação de dependências
da CI confirmou o resultado.
