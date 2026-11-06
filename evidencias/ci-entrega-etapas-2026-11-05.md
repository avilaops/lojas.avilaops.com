# CI e entrega remota — 05/11/2026

Continuação autorizada do Lojas para cumprir `timeout-minutes: 1`, conforme
política do projeto Linear consultada em 05/11. Não há exceção registrada.

## Alteração

- Contexto Docker montado em job independente, a partir do build, Prisma,
  modelo e runtime aprovados, com o protocolo de SHA/run/tentativa/hash.
- Download remoto separado da ativação. O novo `prepare` não aplica migração
  nem troca o container. O `deploy` completo preserva seus controles.
- As duas etapas verificam runs mais novos. Operação superada não comprova
  publicação nem dispara a fumaça dependente.
- Testes isolados da fronteira SSH, erro/limpeza de credenciais e política de
  timeout em todos os jobs dos workflows de build/deploy e merge automático.

## Infraestrutura aprovada

- PR: https://github.com/avilaops/infra/pull/12
- Commit integrado: `0939a170c24a00fac7b358db8c300774af5c1fd1`.
- CI: https://github.com/avilaops/infra/actions/runs/42052030713
- 194 testes aprovados em 12,414 segundos; job de 17 segundos.
- Dispatcher instalado em nbg1; SHA-256:
  `4ac94df2abf9c5d983ca27b3cfc9f133880d382692efdd754c179a5201465c82`.
- Cópia anterior preservada; SHA-256:
  `ba979df59d1eb75d74ed6d393f97001d05b337cd693c525f2d7d2b3c2bf287bb`.
- Opt-in `ALLOW_IMAGE_PREPARE=true` somente no arquivo da aplicação Lojas.
- Instalação sob trava, conferência do hash anterior e sintaxe Bash, sem
  reinício. Container manteve revisão `69ae2656` e estado saudável.

## Verificação do Lojas

PR: https://github.com/avilaops/lojas.avilaops.com/pull/202

CI do primeiro commit aprovou dependências, unitários, payloads/entrega,
integrações, lint e tipos. Evidência final de build, navegador, imagem e
publicação será registrada no PR e Linear após aprovação do commit final.
Nenhum build, suíte ou criação de imagem foi executado localmente ou no servidor.

O aceite operacional de endereço, horários, fiscal e recebimento nos canais da
AVL-261 permanece independente desta mudança de infraestrutura.
