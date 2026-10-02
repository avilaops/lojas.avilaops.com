// Sobe o Postgres descartável das provas de banco e aplica as migrações nele.
//
// Existe para não depender de `cross-env` nem de sintaxe de shell: o mesmo
// comando funciona no Git Bash e no PowerShell. O compose fica em
// `docker-compose.test.yml` e é ele quem define porta, imagem e tmpfs.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const COMPOSE = ["compose", "-f", "docker-compose.test.yml"];
// O CLI do Prisma é chamado pelo arquivo, e não por `npx`: no Windows o
// executável é `npx.cmd` e um spawn sem shell não o encontra (ENOENT).
const PRISMA = createRequire(import.meta.url).resolve("prisma/build/index.js");
const PORTA = process.env.TEST_DB_PORT ?? "5548";
// As bases que os scripts de QA exigem por nome. A primeira é o padrão da
// suíte; a segunda é a do seed do template premium.
const BASES = ["lojas_test", "lojas_template_premium_test"];

function rodar(cmd, args, env) {
  const r = spawnSync(cmd, args, { stdio: "inherit", env: { ...process.env, ...env }, shell: false });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} saiu com ${r.status}`);
}

const acao = process.argv[2] ?? "subir";

if (acao === "derrubar") {
  // `-v` apaga os dados: o container é descartável por definição.
  rodar("docker", [...COMPOSE, "down", "-v"]);
  process.exit(0);
}

if (acao !== "subir") throw new Error(`Ação desconhecida: ${acao}. Use "subir" ou "derrubar".`);

// `--wait` devolve o controle só quando o healthcheck passa; sem isso a
// migração bate num Postgres que ainda está inicializando e falha por conexão.
rodar("docker", [...COMPOSE, "up", "-d", "--wait"]);

for (const base of BASES) {
  const url = `postgresql://postgres:postgres@127.0.0.1:${PORTA}/${base}`;
  console.log(`\n== migrando ${base}`);
  rodar(process.execPath, [PRISMA, "migrate", "deploy"], { DATABASE_URL: url });
}

console.log(`\nPronto. Use:\n  DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:${PORTA}/lojas_test`);
