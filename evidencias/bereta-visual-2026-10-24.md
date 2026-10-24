# Bereta Rodas: visual mobile

O banner da loja passa a usar imagens editoriais de rodas e pneus, com variações para desktop e celular. Os dados e os arquivos são exclusivos do tenant `bereta-rodas`; fotos, preços e estoque dos produtos são preservados.

O template Automotivo Premium recebe títulos de cards com até três linhas, fonte de 13 px no celular, disponibilidade compacta, menor espaçamento da busca e categorias com proporção 1,3:1. Os títulos completos continuam no link e na página de produto. O texto alternativo das imagens editoriais deixa de afirmar que a foto representa uma instalação ou um projeto realizado pela loja.

Verificação inicial: `git diff --check` aprovado. O workflow Build e deploy valida integração, tipos, testes e build antes do merge automático. A publicação e a inspeção visual em 390 px, 320 px e desktop devem ser conferidas após o deploy.
