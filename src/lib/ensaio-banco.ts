/**
 * Regras do ensaio de backup, migração e volta ao dump (`npm run banco:ensaio`).
 *
 * Aqui não entra `child_process`, Prisma nem rede: quem fala com o container é
 * `scripts/ensaio-banco.mts`. O que decide se o ensaio passou mora neste
 * arquivo e fica preso em `npm test`. Ver `docs/BACKUP-E-ROLLBACK.md`.
 */

export type DestinoDeEnsaio = { host: string; porta: string; base: string };

/**
 * Só o Postgres descartável: loopback, a porta do `lojas-db-test` e base
 * terminada em `_test`. É a mesma guarda de `tests/integration/catalogo.test.ts`.
 * O ensaio cria e apaga base; em qualquer outro destino ele não começa.
 */
export function destinoDeEnsaio(url: string, porta = "5548"): DestinoDeEnsaio {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error("Destino do ensaio não é um endereço de banco.");
  }
  const base = decodeURIComponent(u.pathname.replace(/^\//, ""));
  if (!["127.0.0.1", "localhost"].includes(u.hostname)) {
    throw new Error(`O ensaio só roda no banco local (127.0.0.1); recebeu o host ${u.hostname}.`);
  }
  if (u.port !== porta) {
    throw new Error(`O ensaio só roda na porta ${porta} do lojas-db-test; recebeu ${u.port || "a porta padrão"}.`);
  }
  if (!base.endsWith("_test")) {
    throw new Error(`O ensaio só roda em base terminada em _test; recebeu ${base || "nenhuma"}.`);
  }
  return { host: u.hostname, porta: u.port, base };
}

/**
 * Migrações que estão no diretório e ainda não em `_prisma_migrations`, na
 * ordem em que o Prisma as aplicaria. O que não começa por dígito
 * (`migration_lock.toml`) não é migração.
 */
export function migracoesPendentes(pastas: string[], aplicadas: string[]): string[] {
  const feitas = new Set(aplicadas);
  return pastas
    .filter((nome) => /^\d/.test(nome) && !feitas.has(nome))
    .sort();
}

/** O que se compara entre o banco antes do dump e o banco restaurado. */
export type RetratoDoBanco = {
  /** Linhas por tabela do schema `public`. */
  tabelas: Record<string, number>;
  /** Nomes em `_prisma_migrations`, concluídas. */
  migracoes: string[];
  funcoes: number;
  gatilhos: number;
  indices: number;
};

export type Divergencia = { nome: string; antes: string; depois: string };

const AUSENTE = "ausente";

/** Lista vazia quer dizer que o banco restaurado é igual ao de antes do dump. */
export function compararRetratos(antes: RetratoDoBanco, depois: RetratoDoBanco): Divergencia[] {
  const divergencias: Divergencia[] = [];

  const tabelas = [...new Set([...Object.keys(antes.tabelas), ...Object.keys(depois.tabelas)])].sort();
  for (const tabela of tabelas) {
    const a = antes.tabelas[tabela];
    const d = depois.tabelas[tabela];
    if (a !== d) {
      divergencias.push({ nome: `tabela ${tabela}`, antes: a === undefined ? AUSENTE : String(a), depois: d === undefined ? AUSENTE : String(d) });
    }
  }

  const migAntes = new Set(antes.migracoes);
  const migDepois = new Set(depois.migracoes);
  for (const nome of [...new Set([...antes.migracoes, ...depois.migracoes])].sort()) {
    if (migAntes.has(nome) !== migDepois.has(nome)) {
      divergencias.push({ nome: `migração ${nome}`, antes: migAntes.has(nome) ? "aplicada" : AUSENTE, depois: migDepois.has(nome) ? "aplicada" : AUSENTE });
    }
  }

  for (const [nome, campo] of [["funções", "funcoes"], ["gatilhos", "gatilhos"], ["índices", "indices"]] as const) {
    if (antes[campo] !== depois[campo]) {
      divergencias.push({ nome, antes: String(antes[campo]), depois: String(depois[campo]) });
    }
  }
  return divergencias;
}

export type OrdemDoDeploy = {
  /** Posição de cada etapa no texto; -1 quando a etapa não existe. */
  migracoes: number;
  extracao: number;
  troca: number;
  /** Verdadeiro quando o comando do `migrate deploy` termina em `|| true`. */
  migracaoEngoleFalha: boolean;
};

/**
 * Lê o texto de `deploy/deploy.sh`. O que importa: a migração vem antes da
 * extração e da troca, e a falha dela não é engolida por `|| true` (regressão
 * de 01/10/2026, descrita no próprio script).
 */
export function ordemDoDeploy(textoDoScript: string): OrdemDoDeploy {
  // Comentário não conta, e linha continuada com `\` é um comando só.
  const comandos = textoDoScript
    .split("\n")
    .filter((linha) => !linha.trim().startsWith("#"))
    .join("\n")
    .replace(/\\\n/g, " ")
    .split("\n");
  const doMigrate = comandos.filter((linha) => /\bmigrate\s+deploy\b/.test(linha));
  return {
    migracoes: textoDoScript.indexOf("==> migrações"),
    extracao: textoDoScript.indexOf("==> extraindo a nova versão"),
    troca: textoDoScript.indexOf("==> trocando a versão no ar"),
    migracaoEngoleFalha: doMigrate.some((linha) => /\|\|\s*true\s*;?\s*$/.test(linha.trim())),
  };
}

/**
 * Caminhos deste repositório citados entre crases num documento. Caminho de
 * servidor (`/opt/...`, `/etc/...`) e de outro repositório não começa por
 * nenhuma destas raízes e fica de fora.
 */
export function caminhosCitados(markdown: string): string[] {
  const RAIZES = ["deploy/", "scripts/", "src/", "docs/", "prisma/", "tests/", ".github/"];
  const SOLTOS = ["docker-compose.test.yml", "package.json"];
  const achados = new Set<string>();
  for (const [, trecho] of markdown.matchAll(/`([^`\n]+)`/g)) {
    // `arquivo.ts:12` aponta para o arquivo; o resto do trecho (argumento, glob) não é caminho.
    const caminho = trecho.trim().split(/\s/)[0].replace(/:\d+(-\d+)?$/, "");
    if (caminho.includes("*") || caminho.includes("<")) continue;
    if (SOLTOS.includes(caminho) || RAIZES.some((r) => caminho.startsWith(r))) achados.add(caminho);
  }
  return [...achados].sort();
}
