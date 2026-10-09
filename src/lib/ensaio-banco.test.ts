import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { EventEmitter } from "node:events";
import { caminhosCitados, compararRetratos, destinoDeEnsaio, EnsaioInterrompido, migracoesPendentes, ordemDoDeploy, portaDeEnsaio, saidaPorSinal, vigiarSinais, type RetratoDoBanco } from "./ensaio-banco";

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

test("portaDeEnsaio recusa a porta do Postgres de verdade e o que não é porta", () => {
  assert.equal(portaDeEnsaio(undefined), "5548");
  assert.equal(portaDeEnsaio(""), "5548");
  assert.equal(portaDeEnsaio(" 5599 "), "5599");
  for (const real of ["5432", " 5432 ", "05432"]) assert.throws(() => portaDeEnsaio(real), /não roda na porta 5432/, real);
  for (const ruim of ["abc", "5548;5432", "-1", "5432/x", "70000", "5"]) assert.throws(() => portaDeEnsaio(ruim), /número de porta/, ruim);
});

test("o script do ensaio lê a porta por portaDeEnsaio e confere os sinais entre os passos", () => {
  const script = ler("scripts/ensaio-banco.mts");
  assert.match(script, /portaDeEnsaio\(process\.env\.TEST_DB_PORT\)/);
  assert.doesNotMatch(script, /process\.env\.TEST_DB_PORT\s*\?\?/);
  assert.match(script, /vigiarSinais\(process\)/);
  assert.ok((script.match(/await sinais\.conferir\(\)/g) ?? []).length >= 6, "uma conferência antes de cada passo");
  // Pelo comando `tsx` o sinal vira SIGKILL no processo do ensaio e nada é limpo.
  assert.equal(JSON.parse(ler("package.json")).scripts["banco:ensaio"], "node --import tsx scripts/ensaio-banco.mts");
});

test("vigiarSinais: o sinal vira EnsaioInterrompido na conferência seguinte, e o primeiro é o que vale", async () => {
  const processo = new EventEmitter();
  const sinais = vigiarSinais(processo);
  await sinais.conferir();
  assert.equal(sinais.sinal, null);

  // Emitido "no meio de um passo": só aparece quando o laço de eventos anda.
  setImmediate(() => processo.emit("SIGTERM"));
  await assert.rejects(sinais.conferir(), (e: unknown) => e instanceof EnsaioInterrompido && e.sinal === "SIGTERM");
  processo.emit("SIGINT");
  await assert.rejects(sinais.conferir(), /interrompido por SIGTERM/);
  assert.equal(sinais.sinal, "SIGTERM");
});

test("saidaPorSinal segue a convenção 128 + sinal", () => {
  assert.equal(saidaPorSinal("SIGINT"), 130);
  assert.equal(saidaPorSinal("SIGTERM"), 143);
  assert.equal(saidaPorSinal("SIGHUP"), 129);
});
