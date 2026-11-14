# Bereta • retirada de referências rejeitadas

Em 14/11/2026 o proprietário informou que os11 links apresentados não eram da Bereta e autorizou explicitamente removê-los também da loja. Uma referência no HTML ou no prefixo de upload não comprova autoria. Não recuperar esses arquivos como se fossem originais da marca.

Operação manual: `Lojas • retirar referências rejeitadas da Bereta`, exclusivamente sobre main e o ambiente production. O PR executa apenas o contrato sem credenciais.

1. Rodar com aplicar=false. Conferir resumo e baixar o artefato `bereta-referencias-before-<run>`.
2. Rodar com aplicar=true e o SHA-256 conferido. O levantamento é repetido; qualquer mudança no plano aborta antes da escrita. O backup é persistido antes da aplicação.
3. Conferir `verification.json`, vitrine e produtos públicos. O resultado registra a preservação da quantidade, nomes, preços, estoque, slugs e estado dos produtos.

São removidas somente as11 referências explícitas dos campos públicos da loja, categorias e imagens de produtos do tenant bereta-rodas. Imagens diferentes, produtos e arquivos R2 permanecem. As imagens de produto passam pelo escritor normal `salvarProdutoNoCatalogo`, com versão esperada, histórico, associações e outbox; alterações da configuração usam trava e comparação dos valores anteriores. Transações são por registro; eventual progresso parcial é preservado para diagnóstico e uma nova execução idempotente.

O backup contém os valores anteriores somente dos campos alterados. Para reversão, conferir o estado atual e restaurar os campos correspondentes pelo painel/escritor normal; não executar substituição integral da loja nem reverter histórico de catálogo. A fonte do domínio externo beretarodas.com.br é uma questão separada.
