# Contexto verificavel

- Identificador: `avila-lojas-avilaops-com`.
- Origem: raiz deste checkout; nao depende de um caminho absoluto.
- Fontes encontradas: `README.md`, `package.json`, `AGENTS.md`.
- Gerenciador declarado: nao declarado no package.json; conferir lockfile e regras locais.

## Estrutura observada

- `deploy/`
- `docs/`
- `evidencias/`
- `output/`
- `packages/`
- `prisma/`
- `public/`
- `scripts/`
- `src/`
- `tests/`

## Scripts de verificacao declarados

- `lint`: `eslint`
- `typecheck`: `tsc --noEmit`
- `test:auditoria`: `node --test scripts/auditoria/core.test.mjs scripts/auditoria/workflow.test.mjs`
- `test`: `tsx --test src/lib/*.test.ts packages/checkout/src/core/*.test.ts packages/checkout/src/server/*.test.ts packages/checkout/src/providers/*.test.ts`
- `banco:teste`: `node scripts/banco-de-teste.mjs subir`
- `banco:teste:parar`: `node scripts/banco-de-teste.mjs derrubar`
- `test:integracao`: `tsx --test tests/integration/*.test.ts`

Esta lista e um retrato de 15/10/2026, nao uma prova de que os comandos passaram.
Confirme os comandos e seus efeitos antes de executa-los. Alguns testes dependem de servicos externos.
Nao execute deploy, migracao ou envio como parte de uma consulta de status.
