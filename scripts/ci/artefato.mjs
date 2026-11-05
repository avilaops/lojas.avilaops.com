import { createHash } from "node:crypto";
import { constants, createReadStream, createWriteStream } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const payload = "payload.tar.zst";

export function contexto(env = process.env) {
  const { GITHUB_SHA: sha, GITHUB_RUN_ID: runId, GITHUB_RUN_ATTEMPT: attempt } = env;
  if (!/^[a-f0-9]{40}$/.test(sha ?? "") || !/^\d+$/.test(runId ?? "") || !/^\d+$/.test(attempt ?? "")) {
    throw new Error("INVALID_CI_CONTEXT");
  }
  return { sha, runId, attempt, platform: process.platform, arch: process.arch, nodeMajor: process.versions.node.split(".")[0] };
}

async function digest(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

export async function registrar(directory, kind, env = process.env) {
  if (typeof kind !== "string" || !/^[a-z-]+$/.test(kind)) throw new Error("INVALID_ARTIFACT_KIND");
  const manifest = { schemaVersion: 1, kind, ...contexto(env), sha256: await digest(path.join(directory, payload)) };
  await writeFile(path.join(directory, "manifest.json"), JSON.stringify(manifest));
  return manifest;
}

export async function verificar(directory, kind, env = process.env) {
  if (typeof kind !== "string" || !/^[a-z-]+$/.test(kind)) throw new Error("INVALID_ARTIFACT_KIND");
  const expected = contexto(env);
  const manifest = JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8"));
  if (manifest.schemaVersion !== 1 || manifest.kind !== kind
    || Object.entries(expected).some(([key, value]) => manifest[key] !== value)) {
    throw new Error("FOREIGN_CI_ARTIFACT");
  }
  if (!/^[a-f0-9]{64}$/.test(manifest.sha256 ?? "")
    || manifest.sha256 !== await digest(path.join(directory, payload))) throw new Error("CORRUPT_CI_ARTIFACT");
  return manifest;
}

/** Quatro partes imutáveis, verificadas como um arquivo antes de extrair. */
export async function reunir(root, kind, env = process.env) {
  if (typeof kind !== "string" || !/^[a-z-]+$/.test(kind)) throw new Error("INVALID_ARTIFACT_KIND");
  const { sha } = contexto(env);
  const directory = path.join(root, `lojas-${kind}-${sha}`);
  await mkdir(directory, { recursive: true });
  const partDirectory = index => path.join(root, `lojas-${kind}-${index}-${sha}`);
  async function* chunks() {
    for (const index of ["00", "01", "02", "03"]) {
      yield* createReadStream(path.join(partDirectory(index), `part-${index}`));
    }
  }
  await pipeline(Readable.from(chunks()), createWriteStream(path.join(directory, payload), { flags: "wx" }));
  await copyFile(path.join(partDirectory("00"), "manifest.json"), path.join(directory, "manifest.json"), constants.COPYFILE_EXCL);
  return verificar(directory, kind, env);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [command, directory, kind] = process.argv.slice(2);
  const commands = { registrar, verificar, reunir };
  if (!directory || !kind || !Object.hasOwn(commands, command)) throw new Error("INVALID_ARTIFACT_ARGUMENTS");
  const result = await commands[command](directory, kind);
  console.log(JSON.stringify(result));
}
