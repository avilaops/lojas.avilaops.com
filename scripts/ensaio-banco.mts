/**
 * Ensaia, no Postgres descartável, o ciclo que protege o banco num deploy:
 * dump antes da migração, migração, volta ao dump e migração de novo.
 *
 *   npm run banco:teste     # sobe o lojas-db-test
 *   npm run banco:ensaio    # sai com 0 e termina numa linha JSON
 *
 * A regra do que é "igual" e do que é destino permitido mora em
 * `src/lib/ensaio-banco.ts`, presa em `npm test`; aqui fica só o que precisa
 * de Docker e do CLI do Prisma. Nunca lê `DATABASE_URL`: o destino é montado
 * aqui e passa por `destinoDeEnsaio` antes de qualquer comando.
 *
 * Roteiro e leitura da saída: `docs/BACKUP-E-ROLLBACK.md`.
 */
import { spawnSync } from "node:child_process";
import { closeSync, cpSync, mkdtempSync, openSync, readdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { compararRetratos, destinoDeEnsaio, migracoesPendentes, type RetratoDoBanco } from "../src/lib/ensaio-banco";

const CONTAINER = "lojas-db-test";
const PORTA = process.env.TEST_DB_PORT ?? "5548";
// Pelo arquivo, e não por `npx`: mesmo motivo de `scripts/banco-de-teste.mjs`.
const PRISMA = createRequire(import.meta.url).resolve("prisma/build/index.js");
const PRISMA_REAL = resolve("prisma");

const carimbo = Date.now();
const BASE = `lojas_ensaio_${carimbo}_test`;
const BASE_VOLTA = `lojas_ensaio_${carimbo}_volta_test`;

class EnsaioFalhou extends Error {}

/** Devolve o endereço da base, ou lança se ela não for do banco descartável. */
function endereco(base: string): string {
  const url = `postgresql://postgres:postgres@127.0.0.1:${PORTA}/${base}`;
  destinoDeEnsaio(url, PORTA);
  return url;
}

function psql(sql: string, base: string): string {
  if (base !== "postgres") endereco(base);
  const r = spawnSync("docker", ["exec", "-i", CONTAINER, "psql", "-U", "postgres", "-d", base, "-v", "ON_ERROR_STOP=1", "-At"], {
    input: sql,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new EnsaioFalhou(r.stderr || r.stdout);
  return r.stdout.trim();
}

/** Roda o CLI do Prisma contra uma base do ensaio e devolve o código de saída. */
function prisma(args: string[], base: string, schema: string): number {
  const r = spawnSync(process.execPath, [PRISMA, ...args, "--schema", schema], {
    stdio: ["ignore", "ignore", "inherit"],
    env: { ...process.env, DATABASE_URL: endereco(base) },
  });
  if (r.error) throw r.error;
  return r.status ?? 1;
}

function migrar(base: string, schema: string) {
  if (prisma(["migrate", "deploy"], base, schema) !== 0) throw new EnsaioFalhou(`migrate deploy falhou em ${base}`);
}

function retratar(base: string): RetratoDoBanco {
  const nomes = psql(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1;`, base).split("\n").filter(Boolean);
  // Base vazia (restauração que não restaurou nada) também é retrato: vira divergência, não erro de SQL.
  const contagens = nomes.length === 0 ? "" : psql(nomes.map((n) => `SELECT '${n}' || '|' || count(*) FROM "${n}"`).join(" UNION ALL ") + ";", base);
  const tabelas: Record<string, number> = {};
  for (const linha of contagens.split("\n").filter(Boolean)) {
    const corte = linha.lastIndexOf("|");
    tabelas[linha.slice(0, corte)] = Number(linha.slice(corte + 1));
  }
  const contar = (sql: string) => Number(psql(sql, base));
  return {
    tabelas,
    migracoes: nomes.includes("_prisma_migrations") ? aplicadas(base) : [],
    funcoes: contar(`SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public';`),
    gatilhos: contar(`SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND NOT t.tgisinternal;`),
    indices: contar(`SELECT count(*) FROM pg_indexes WHERE schemaname = 'public';`),
  };
}

function criarBase(base: string) {
  endereco(base);
  psql(`CREATE DATABASE "${base}";`, "postgres");
}

function aplicadas(base: string): string[] {
  return psql(`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY 1;`, base)
    .split("\n")
    .filter(Boolean);
}

function exigirVazio(o: string, lista: string[]) {
  if (lista.length > 0) throw new EnsaioFalhou(`${o}: ${lista.join(", ")}`);
}

const noAr = spawnSync("docker", ["inspect", "-f", "{{.State.Running}}", CONTAINER], { encoding: "utf8" });
if (noAr.status !== 0 || noAr.stdout.trim() !== "true") {
  console.error(`O container ${CONTAINER} não está no ar. Rode \`npm run banco:teste\` e tente de novo.`);
  process.exit(1);
}

const pastas = readdirSync(join(PRISMA_REAL, "migrations"));
const migracoes = migracoesPendentes(pastas, []);
const ultima = migracoes.at(-1);
if (!ultima || migracoes.length < 2) {
  console.error("O ensaio precisa de pelo menos duas migrações em prisma/migrations.");
  process.exit(1);
}

const temporario = mkdtempSync(join(tmpdir(), "lojas-ensaio-"));
const schemaAntes = join(temporario, "prisma", "schema.prisma");
const schemaReal = join(PRISMA_REAL, "schema.prisma");
const dump = join(temporario, "antes-da-migracao.sql");
let saida = 1;

try {
  // 1. O banco "antes do deploy": todas as migrações menos a última.
  cpSync(schemaReal, schemaAntes);
  cpSync(join(PRISMA_REAL, "migrations"), join(temporario, "prisma", "migrations"), { recursive: true });
  rmSync(join(temporario, "prisma", "migrations", ultima), { recursive: true });
  criarBase(BASE);
  migrar(BASE, schemaAntes);

  // 2. Dado de verdade para o dump carregar, e o retrato que a volta tem de reproduzir.
  psql(
    `INSERT INTO "Tenant" (id, slug, nome, "atualizadoEm") VALUES ('ensaio-1', 'ensaio-1', 'Ensaio 1', now()), ('ensaio-2', 'ensaio-2', 'Ensaio 2', now());`,
    BASE,
  );
  const antes = retratar(BASE);

  // 3. O dump "antes da migração", em SQL puro como o de produção. O `pg_dump`
  //    é o do container: mesma versão maior do servidor de banco.
  const saidaDoDump = openSync(dump, "w");
  try {
    const d = spawnSync("docker", ["exec", CONTAINER, "pg_dump", "-U", "postgres", "-d", BASE], { stdio: ["ignore", saidaDoDump, "pipe"], encoding: "utf8" });
    if (d.error) throw d.error;
    if (d.status !== 0) throw new EnsaioFalhou(`pg_dump falhou: ${d.stderr}`);
  } finally {
    closeSync(saidaDoDump);
  }

  // 4. O "deploy": a última migração entra.
  migrar(BASE, schemaReal);
  exigirVazio("migração pendente depois do deploy", migracoesPendentes(pastas, aplicadas(BASE)));

  // 5. A "volta ao dump", num banco novo: nunca por cima do que está no ar.
  criarBase(BASE_VOLTA);
  const entradaDoDump = openSync(dump, "r");
  try {
    const r = spawnSync("docker", ["exec", "-i", CONTAINER, "psql", "-U", "postgres", "-d", BASE_VOLTA, "-v", "ON_ERROR_STOP=1", "-q"], {
      stdio: [entradaDoDump, "ignore", "pipe"],
      encoding: "utf8",
    });
    if (r.error) throw r.error;
    if (r.status !== 0) throw new EnsaioFalhou(`restauração falhou: ${r.stderr}`);
  } finally {
    closeSync(entradaDoDump);
  }
  const divergencias = compararRetratos(antes, retratar(BASE_VOLTA));
  if (divergencias.length > 0) {
    console.error("O banco restaurado não é igual ao de antes do dump:");
    for (const d of divergencias) console.error(`  · ${d.nome}: antes ${d.antes}, depois ${d.depois}`);
    throw new EnsaioFalhou(`${divergencias.length} divergência(s)`);
  }
  const pendentes = migracoesPendentes(pastas, aplicadas(BASE_VOLTA));
  if (pendentes.length !== 1 || pendentes[0] !== ultima) {
    throw new EnsaioFalhou(`o banco restaurado devia ter só ${ultima} pendente; tem: ${pendentes.join(", ") || "nenhuma"}`);
  }

  // 6. O "deploy de novo", sobre o banco restaurado.
  migrar(BASE_VOLTA, schemaReal);
  exigirVazio("migração pendente depois de migrar o banco restaurado", migracoesPendentes(pastas, aplicadas(BASE_VOLTA)));
  if (prisma(["migrate", "status"], BASE_VOLTA, schemaReal) !== 0) throw new EnsaioFalhou("prisma migrate status não saiu com 0 no banco restaurado");

  console.log(
    JSON.stringify({
      migracoes: migracoes.length,
      ultima,
      tabelas: Object.keys(antes.tabelas).length,
      divergencias: 0,
      resultado: "dump, migração, volta ao dump e migração de novo conferidos",
    }),
  );
  saida = 0;
} catch (e) {
  console.error(e instanceof EnsaioFalhou ? `Ensaio falhou: ${e.message}` : e);
} finally {
  // 7. Limpa também quando um passo falha.
  for (const base of [BASE, BASE_VOLTA]) {
    try {
      endereco(base);
      psql(`DROP DATABASE IF EXISTS "${base}" WITH (FORCE);`, "postgres");
    } catch (e) {
      console.error(`Não foi possível apagar ${base}: ${e instanceof Error ? e.message : String(e)}`);
      saida = 1;
    }
  }
  rmSync(temporario, { recursive: true, force: true });
}
process.exit(saida);
