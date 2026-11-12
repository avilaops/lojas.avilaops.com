# Evidências — AVL-236

## Identidade da execução

- Ambiente: worktree `AVL-236/worktree`, desenvolvimento local, 03/11/2026.
- Branch: `codex/gestor-20261103-urgentes-5-01-avl-236`.
- Base lida: `45fe4cff9dec3d032f16a8215566044c384cd125`.
- Implementação verificada:
  `c4c9f978722a8f54363d47d8af9ac4c2e5f03731`.
- Node observado: `v24.21.0`; Prisma gerado: `6.19.3`;
  PostgreSQL descartável: `18.6`.
- Sem execução em produção, serviços financeiros/fiscais ou provedores.

## Descoberta e fontes

Foram lidos `/home/avops/AGENTS.md`, o `AGENTS.md` da worktree, README,
`package.json`, o schema/migrations, serviços de catálogo/reservas/oferta,
rotas/helpers da API, testes existentes e documentação MLOps/equipe.
O `issue.json` do diretório da missão e os comentários fornecidos foram
confrontados com as consultas conectadas abaixo.

| Ferramenta/comando | Resultado observado |
| --- | --- |
| `git status --short`, `git branch --show-current`, `git log -4 --oneline` | Worktree inicialmente limpa, branch dedicada e base acima. |
| `git worktree list`, `git for-each-ref`, `git log --all --grep='multilocal\|AVL-236' -i` | Checkouts paralelos identificados; a busca por esses termos não retornou commits. Não é auditoria exaustiva de todo histórico. |
| `git -C <checkout original> status --short` | Alterações preexistentes no Inventario e controle da equipe; preservadas. |
| `git -C <worktrees AVL-238/AVL-240> status --short` | Escopos de pagamento/fiscal distintos dos arquivos novos de estoque. Somente leitura. |
| Linear `get_issue` AVL-236 e AVL-230 com relações; `list_comments` de ambas | Issue de estoque em Backlog e pai In Progress; aceite, comentários e relações disponíveis foram lidos. |
| Linear `list_issues` do pai e `get_issue` AVL-251 | Contexto das frentes paralelas e exigência de divergências ERP em fila, sem vencedor silencioso. |
| Linear `list_documents` do projeto; consulta `query: agente` | Dois documentos de projeto listados; busca por notas de agente não retornou documentos. Sem afirmar que não existam fora dessa consulta. |
| GitHub `search_prs`, query `repo:avilaops/lojas.avilaops.com AVL-236` | Lista vazia. Não foi criado PR. |
| GitHub `fetch_commit_workflow_runs`, SHA completo da base | Lista vazia; nenhum resultado de CI foi inferido. |

O ciclo de issue foi carregado antes de implementar. Transições e comentários
no Linear não foram executados porque o contrato específico manda entregar
relatório ao gestor. Nenhuma ferramenta de grafo Codebase Memory estava
habilitada; a exploração usou fontes locais enraizadas na worktree.

Referência técnica consultada: [triggers PostgreSQL](https://www.postgresql.org/docs/18/plpgsql-trigger.html).
A documentação atual genérica do Prisma apontou outra geração de API; a
implementação conservou as interfaces Prisma 6 verificadas no projeto.

## Preparação e alternativas utilizadas

1. `flock /home/avops/agent-manager/verification.lock npm ci --ignore-scripts
   --no-audit --no-fund`: falhou por `EAI_AGAIN registry.npmjs.org` no sandbox.
2. Mesmo comando, com `--cache /tmp/avl236-npm-cache` e execução autorizada
   fora da restrição de rede: aprovado, 564 pacotes instalados em 25 segundos.
   Nenhum `node_modules` externo foi copiado; lockfile não foi alterado.
3. `initdb -D /tmp/avl236-pg -A trust -U postgres --no-locale --encoding=UTF8`:
   aprovado. Primeiro `pg_ctl start` falhou por socket TCP não permitido.
4. `pg_ctl -D /tmp/avl236-pg -l /tmp/avl236-pg.log -o '-h 127.0.0.1 -p 5548
   -k /tmp' start`, autorizado para loopback: aprovado. Criada somente a base
   de testes `avl236_test`; nenhum banco original foi alterado.
5. `prisma generate` padrão falhou com `EROFS` ao tocar cache global. Tentativa
   com `XDG_CACHE_HOME=/tmp/avl236-cache` falhou por DNS de binaries.prisma.sh.
6. Alternativa aprovada: configurar `PRISMA_QUERY_ENGINE_LIBRARY` e
   `PRISMA_SCHEMA_ENGINE_BINARY` para os binários **já existentes**, somente
   em leitura, em `/home/avops/.cache/prisma/master/c2990dca591cba766e3b7ef5d9e8a84796e47ab7/debian-openssl-3.0.x/`.
   `node node_modules/prisma/build/index.js generate` gerou Prisma Client
   6.19.3 na própria worktree.

Conexões locais de teste exigiram liberação do sandbox; não houve leitura
de credenciais. A base usa autenticação descartável local, sem dados reais.
Instalação e aplicação de migrations usaram o lock compartilhado indicado.

## Verificações finais aprovadas

Os comandos abaixo foram executados nesta worktree. Para Prisma/runtime foi
usado o Query Engine local indicado acima; `DATABASE_URL` apontou somente para
`postgresql://postgres@127.0.0.1:5548/avl236_test`.

### Persistência

```sh
flock /home/avops/agent-manager/verification.lock env \
  PRISMA_SCHEMA_ENGINE_BINARY=<cache-local>/schema-engine \
  DATABASE_URL=postgresql://postgres@127.0.0.1:5548/avl236_test \
  node node_modules/prisma/build/index.js migrate deploy
```

Resultado: exit 0, 87 migrations aplicadas com sucesso, incluindo a exclusiva
`20261103010000_avl236_estoque_multilocal`. Base criada do zero nesta execução.

```sh
flock /home/avops/agent-manager/verification.lock \
  psql -h 127.0.0.1 -p 5548 -U postgres -d avl236_test \
  -v ON_ERROR_STOP=1 -f tests/sql/avl236-abertura.sql
```

Resultado: exit 0; mensagem `AVL-236: abertura com dados preexistentes,
reserva e remoção aprovadas.` O schema exclusivo de fixture foi removido pelo
próprio ensaio; não houve remoção de tabelas do schema público.

### Testes

```sh
node --import tsx --test --test-isolation=none --test-reporter=tap \
  src/lib/estoque-multilocal.test.ts src/lib/api-chaves.test.ts \
  src/lib/api-indice.test.ts
```

Resultado: exit 0, **22/22 testes**, zero skips. A opção de isolamento foi
usada para obter TAP com casos individuais neste Node; a primeira execução
isolada mostrava apenas os três arquivos aprovados, sem detalhar seus casos.
TAP versionado em `evidencias/avl236/unit.tap`.

```sh
PRISMA_QUERY_ENGINE_LIBRARY=<cache-local>/libquery-engine \
DATABASE_URL=postgresql://postgres@127.0.0.1:5548/avl236_test \
node --import tsx --test --test-reporter=tap \
  tests/integration/estoque-multilocal.test.ts \
  tests/integration/catalogo.test.ts
```

Resultado: exit 0, **22/22 testes**, zero skips: 12 cenários novos e 10
existentes de catálogo. TAP versionado em `evidencias/avl236/integration.tap`.
Os `prisma:error` nesse TAP correspondem às recusas esperadas e assertadas,
como imutabilidade e constraints; o sumário final é 22 aprovados, zero falhas.

Falhas intermediárias resolvidas:

- Primeira integração sem `PRISMA_QUERY_ENGINE_LIBRARY`: runtime não encontrou
  o Query Engine porque a instalação havia desabilitado scripts. Corrigida
  com referência explícita ao binário existente.
- Integração seguinte: 11 aprovados e 9 falhos. O novo advisory lock via
  `$queryRaw` tentou desserializar `void`, recusado pelo Prisma. Alterado para
  `$executeRaw`, sem mudar o lock ou sua duração transacional. Reexecução
  inicial passou 20/20; os dois cenários adicionais finais passaram em 22/22.

### Análise estática e revisão

```sh
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/eslint/bin/eslint.js \
  src/lib/api-chaves.ts src/lib/api-indice.ts src/lib/catalogo-oferta.ts \
  src/lib/estoque-multilocal-schema.ts src/lib/estoque-multilocal.ts \
  src/lib/estoque-multilocal.test.ts src/app/api/v1/estoque \
  tests/integration/estoque-multilocal.test.ts
git diff --check
git diff --cached --check
```

Resultados: exit 0, sem erros de tipos, lint ou whitespace na revisão final.
A checagem staged identificou espaços finais gerados pelo Prisma no TAP;
somente esses 12 espaços foram removidos do artefato versionado. Código e
resultados dos testes foram preservados.

Revisados diff, arquivos adicionados e TAPs para dados reais/segredos e escopo.
Não há arquivos alterados de pagamentos/fiscal ou da UI de inventário.
Não foram executados build, suíte completa, CI nova ou operação externa real.

## Integridade dos artefatos

| Artefato | SHA-256 |
| --- | --- |
| `evidencias/avl236/unit.tap` | `5f4982b108f5f5fee9f937ff03033db1f741a734b41870912c3f6d2f49b22865` |
| TAP bruto da integração antes da normalização | `29be407e0df6818bbc4a6300d354590da2669687cbe9eed031d8ee4d0c1a135a` |
| `evidencias/avl236/integration.tap`, sem espaços finais | `f9a0df190a89edf714cb4de769d22d2067a7f5b94b3a126a117f6ba3ace8c15f` |

Na retomada, antes de qualquer edição, foram conferidos os hashes dos dois
TAPs preservados e o estado dos arquivos. Não foram repetidos os testes já
aprovados somente por causa da interrupção de infraestrutura.

## Git, limites e recolhimento

Primeira tentativa de commit não executada: revisão automática não conseguiu
carregar configuração global em `config.toml:181:2`. O gestor informou sua
correção e validação. A tentativa seguinte chegou ao Git, detectou whitespace
no TAP, e foi corrigida. Commit local de implementação criado:
`c4c9f978722a8f54363d47d8af9ac4c2e5f03731`.

Não houve push, merge, PR, deploy ou atualização direta no Linear. Não se
atribui evidência de CI ao commit local. A issue deve ficar **In Progress**,
pelas pendências funcionais enumeradas no contrato e no relatório de entrega.
O recibo de recolhimento final pertence ao supervisor; este agente não afirma
que a vaga foi liberada nem que a consolidação externa já foi executada.
