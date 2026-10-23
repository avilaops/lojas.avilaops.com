# Indexação das lojas — 23/10/2026

## Evidência operacional

- Bereta Rodas: `https://bereta-rodas.lojas.avilaops.com/sitemap.xml` retornava HTTP 500.
- Log de produção: PostgreSQL `54001 stack depth limit exceeded` durante o `Produto.findMany()` completo usado pelo sitemap.
- VedaShow: o produto auditado responde 200, permite indexação, tem canonical próprio e consta no sitemap de 4.847 URLs. O Search Console baixou o sitemap em 23/10 sem erros, mas ainda não reconhece essa URL.
- PK Vedações: o produto auditado responde 200, permite indexação, tem canonical próprio e consta no sitemap de 816 URLs. O sitemap foi aceito sem erros, mas o Search Console ainda não reconhece essa URL.
- Brilhax: o produto Acidus Fast está enviado e indexado. A página já declara a política global de devolução; avaliações não existem e o frete varia por CEP.
- Domi-Rio: `sc-domain:domiriodistribuidora.com.br` não aparece entre as propriedades acessíveis à conta de serviço.

## Mudança

- O sitemap deixou de reutilizar a consulta completa da vitrine.
- Produtos publicáveis são lidos em páginas de 1.000, por cursor estável, apenas com os campos necessários ao sitemap e à decisão de promoções.
- A política global ganhou um `@id`; ofertas simples e variantes agora fazem referência explícita a ela.
- Frete continua declarado somente quando é gratuito e garantido para todo o destino coberto. `review` e `aggregateRating` continuam ausentes sem avaliações reais.

## Validação

- Teste de regressão criado primeiro e observado falhando pela ausência da implementação.
- Paginação aprovada com 8.426 produtos, sem perda ou duplicação.
- Suíte: 1.244 testes aprovados.
- TypeScript: aprovado.
- ESLint: zero erros; 24 avisos preexistentes fora do escopo.
- Build Next.js: aprovado; permaneceu um aviso preexistente de rastreamento NFT no removedor de fundo.
- Alteração sem interface visual: screenshots não se aplicam.

## Limite externo

O MCP de Search Console instalado é deliberadamente somente leitura. Ele permite confirmar propriedades, sitemaps, desempenho e inspeção, mas não permite cadastrar propriedade, reenviar sitemap ou pedir indexação manual. A API de inspeção também não solicita indexação de páginas comerciais comuns. Por isso, essas ações exigem uma sessão do Search Console com permissão de proprietário ou uma extensão controlada da integração.
