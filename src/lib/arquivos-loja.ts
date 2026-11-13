import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { UPLOADS_DIR } from "./uploads-arquivos";
import { apagarObjetoRemoto, armazenamentoRemotoConfigurado, conferirChaveArquivo, gravarObjetoRemoto, lerObjetoRemoto } from "./armazenamento-remoto";

function ausente(): NodeJS.ErrnoException { return Object.assign(new Error("Arquivo não encontrado."), { code: "ENOENT" }); }

export async function gravarArquivoLoja(chave: string, bytes: Uint8Array) {
  conferirChaveArquivo(chave);
  if (armazenamentoRemotoConfigurado()) return gravarObjetoRemoto("uploads", chave, bytes);
  const destino = path.join(UPLOADS_DIR, chave);
  await mkdir(path.dirname(destino), { recursive: true });
  await writeFile(destino, bytes);
}

export async function lerArquivoLoja(chave: string): Promise<Buffer> {
  conferirChaveArquivo(chave);
  if (!armazenamentoRemotoConfigurado()) return readFile(path.join(UPLOADS_DIR, chave));
  const bytes = await lerObjetoRemoto("uploads", chave);
  if (!bytes) throw ausente();
  return bytes;
}

export async function apagarArquivoLoja(chave: string) {
  conferirChaveArquivo(chave);
  if (!armazenamentoRemotoConfigurado()) return unlink(path.join(UPLOADS_DIR, chave));
  if (!await apagarObjetoRemoto(chave)) throw ausente();
}
