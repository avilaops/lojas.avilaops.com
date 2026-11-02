# VedaShow: refatoração com Hallmark

A vitrine de campanhas exibia apenas um h1 oculto. A abertura agora apresenta o título existente, campanha ao lado e busca direta por código, referência, aplicação ou medida antes dos demais blocos.

## Escopo

- Distribuidora.tsx: ativa composição exclusivamente quando tenant.slug é vedashow e a loja usa campanhas.
- Vedashow.module.css: sistema visual isolado por CSS Modules, tokens já publicados, grade responsiva, foco e redução de movimento.
- Mantidos BannerCarousel, imagens, destinos de campanha, categorias, produtos, preços, carrinho e eventos existentes.
- Outras lojas mantêm a composição anterior.

## Verificação

- Hallmark sloplint estático nos dois arquivos: 0 FAIL, 0 WARN; 1 NOTE sobre travessão já existente, preservado por copy: verbatim.
- git diff --check: sem erros.
- TypeScript e ESLint: resultados serão registrados após execução.
- Renderização em navegador e comparação antes/depois: pendentes. Não houve publicação em produção nesta etapa.

## Plugin

Ávila Hallmark 0.1.0 criado como plugin privado, com fontes originais MIT e endpoint OAuth verificado https://lojas.avilaops.com/api/mcp. A autorização OAuth é feita pelo usuário na instalação. A criação do plugin não comprova sessão autenticada no Lojas.
