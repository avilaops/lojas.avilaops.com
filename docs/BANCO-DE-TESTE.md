# Banco de teste

As provas de banco deste projeto rodam num Postgres **descartável em Docker**,
nunca no banco de desenvolvimento: a suíte cria e apaga tenant, produto,
variante e reserva de estoque, e `lojas_dev` é compartilhado com outras sessões.

```
npm run banco:teste          # sobe, espera saudável e aplica as migrações
npm run test:integracao      # roda tests/integration/
npm run banco:teste:parar    # derruba e apaga os dados
```

O `DATABASE_URL` da suíte é
`postgresql://postgres:postgres@127.0.0.1:5548/lojas_test`.

## Por que 18-alpine

Produção roda o **Postgres nativo do host**, não um container: o
`lojas-avilaops` sobe com `network_mode: bridge` e fala com `172.17.0.1:5432`
(ver `/opt/lojas/docker-compose.yml` no servidor `applications`). Esse cluster é
**18.6** nos três servidores. O container de teste era `postgres:16` — teste em
16 não prova release em 18, e o gatilho de busca e as projeções do catálogo são
PL/pgSQL, exatamente o que muda entre versões maiores.

## Convenção da máquina

Vale para todo projeto do guarda-chuva, e é a mesma dos servidores
(`/opt/app-avilaops/docker-compose.test.yml` é o original):

- **Um container por projeto**, nunca um banco compartilhado: o compartilhado é
  recriado por outra sessão no meio da sua suíte.
- Nome `<projeto>-db-test`. Aqui: `lojas-db-test`.
- Arquivo `docker-compose.test.yml`, separado do compose de execução.
- Imagem **igual à de produção daquele projeto**.
- `tmpfs` em `/var/lib/postgresql` — e não em `.../data`, que a imagem 18
  recusa. Sem volume para esquecer de limpar; a suíte começa do zero.
- Porta fixa e própria, por `${TEST_DB_PORT:-…}`. Esta máquina já tem
  5432 (nativo), 5436, 5445, 5548 (lojas), 5549 (brilhax) e 55433
  (app.avilaops.com) ocupadas. Teste que não sobe por conflito de porta vira
  teste que ninguém roda.
- `healthcheck` + `up -d --wait`: migrar contra um Postgres ainda inicializando
  falha por conexão, e a mensagem não diz o motivo.
- **Guarda no código, não só no README.** Os scripts de QA conferem host, porta
  e sufixo `_test` do `DATABASE_URL` e recusam qualquer outro destino
  (`tests/integration/catalogo.test.ts`, `scripts/qa-catalogo.ts`,
  `scripts/premium-seed-local.ts`).

## Bases

| Base | Quem usa |
|---|---|
| `lojas_test` | `tests/integration/`, `scripts/qa-catalogo.ts` |
| `lojas_template_premium_test` | `scripts/premium-seed-local.ts` (exige o nome exato) |
| `lojas_migracao_<ts>_test` | `scripts/conferir-migracao-catalogo.ts`, criada por ele em tempo de execução |

As duas primeiras nascem com o container (`scripts/init-banco-de-teste.sql`).

## `npm test` não inclui a integração

`npm test` roda só o que não precisa de banco. A integração é
`npm run test:integracao` e exige o container no ar — de propósito, para não
falhar em ambiente sem Docker. Em troca, **ela precisa ser rodada à mão antes de
entregar mudança no catálogo**: foi por ela nunca ter rodado que a regressão da
busca de 17/09/2026 passou em branco (ver `docs/BUSCA-REGRESSAO.md`).
