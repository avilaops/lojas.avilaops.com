# SEO de categorias V1

## Objetivo

Cada categoria tem metadados próprios, revisáveis e isolados por `tenantId`.
A vitrine pública apenas lê o Postgres. Gemini, n8n e MCP nunca são acionados
durante a visita de um cliente ou robô, preservando latência, custo e
previsibilidade.

## Estado persistido

`Categoria` mantém os campos:

- `seoTitle`, `seoDescription`, `seoKeywords`: conteúdo publicado;
- `seoPendente`: há conteúdo novo para gerar ou revisar;
- `seoOrigem`: `manual`, `gemini` ou `fallback`;
- `seoModelo`, `seoAtualizadoEm`: auditoria da publicação;
- `seoProcessandoEm`: trava atômica do lote;
- `seoErro`: última falha operacional;
- `criadoEm`, `atualizadoEm`: ordenação da fila e `lastModified` do sitemap.

A migration é `prisma/migrations/20260829170000_categoria_seo_v1`. Categorias
existentes começam pendentes para entrarem no primeiro lote.

## Fluxo de estado

```text
categoria criada ou conteúdo alterado
              |
              v
         SEO pendente
          /       \
 painel/MCP      n8n diário
 rascunho        reivindica trava
    |                 |
 revisão          Gemini ou fallback
    \                 /
      publicação no Postgres
              |
      sitemap + IndexNow + evento
```

Se o nome ou a descrição mudar enquanto o n8n processa, a edição invalida a
trava. O lote descarta o rascunho antigo e a categoria permanece pendente. Uma
trava abandonada pode ser retomada depois de 15 minutos.

## Contratos HTTP

Painel autenticado por sessão:

- `POST /api/painel/categorias/seo` com `{ id, contexto? }`: gera rascunho;
- `PUT /api/painel/categorias/seo` com
  `{ id, titulo, descricao, palavrasChave, origem, modelo? }`: publica o texto
  revisado.

Operação/n8n autenticada por `Authorization: Bearer LOJAS_ADMIN_TOKEN`:

- `GET /api/admin/seo/categorias`: mede a fila sem consumir IA;
- `POST /api/admin/seo/categorias` com `{ limite?, tenantSlug? }`: processa até
  25 categorias pendentes.

MCP da loja:

- `listar_categorias` mostra catálogo e estado do SEO;
- `atualizar_categoria` cria ou altera, sempre limitado ao tenant autenticado;
- `gerar_seo_categoria` retorna rascunho por padrão. `publicar=true` é uma ação
  explícita e grava o resultado.

## Regras de conteúdo

A geração recebe somente nome da loja, segmento, categoria, descrição atual e
até 60 produtos ativos, com marcas e compatibilidades realmente cadastradas.
O prompt proíbe inventar preço, estoque, frete, garantia, prazo, certificação,
aplicação ou marca. Sem chave Gemini ou com resposta inválida, o fallback usa
somente esses mesmos dados e respeita os limites do schema Zod.

## Publicação e busca

`generateMetadata` usa os campos publicados e mantém fallback para nome e
descrição legados. O canonical é `/categoria/<slug>`, `sitemap.xml` usa
`Categoria.atualizadoEm`, e `llms-full.txt` expõe a descrição publicada. Após
salvar, a plataforma envia a categoria e o sitemap ao IndexNow.

## Verificação antes do deploy

```powershell
$env:DATABASE_URL='postgresql://user:pass@127.0.0.1:5432/lojas_validation'
npx prisma validate
npx prisma generate
npm run typecheck -- --pretty false
npm run test:seo
npm run build
```

No ambiente de destino, aplicar migrations com `npm run prisma:migrate` antes
de subir o novo build. `GEMINI_API_KEY` é opcional; sem ela o fluxo continua
funcionando pelo fallback.
