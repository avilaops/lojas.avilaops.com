# Regressão da busca em 17/09/2026

**Estado: corrigida em 08/10/2026** pela migração
`20261008160000_busca_reune_o_que_a_farmacia_apagou`, que redefine a função com
a união dos corpos e reindexa os produtos. Este documento fica como laudo.

## O que acontece

`Produto.busca` é a coluna que toda busca da vitrine consulta por substring
(`src/lib/catalogo.ts:313`). Ela é mantida por gatilho no banco, de propósito,
para nenhum caminho de escrita poder esquecer de atualizá-la.

A migração `20260917100000_farmacia/migration.sql:34` redefiniu
`produto_texto_de_busca()` para somar `principioAtivo` e `apresentacao` — mas
foi escrita a partir da versão de **26/08** (`20260826200000_busca_sem_acento`),
não da que estava em vigor. As duas migrações intermediárias que já tinham
enriquecido a função foram sobrescritas:

- `20260910200000_busca_trgm_e_categoria/migration.sql:36`
- `20260912150000_catalogo_padronizado/migration.sql:320`

`CREATE OR REPLACE FUNCTION` substitui o corpo inteiro e não avisa.

## O que a loja deixou de achar

| Campo perdido | Busca que morreu |
|---|---|
| `identificadores` — `sku`, `gtin`, `mpn`, `nome` das variantes ativas | SKU ou MPN de uma **variação** (`LIMPA5L`, `FAB5000`) |
| `codigoOriginal`, `codigosEquivalentes` | código original e equivalentes — recurso de motopeças citado no `AGENTS.md` |
| `motos` — `marca`/`modelo` de `compatibilidade` | marca e modelo de moto |
| `medidas` — `diametroInternoMm`, `diametroExternoMm`, `alturaMm` e o par `AxBxC` | busca dimensional de `src/lib/busca-tecnica.ts` |
| `atributos` | atributo livre de importação |
| `gtin` do produto pai | GTIN do produto |

O que **continuou** funcionando: `nome`, `marca`, `sku` do pai,
`descricaoCurta`, e o que a própria migração somou (`principioAtivo`,
`apresentacao`). É por isso que a regressão não aparece no uso comum.

## Como foi encontrada

`tests/integration/catalogo.test.ts:115` sempre afirmou
`assert.ok(c.busca.includes("limpa5l"))`. O teste nunca rodava: `npm test` só
executava os unitários de `src/lib` e de `packages/checkout`, e a suíte de
integração exige o container de banco, que não era declarado em nenhum lugar.

Ao declarar o container (`docker-compose.test.yml`) e rodar a suíte, a falha
apareceu. Confirmado que **não é efeito da versão do Postgres**: a mesma falha
ocorre em `postgres:16-alpine` 16.15 e em `postgres:18-alpine` 18.6, com as
mesmas 8 passagens e 1 falha. Prova direta no banco:

```
select prosrc from pg_proc where proname='produto_texto_de_busca';
-- zero ocorrências de "identificadores"
```

## O conserto

Nova migração que redefine `produto_texto_de_busca()` com a **união** de tudo:
o corpo de `20260912150000_catalogo_padronizado:320` mais `principioAtivo` e
`apresentacao`. Depois `UPDATE "Produto" SET "nome" = "nome"` para reindexar o
que já existe — a coluna está errada em todas as linhas gravadas desde 17/09.

Foi o que a migração de 08/10/2026 fez. A suíte de integração passou inteira
antes de subir, e ganhou um teste que confere um termo de cada origem do texto
("a busca acha por cada origem do texto"): com o corpo de 17/09 ele falha.

## Para não repetir

Toda migração que mexe em `produto_texto_de_busca()` tem que partir do corpo em
vigor, não de uma versão anterior. `CREATE OR REPLACE` de função que outras
migrações já estenderam é sobrescrita silenciosa. O corpo em vigor é o da
migração de 08/10/2026. Rodar
`npm run test:integracao` antes de entregar mudança no catálogo é o que pega.
