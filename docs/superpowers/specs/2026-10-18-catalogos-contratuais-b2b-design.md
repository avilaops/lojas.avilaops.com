# Catálogos contratuais e tabelas de preço B2B

## Intenção

Entregar catálogo e preço negociado por empresa ou unidade sem alterar o catálogo público B2C. O cadastro comercial precisa ser versionado, aprovável, auditável e determinístico, porque uma divergência de preço ou embalagem vira perda financeira e ruptura de estoque.

## Escopo

- Catálogos próprios de cada tenant, identificados por referência estável.
- Versões imutáveis depois da aprovação, com rascunho, aprovação, vigência e substituição explícitas.
- Atribuição do catálogo à empresa inteira ou a uma unidade específica.
- Inclusão e exclusão explícitas de produtos e variantes.
- Preço fixo ou desconto em pontos-base sobre o preço-base da variante.
- Quantidade mínima e máxima, múltiplo de venda, embalagem e unidade comercial.
- Kits com composição racional em unidades-base, sem escrever diretamente no saldo de estoque.
- Resolução determinística quando houver mais de um catálogo ou regra aplicável.
- Importação em lote idempotente, API administrativa e trilha de auditoria append-only.
- Preservação de SKU, GTIN, marca, NCM, CEST e atributos técnicos do cadastro mestre.

## Fora do escopo

- Tela do painel para manutenção manual; a primeira entrega é API administrativa e domínio.
- Reserva ou baixa de estoque para kits; o módulo apenas descreve a composição em unidades-base. AVL-235/AVL-236 consumirão essa composição.
- Cotações, negociação interativa e aprovação de pedidos; pertencem ao AVL-234.
- Motor geral de campanhas e descontos cumulativos; pertence ao AVL-237.
- Conversão cambial. Cada versão possui uma única moeda e esta entrega aceita apenas `BRL`.

## Modelo

### Catálogo e versões

`CatalogoB2B` é a identidade estável (`tenantId`, `referencia`, `nome`). `VersaoCatalogoB2B` é o snapshot comercial numerado. Uma versão nasce `RASCUNHO`, pode ser substituída enquanto rascunho e, ao ser aprovada, torna-se imutável. A aprovação exige ao menos um item, datas coerentes e nenhuma referência inválida.

Uma versão aprovada pode ter vigência futura. A resolução considera somente versões `APROVADA` cujo intervalo fechado-aberto contenha o instante consultado: `vigenteDesde <= agora` e `vigenteAte > agora` quando houver fim.

### Atribuição

`AtribuicaoCatalogoB2B` liga uma versão a uma empresa inteira ou a uma unidade da própria empresa. A restrição composta do banco impede atravessar tenant ou empresa. A atribuição tem prioridade inteira não negativa.

Na resolução, uma atribuição de unidade é mais específica que uma atribuição de empresa. Dentro da mesma especificidade, vence a maior prioridade; depois, a maior versão; por último, o ID lexical. O desempate total evita preço dependente da ordem do banco.

### Itens e regras

`ItemCatalogoB2B` aponta para produto e, opcionalmente, variante do mesmo tenant. `EXCLUIR` remove o item; `INCLUIR` o oferece. Um item incluído usa exatamente uma estratégia:

- `FIXO`: `precoFixoCentavos` inteiro não negativo.
- `DESCONTO`: `descontoPontosBase` entre 0 e 10000 aplicado ao preço-base atual da variante, com arredondamento inteiro pela metade para cima.

Regras de quantidade são intervalos fechados (`quantidadeMinima` e `quantidadeMaxima` opcional). Para a mesma variante e quantidade, vence a maior `quantidadeMinima`, depois `FIXO` antes de `DESCONTO`, depois o ID lexical. Intervalos sobrepostos são permitidos porque a precedência é total e auditável.

`multiploVenda`, `quantidadePorEmbalagem`, `quantidadeMinima` e `quantidadeMaxima` são inteiros positivos em unidades comerciais. Uma quantidade só é válida quando respeita o mínimo, o máximo e o múltiplo.

### Unidade comercial e kits

O item declara `unidadeComercial` e uma razão positiva `unidadesBaseNumerador/unidadesBaseDenominador`. A razão converte uma unidade comercial em unidades-base sem ponto flutuante. Exemplo: uma caixa com 12 peças é `12/1`; meio metro medido em centímetros pode ser representado por uma razão inteira equivalente definida pelo integrador.

Kits usam `ComponenteKitCatalogoB2B`. Cada componente aponta para uma variante de estoque e informa a quantidade-base racional. O domínio calcula necessidades, mas não altera `SaldoEstoque`; assim a publicação de catálogo não corrompe o razão de estoque.

### Dados fiscais e técnicos

`Produto` passa a guardar `ncm` e `cest` normalizados, além dos campos já existentes `sku`, `gtin`, `marca` e `atributos`. Catálogos referenciam o produto mestre, não copiam esses campos. A leitura da API projeta os dados atuais e a auditoria guarda os IDs e a versão comercial aplicados.

## Escrita, aprovação e importação

`salvarCatalogoB2B` recebe o agregado completo de uma versão rascunho. A operação é transacional e idempotente por `tenantId + referencia + versao`. Repetir o mesmo conteúdo não cria nova versão nem auditoria duplicada; mudar uma versão já aprovada é recusado.

`aprovarVersaoCatalogoB2B` valida o snapshot e registra ator, instante e hash do conteúdo. Depois da aprovação, trigger de banco bloqueia update/delete da versão, de suas atribuições, itens e componentes.

A importação em lote recebe uma lista de catálogos completos. Cada catálogo é atômico: falha em um agregado não grava metade dele, mas os outros agregados válidos continuam. A resposta separa gravados e rejeitados com referência e motivo estável.

## API

- `GET /api/admin/tenants/:slug/catalogos-b2b`: lista catálogos e versões.
- `POST /api/admin/tenants/:slug/catalogos-b2b`: cria ou substitui versão rascunho.
- `GET /api/admin/tenants/:slug/catalogos-b2b/:catalogoId`: lê agregado completo.
- `POST /api/admin/tenants/:slug/catalogos-b2b/:catalogoId/aprovar`: aprova uma versão.
- `POST /api/admin/tenants/:slug/catalogos-b2b/importar`: importa agregados em lote.
- `POST /api/admin/tenants/:slug/catalogos-b2b/resolver`: resolve catálogo, disponibilidade comercial e preço para empresa, unidade, variante, quantidade e instante.

Todas as rotas exigem `LOJAS_ADMIN_TOKEN`, resolvem o tenant pelo slug e nunca aceitam `tenantId` do corpo.

## Invariantes

- Todo vínculo possui `tenantId` em chave estrangeira composta.
- Unidade atribuída pertence à empresa atribuída.
- Produto e variante pertencem ao tenant do catálogo; variante pertence ao produto indicado.
- Apenas rascunhos podem mudar.
- Aprovação é monotônica e o snapshot aprovado é imutável.
- Valores financeiros são inteiros em centavos; percentuais são pontos-base.
- Quantidades e conversões usam inteiros/racionais; não há `Float` na regra comercial.
- Auditoria é append-only.
- Catálogo B2C permanece a origem quando não existe regra B2B válida.

## Migração e compatibilidade

A migração adiciona estruturas novas e os campos fiscais opcionais, sem criar catálogo automaticamente para clientes existentes. Sem atribuição B2B vigente, todos os fluxos continuam lendo o preço público atual. Isso evita duplicação e mantém comportamento de clientes legados.

## Verificação

- Testes unitários do resolvedor cobrem vigência, especificidade, prioridade, quantidade, arredondamento e fallback B2C.
- Testes de integração cobrem chaves compostas, imutabilidade, idempotência, aprovação, importação parcial e auditoria.
- Testes de API cobrem autenticação, isolamento por tenant, validação e respostas estáveis.
- Migração é aplicada do zero em PostgreSQL isolado.
- Suítes existentes, typecheck, lint e build permanecem verdes.
