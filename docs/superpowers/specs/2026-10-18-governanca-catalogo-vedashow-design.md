# Governança mínima do catálogo da VedaShow

## Intenção

Transformar as verificações isoladas já existentes em um relatório operacional
do catálogo inteiro. A VedaShow continua sendo um tenant do Lojas; nenhuma
regra pode depender de código fixo da loja ou acessar dados de outro tenant.

## Estado atual

`diagnosticarProduto` valida uma ficha por vez e já cobre título, categoria,
marca, descrição, preço, SKU, identificadores, frete e imagem. A API do painel
expõe esse diagnóstico somente quando um produto é aberto. Não existe cobertura
agregada, relatório por SKU ou comparação entre produtos.

## Decisão

Uma função pura recebe produtos já limitados ao tenant e gera:

- uma linha para cada SKU ativo, com família, completude, ocorrências e estado;
- resumo de produtos, SKUs, campos verificados, cobertura e bloqueios;
- duplicidades por SKU normalizado entre produtos distintos;
- conflito de preço quando o mesmo SKU normalizado possui mais de um preço;
- cobertura por campo e por família.

O SKU é normalizado em maiúsculas e sem separadores para comparação. A mesma
apresentação padrão repetida nos campos de produto e variante não conta como
duplicidade. Produto sem SKU continua no relatório com uma chave sintética
estável e uma ocorrência crítica.

Todos os produtos exigem nome, categoria, marca, código, unidade, NCM,
descrição, imagem, estoque e preço. Medidas são específicas:

- retentor e O-ring: diâmetro interno, diâmetro externo e altura/seção;
- rolamento: diâmetro interno, diâmetro externo e largura/altura;
- outras famílias: ao menos uma especificação técnica mensurável.

A família vem do nome da categoria; atributos legados podem fornecer `unidade`
ou `unidadeVenda`, `ncm` e medidas sem reescrever os dados.

Uma nova rota administrativa
`/api/admin/tenants/[slug]/catalogo/qualidade` consulta somente o tenant
resolvido, sem paginação truncada, e devolve o relatório. Ela é leitura
autenticada; não altera nem bloqueia o catálogo automaticamente.

## Não objetivos

- Corrigir produtos ou escrever no banco.
- Bloquear checkout ou despublicar itens.
- Inventar medidas ausentes a partir do nome.
- Tratar diferença de preço entre SKUs diferentes como conflito.
- Criar interface visual nesta entrega.

## Aceite

- Cada SKU ativo possui uma linha auditável.
- Campos obrigatórios e medidas por família geram erros ou avisos claros.
- SKUs equivalentes após normalização são detectados entre produtos.
- Preços diferentes para o mesmo SKU são destacados.
- Cobertura total, por campo e por família é calculada de forma determinística.
- A rota administrativa é isolada por tenant e não limita o resultado a cem
  produtos.
- Nenhuma mutação de produção é executada.
