# Contratos comerciais versionados

## Intenção

Registrar a regra comercial de cada loja como dado auditável. Novos cadastros mantêm o plano escolhido e passam a ter comissão de 5% sobre vendas. Clientes existentes não recebem comissão retroativa. Vedashow permanece em R$ 350 por mês mais 5%; Bereta Rodas permanece em 3%, sem mensalidade inventada.

## Decisões

- Cada versão é uma linha de `ContratoComercial`, ligada ao tenant.
- Valores monetários usam centavos inteiros; percentuais usam pontos-base (`500` = 5%).
- O contrato guarda plano, mensalidade, comissão, vigência, situação e referência de aceite.
- Uma loja pode ter histórico, mas somente uma versão pode cobrir um instante.
- Alteração cria nova versão e encerra a anterior; valores de versão existente não são reescritos.
- Todo novo cadastro recebe contrato padrão de plano + 5%: no fluxo público, quando o plano é confirmado nos primeiros passos; no administrativo, na criação.
- A migração cria contratos legados sem comissão para lojas existentes, exceto Vedashow e Bereta Rodas.
- Vedashow é identificada pelo slug estável `vedashow`: R$ 350,00 e 500 pontos-base.
- Bereta Rodas é identificada pelo slug estável `bereta-rodas`: 300 pontos-base e a mensalidade já aplicável ao seu plano/faixa; a migração não inventa isenção nem novo valor.
- Pedido novo referencia o contrato vigente. Ausência ou ambiguidade não impede a venda: deixa a referência nula e, futuramente, bloqueará a cobrança de comissão.
- O cadastro antigo `faixaPreco` continua compatível durante a transição; o contrato passa a ser a fonte preferencial da mensalidade.

## Não objetivos

- Calcular ou cobrar a comissão por venda.
- Fazer split, fechamento mensal, nota fiscal da comissão ou repasse.
- Alterar contratos de clientes antigos além das exceções aprovadas.

## Segurança e consistência

- Administração exige o token já usado pelas APIs internas.
- Criação de versão ocorre em transação e rejeita vigência sobreposta.
- Percentual fica entre 0 e 10.000 pontos-base e mensalidade não pode ser negativa.
- Pedido preserva a versão escolhida mesmo depois de um novo contrato entrar em vigor.
- Migração é aplicada uma vez pelo Prisma; operações de pedido são idempotentes e a API de versão rejeita a mesma vigência.

## Aceite

- Novo cadastro público e administrativo recebe plano + 5%.
- Loja legada comum fica com 0%; Vedashow com R$ 350 + 5%; Bereta com 3%.
- Histórico, vigência e aceite são consultáveis pela administração.
- Sobreposição é recusada e lacuna nunca aplica 5% por fallback.
- Pedido criado pelo checkout e pelo Mercado Livre conserva `contratoComercialId` quando há uma única versão vigente.
