# OMNI-0.2 — Inventário de Integrações

<!-- markdownlint-disable MD013 -->

## Intenção

Registrar a capacidade realmente disponível de cada integração do Lojas 360 sem confundir credencial, conexão OAuth ou workflow ativo com operação completa.

## Entregáveis

- Um inventário JSON versionado e validável por máquina.
- Uma leitura operacional em Markdown, com estado, limites, exceções e lacunas.
- Um teste de contrato que impede a remoção acidental de canais e campos obrigatórios.

## Modelo

Cada integração declara identidade, canal, estado observado, ambiente, evidências, autenticação e escopos, consultas, ações, webhooks, paginação, limites, retenção, homologação e dependências externas. Toda lacuna precisa apontar para uma decisão registrada ou dependência verificável.

Os estados permitidos são `operational`, `partial`, `connection-only`, `inactive` e `blocked`. A data do levantamento torna explícito que limites de terceiros precisam ser reconfirmados antes de uma implantação.

## Segurança

O inventário pode citar nomes e tipos de credenciais, nunca valores, tokens, chaves ou segredos. A coleta é somente leitura e não executa, publica ou altera workflows.

## Critérios de aceite

- Cobrir canais de venda, pagamento, logística, fiscal, identidade, comunicação, infraestrutura e automação encontrados no repositório.
- Registrar consultas, ações, webhooks, paginação, rate limits, retenção, homologação e dependências.
- Diferenciar integração operacional, parcial, somente conexão, inativa e bloqueada.
- Vincular cada lacuna a uma decisão ou dependência.
- Registrar os workflows n8n observados e seu estado na data do levantamento.

## Fora do escopo

Não ativa canais, não cria credenciais, não executa workflows e não publica alterações em produção. Como não há mudança visual, prints não se aplicam.
