import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { caminhosCitados, compararRetratos, destinoDeEnsaio, migracoesPendentes, ordemDoDeploy, type RetratoDoBanco } from "./ensaio-banco";

const RAIZ = new URL("../../", import.meta.url);
const ler = (caminho: string) => readFileSync(new URL(caminho, RAIZ), "utf8");

const retrato = (mudancas: Partial<RetratoDoBanco> = {}): RetratoDoBanco => ({
  tabelas: { Tenant: 2, Produto: 0, _prisma_migrations: 3 },
  migracoes: ["20260101000000_a", "20260102000000_b", "20260103000000_c"],
  funcoes: 4,
  gatilhos: 2,
  indices: 30,
  ...mudancas,
});

test("destinoDeEnsaio aceita só o Postgres descartável", () => {
  assert.deepEqual(destinoDeEnsaio("postgresql://postgres:postgres@127.0.0.1:5548/lojas_ensaio_1_test"), {
    host: "127.0.0.1",
    porta: "5548",
    base: "lojas_ensaio_1_test",
  });
  assert.equal(destinoDeEnsaio("postgresql://postgres:postgres@localhost:5599/lojas_ensaio_1_test", "5599").porta, "5599");
});

test("destinoDeEnsaio recusa host externo, outra porta e base que não é de teste", () => {
  assert.throws(() => destinoDeEnsaio("postgresql://postgres:postgres@10.0.0.5:5548/lojas_ensaio_1_test"), /só roda no banco local/);
  assert.throws(() => destinoDeEnsaio("postgresql://postgres:postgres@127.0.0.1:5432/lojas_ensaio_1_test"), /porta 5548/);
  assert.throws(() => destinoDeEnsaio("postgresql://postgres:postgres@127.0.0.1/lojas_ensaio_1_test"), /porta padrão/);
  assert.throws(() => destinoDeEnsaio("postgresql://postgres:postgres@127.0.0.1:5548/lojas"), /terminada em _test/);
  assert.throws(() => destinoDeEnsaio("postgresql://postgres:postgres@127.0.0.1:5548/lojas_dev"), /terminada em _test/);
  assert.throws(() => destinoDeEnsaio("nada"), /não é um endereço/);
});

test("migracoesPendentes devolve o que falta aplicar, em ordem", () => {
  const pastas = ["20260102000000_b", "migration_lock.toml", "20260101000000_a", "20260103000000_c"];
  assert.deepEqual(migracoesPendentes(pastas, ["20260101000000_a", "20260102000000_b", "20260103000000_c"]), []);
  assert.deepEqual(migracoesPendentes(pastas, ["20260101000000_a", "20260102000000_b"]), ["20260103000000_c"]);
  assert.deepEqual(migracoesPendentes(pastas, []), ["20260101000000_a", "20260102000000_b", "20260103000000_c"]);
});

test("compararRetratos: retratos iguais não divergem", () => {
  assert.deepEqual(compararRetratos(retrato(), retrato()), []);
});

test("compararRetratos aponta contagem diferente e tabela que sumiu", () => {
  assert.deepEqual(compararRetratos(retrato(), retrato({ tabelas: { Tenant: 1, Produto: 0, _prisma_migrations: 3 } })), [
    { nome: "tabela Tenant", antes: "2", depois: "1" },
  ]);
  assert.deepEqual(compararRetratos(retrato(), retrato({ tabelas: { Tenant: 2, _prisma_migrations: 3 } })), [
    { nome: "tabela Produto", antes: "0", depois: "ausente" },
  ]);
});

test("compararRetratos aponta migração a menos e gatilho a menos", () => {
  assert.deepEqual(compararRetratos(retrato(), retrato({ migracoes: ["20260101000000_a", "20260102000000_b"] })), [
    { nome: "migração 20260103000000_c", antes: "aplicada", depois: "ausente" },
  ]);
  assert.deepEqual(compararRetratos(retrato(), retrato({ gatilhos: 1 })), [{ nome: "gatilhos", antes: "2", depois: "1" }]);
});

test("ordemDoDeploy enxerga o `|| true` no comando da migração, e só nele", () => {
  const ruim = ['echo "==> migrações"', "npx prisma migrate deploy \\", '  --schema x | grep -E "applied" || true', 'echo "==> extraindo a nova versão"'].join("\n");
  assert.equal(ordemDoDeploy(ruim).migracaoEngoleFalha, true);
  const bom = ["# antes: npx prisma migrate deploy || true", "if ! npx prisma migrate deploy > log 2>&1; then exit 1; fi", "grep applied log || true"].join("\n");
  assert.equal(ordemDoDeploy(bom).migracaoEngoleFalha, false);
  assert.equal(ordemDoDeploy(bom).troca, -1);
});

// Os dois testes abaixo leem arquivo do repositório. O `npm test` roda dentro
// do `Dockerfile` depois de `COPY . .`: se alguém puser `deploy/` ou `docs/` no
// `.dockerignore`, o build da imagem cai aqui, e é para cair.

test("deploy/deploy.sh migra antes de extrair e de trocar, e não engole falha da migração", () => {
  const ordem = ordemDoDeploy(ler("deploy/deploy.sh"));
  assert.ok(ordem.migracoes >= 0, "etapa de migrações não encontrada");
  assert.ok(ordem.extracao > ordem.migracoes, "a extração tem de vir depois da migração");
  assert.ok(ordem.troca > ordem.extracao, "a troca tem de vir depois da extração");
  assert.equal(ordem.migracaoEngoleFalha, false);
});

test("docs/BACKUP-E-ROLLBACK.md só cita caminho que existe no repositório", () => {
  const citados = caminhosCitados(ler("docs/BACKUP-E-ROLLBACK.md"));
  assert.ok(citados.includes("scripts/ensaio-banco.mts"), "o documento precisa apontar o script do ensaio");
  const faltando = citados.filter((caminho) => !existsSync(fileURLToPath(new URL(caminho, RAIZ))));
  assert.deepEqual(faltando, []);
});

test("caminhosCitados ignora servidor, outro repositório, glob e marcador", () => {
  const texto = "`/opt/backups/db`, `scripts/deploy-container.sh` no `infra`, `src/lib/*.test.ts`, `docs/ROTINAS.md`, `tests/integration/catalogo.test.ts:12`, `host-lojas-<data>.sql.gz` e `npm run banco:ensaio`.";
  assert.deepEqual(caminhosCitados(texto), ["docs/ROTINAS.md", "scripts/deploy-container.sh", "tests/integration/catalogo.test.ts"]);
});
