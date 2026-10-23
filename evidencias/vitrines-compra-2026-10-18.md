# Catálogo mobile e atendimento contextual

## Escopo implementado

- Categorias com capa de 56 px e título compacto no celular.
- Filtros em duas linhas: busca e controles de filtros/aplicação; limpeza aparece somente quando há filtro ativo.
- Busca por nome não abre automaticamente os controles comerciais.
- Busca dimensional vem antes dos demais controles, também na ordem do teclado; faixas ativas continuam abertas e preservadas.
- Cards técnicos com imagem mais baixa, menos espaço antes do preço e conteúdo sem expansão vertical desnecessária no celular.
- Atendimento no catálogo e nas categorias usa apenas o WhatsApp configurado pelo tenant; inclui categoria, busca, marca, perfil e faixas dimensionais.
- Distribuidora sem banner deixa de orientar busca por medida; aviso de imagem representativa usa apresentação/características.

## Base já existente

A main consultada (`4fde2eb`) já contém ocultação de promoções vazias, copy da home Distribuidora por produto/finalidade, outras apresentações fora da tabela técnica e explicação de fechamento pelo site ou WhatsApp. Este incremento preserva essas implementações, sem registrá-las como novas.

## Validação local

- `node --import tsx --test src/lib/vitrine-compra-html.test.ts src/lib/imagem-origem.test.ts src/lib/filtros-url.test.ts`: 20 aprovados.
- `npm run typecheck`: aprovado.
- ESLint dos arquivos TypeScript alterados: aprovado.
- `npm run build`: aprovado; aviso de tracing amplo já na cadeia de processamento de imagens/removedor de fundo, fora deste escopo.
- `git diff --check`: sem erros.

O comando `tsx --test` encontrou EPERM ao criar seu socket IPC neste executor. A execução equivalente com `node --import tsx --test` passou, sem elevar permissões.

## Pendências para liberação e próximos incrementos

- Testes HTML comprovam conteúdo e estado dos formulários; não substituem inspeção visual de layout.
- Validar 360/390/430 px e desktop com tenants de teste, teclado, fluxo completo de frete/pagamento e Core Web Vitals. Nenhuma compra real foi executada.
- Conferir embalagens, fotos, aplicações e dados técnicos com fontes por SKU; nenhum número foi inferido ou cadastro de produção alterado.
- Recompra/listas, seletores completos por família, desenhos técnicos e consolidação de dados/categorias permanecem nos cards existentes. Não foram implementados neste incremento.
- Revisar o efeito compartilhado nas demais lojas, além de VedaShow/Domi-Rio, antes de publicar.
- Sem migração, merge ou deploy nesta entrega.

## Linear

Relaciona-se a AVL-265, AVL-269 e AVL-267 e à necessidade existente do Customer Domi-Rio. Manter tarefas maiores abertas até cumprir o restante do escopo.
