# Catálogo padronizado — implementação local e pontos de controle

## Estado em 12/09/2026

A primeira base da padronização está implementada localmente. **Não foi feito deploy nem migração estrutural em produção.** Em produção foram atualizados somente os dados da Brilhax, usando a API atual; o resultado está em `output/catalogo-padrao/RESULTADO-CATALOGO-BRILHAX.md`.

## Responsabilidades implementadas

- Produto reúne identidade, descrição, categoria e dados compartilhados.
- Todo produto tem variante interna padrão, inclusive cadastro simples. A apresentação padrão não exige uma grade visível para o lojista.
- Variante concentra SKU, GTIN/MPN, apresentação, disponibilidade e dimensões; `PrecoVariante` e `SaldoEstoque` são as fontes comerciais. Campos legados em Produto/Variante são projeções de compatibilidade.
- Escrita centralizada, transações por tenant/produto, revisão otimista, histórico por versão e evento de catálogo.
- Estoque com saldo físico, reservado, reservas por tentativa e movimentos idempotentes. Pagamentos de resultado incerto conservam a reserva para reconciliação, sem presumir falha ou liberar estoque prematuramente.
- Mídia por produto ou variante, incluindo a possibilidade de a mesma URL ser associada a diferentes variantes sem misturar escopos.
- Feed por variante, identificador externo estável e URL da apresentação. GTIN inválido não é anunciado como válido; MPN não é deduzido de qualquer código legado.
- Diagnóstico acionável no painel. Estado interno de validação, envio e aprovação externa são conceitos separados; envio não equivale a aprovação do Google.
- APIs administrativas de catálogo/eventos para consumo por automações e confirmação explícita de processamento.

## Migração e compatibilidade

Arquivo: `prisma/migrations/20260912150000_catalogo_padronizado/migration.sql`.

A migração executa em transação, preserva um snapshot histórico, cria variantes padrão, preços/saldos/mídias, mantém identidade externa do catálogo simples e adiciona restrições de tenant, combinação, SKU e integridade. Escritas diretas nos campos comerciais legados são rejeitadas após a migração.

Antes de publicar:

1. Inventariar integrações, scripts, importações e fluxos n8n que escrevam diretamente em Produto/Variante; migrá-los para a API central.
2. Comparar código e estado atual de produção com esta implementação. Não publicar um arquivo standalone antigo nem aplicar somente a migração.
3. Fazer backup recuperável do banco e do release, testar a migração sobre cópia integral e conferir contagens, preços, saldos e IDs por loja.
4. Validar painel, importação, grade, URL de variante, frete e checkout num ambiente de homologação com gateways de teste. O QA visual local completo está pendente: a inicialização do servidor local foi bloqueada pela política do ambiente nesta execução.
5. Publicar código e migração em janela coordenada, conferir saúde, catálogo, feed e fluxo real; manter procedimento de restauração do conjunto código+banco. Não reverter só o código enquanto os triggers da nova estrutura estiverem ativos.

## Verificações executadas

- `npm test`: 230 testes passaram.
- `npx tsx --test tests/integration/catalogo.test.ts`, com banco local isolado: 9 testes passaram. Cobrem produto simples, revisão, isolamento por loja, grade e preço próprio, feed/GTIN, disputa pela última unidade, aliases, repetição de webhook, mídia por variante, busca e unicidade global da referência de cobrança.
- `npm run typecheck`: passou.
- `npm run build`: passou; há aviso de tracing amplo do Turbopack que merece revisão antes do empacotamento.
- `npx tsx scripts/conferir-migracao-catalogo.ts output/catalogo-padrao/brilhax-catalogo.json`: última versão da migração reconciliada em cópia local dos 224 produtos, com zero divergências de identidade e valores comerciais.
- As provas de banco usam somente o container de teste local `lojas-catalogo-padrao-test`, porta 5548. Não utilizar os scripts de QA contra produção.

O pacote compartilhado de checkout foi realocado externamente durante o trabalho. As referências locais de `package.json`/lock e testes foram ajustadas para `../ferramentas/packages/checkout`; validar que o empacotamento do release inclui esse diretório. Nenhum gateway foi trocado ou credencial de pagamento alterada.

## Ainda não implementado/publicado

- Catálogo técnico tipado por categoria com definições, unidades e fontes próprias; nesta base os atributos continuam em JSON.
- Promoções com vigência e regras comerciais avançadas, operação completa de múltiplos depósitos e suas interfaces.
- Publicação completa e retorno assíncrono de todos os canais, incluindo reconciliação com Google/Meta/marketplaces.
- Edição em lote com prévia completa e experiência final de qualidade por canal.
- Fluxos n8n efetivamente instalados e testados consumindo os eventos novos; endpoints preparados não equivalem a fluxo em funcionamento.
- QA visual/interativo completo da implementação estrutural e deploy com verificação efetiva de runtime.

Esta base não deve ser anunciada como a conclusão integral do plano arquitetural original.
