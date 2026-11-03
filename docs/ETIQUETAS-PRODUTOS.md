# Etiquetas de produtos

O painel oferece **Produtos → Códigos de barras e etiquetas** e **Gerar etiquetas** na ficha do produto. A tela permite buscar por nome, SKU, GTIN ou código interno lido por scanner, selecionar variações de diferentes páginas, escolher quantidades e imprimir até 200 etiquetas por vez.

## Identificação

- Código interno: Code 128, derivado reversivelmente do ID persistido da variante. Não altera SKU nem GTIN; nome e preço podem mudar sem invalidar o código.
- IDs novos usam `V:<cuid>`. IDs `vp_<md5>` da migração do catálogo usam `V:M<decimal>`, preservando integralmente o identificador e aproveitando a compactação numérica do Code 128.
- GTIN cadastrado: EAN-8, UPC-A, EAN-13 ou ITF-14 conforme o tamanho. A geração valida formato e dígito, preserva zeros iniciais e bloqueia GTIN repetido entre unidades ativas da mesma loja. Não consulta a GS1 nem atribui GTIN comercial.
- Cada unidade vendável tem sua própria etiqueta. Produto simples usa a variante padrão; uma grade usa as variantes ativas. Etiquetas de variantes desativadas deixam de localizar uma unidade ativa.

## Acesso e impressão

A página e `GET /api/painel/etiquetas` exigem permissão `catalogo`. O tenant vem da sessão e restringe todas as consultas, inclusive busca por ID e verificação de duplicidade. As respostas usam `private, no-store`.

O SVG é gerado localmente por `bwip-js`, sem enviar dados do catálogo a terceiros. A prévia e a impressão usam o mesmo componente; imagens são decodificadas antes de abrir a impressão. Os códigos têm margens brancas internas. O preço é opcional e corresponde aos dados carregados na seleção; recarregue a seleção se o cadastro tiver sido alterado.

Formatos: etiqueta térmica de 100 × 50 mm ou A4 com duas colunas de 100 × 50 mm, sem espaçamento e com margem de 5 mm. Use escala 100%, sem cabeçalho/rodapé. A opção de salvar PDF é oferecida pelo diálogo do navegador. Outros tamanhos de papel exigem ajuste do layout.

O campo de busca recebe leitores que funcionam como teclado. A leitura não movimenta estoque nem adiciona itens a uma venda. Testar o papel e o leitor reais do cliente continua necessário para aceitar a impressão física.

Se o navegador não encerrar automaticamente o modo de impressão, **Voltar às etiquetas** libera uma nova tentativa sem perder a seleção. Tentar imprimir novamente limpa o aviso de falha da tentativa anterior. O CI executa o fluxo de navegador sobre o servidor standalone e preserva capturas e PDFs no artefato `lojas-etiquetas-<sha>`.

## Verificação reproduzível

Os comandos abaixo descrevem as verificações. Conforme AGENTS.md, novas execuções de testes e build devem ocorrer no GitHub CI. As evidências locais citadas na entrega inicial são históricas e não substituem os gates de publicação.

- `node --import tsx --test src/lib/etiquetas.test.ts`
- `node --import tsx --test tests/integration/etiquetas.test.ts` com `DATABASE_URL` local em `127.0.0.1:5548/*_test`.
- `npm run typecheck`
- `node --import tsx scripts/qa-etiquetas.mts` contra Next local na porta 3089, com `LOJAS_BASE_DOMAIN=127.0.0.1`, mesmo banco isolado e mesmo `LOJAS_SECRET` de teste. O script cria e remove os próprios dados de QA e usa um navegador separado.
- `python scripts/qa-etiquetas-pdf.py` após o QA visual, com `pymupdf`, `pillow` e `zxing-cpp`: confere tamanho e quantidade de páginas e decodifica as barras dos PDFs a 203 dpi com um leitor independente da biblioteca geradora.

As evidências visuais e os PDFs ficam em `output/playwright/etiquetas/`. O QA cobre seleção, busca por scanner, limite de quantidade, tela móvel, A4, térmica, troca para GTIN e respostas 401/403/422. Não equivale a validação em produção ou em impressora física.
