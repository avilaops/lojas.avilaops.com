# Catálogos contratuais B2B

## Objetivo

Esta API mantém preços, embalagens e disponibilidade comercial negociados por
empresa ou unidade. Ela não altera o catálogo público B2C, o preço mestre nem o
saldo de estoque.

Todas as rotas exigem `Authorization: Bearer <LOJAS_ADMIN_TOKEN>` e usam o
`slug` da URL como limite do tenant. Nenhuma aceita `tenantId` no corpo.

## Estados e vigência

- `RASCUNHO`: pode ser reenviado e substituído pela chave
  `tenant + referencia + versao`.
- `APROVADA`: snapshot imutável, protegido também por triggers no PostgreSQL.
- A vigência é fechada no início e aberta no fim:
  `vigenteDesde <= agora < vigenteAte`. Fim nulo não expira.
- A aprovação é idempotente. Repeti-la devolve a mesma versão e não duplica a
  auditoria append-only.

## Payload de escrita

`POST /api/admin/tenants/:slug/catalogos-b2b`

```json
{
  "referencia": "distribuidor-2027",
  "nome": "Tabela Distribuidor 2027",
  "versao": 1,
  "moeda": "BRL",
  "vigenteDesde": "2027-01-01T00:00:00.000Z",
  "vigenteAte": null,
  "atribuicoes": [
    {
      "empresaReferencia": "cliente-industrial",
      "unidadeReferencia": "matriz",
      "prioridade": 20
    }
  ],
  "itens": [
    {
      "produtoReferencia": "SKU-100",
      "varianteReferencia": "SKU-100-CX",
      "acao": "INCLUIR",
      "estrategiaPreco": "FIXO",
      "precoFixoCentavos": 125000,
      "quantidadeMinima": 5,
      "quantidadeMaxima": 100,
      "multiploVenda": 5,
      "quantidadePorEmbalagem": 12,
      "unidadeComercial": "CX",
      "unidadesBaseNumerador": 12,
      "unidadesBaseDenominador": 1,
      "componentes": []
    }
  ]
}
```

`produtoReferencia` e `varianteReferencia` aceitam o ID interno ou o SKU do
cadastro mestre. Empresa e unidade usam suas referências B2B. Uma unidade deve
pertencer à empresa atribuída; produto, variante e componentes devem pertencer
à loja indicada pelo slug.

Um item `INCLUIR` usa exatamente uma estratégia:

- `FIXO`: `precoFixoCentavos` inteiro não negativo;
- `DESCONTO`: `descontoPontosBase` entre 0 e 10000;
- `EXCLUIR`: não recebe estratégia nem preço.

Quantidades, múltiplos, embalagem, numeradores e denominadores são inteiros
positivos. `quantidadeMaxima`, quando informada, não pode ser menor que a
mínima. A moeda aceita nesta entrega é somente `BRL`.

## Leitura, aprovação e resolução

- `GET /api/admin/tenants/:slug/catalogos-b2b`: lista catálogos e versões.
- `GET /api/admin/tenants/:slug/catalogos-b2b/:catalogoId`: devolve o agregado.
- `POST /api/admin/tenants/:slug/catalogos-b2b/:catalogoId/aprovar`: corpo
  `{ "versao": 1, "ator": "operador@empresa.com" }`.
- `POST /api/admin/tenants/:slug/catalogos-b2b/resolver`: recebe IDs de empresa,
  unidade, produto e variante, quantidade e `agora` opcional.

Na resolução vence, nesta ordem:

1. atribuição da unidade sobre atribuição da empresa;
2. maior prioridade;
3. maior número de versão;
4. menor ID lexical.

Dentro da versão, a variante exata vence a regra geral; depois vence a maior
quantidade mínima, preço fixo antes de desconto e, por fim, o menor ID lexical.
Exclusão explícita vence inclusão no mesmo snapshot. Preço por desconto é
calculado em centavos com arredondamento pela metade para cima.

Sem atribuição vigente ou sem item aplicável, a resposta é `OFERTA_PUBLICA` e
preserva o preço B2C atual. Quantidade inválida ou exclusão retorna
`INDISPONIVEL`; uma oferta contratual retorna `OFERTA_B2B` com o ID do snapshot
e a composição racional do kit. Resolver nunca reserva nem baixa estoque.

## Importação em lote

`POST /api/admin/tenants/:slug/catalogos-b2b/importar`

```json
{ "catalogos": [/* mesmos agregados da escrita individual */] }
```

Cada agregado possui sua própria transação. Uma falha não grava metade daquele
catálogo e não impede os demais. A resposta separa `gravados` e `rejeitados`,
sempre com a referência e, nas rejeições, um motivo estável.

## Respostas de erro

- `401`: token administrativo ausente ou inválido;
- `404`: loja ou catálogo não pertence ao slug informado;
- `422`: payload inválido, referência inexistente, vínculo cruzado ou tentativa
  de alterar versão aprovada.

IDs de outro tenant nunca são resolvidos, mesmo quando enviados diretamente.
