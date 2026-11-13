import { createHash } from "node:crypto";

type Ambiente = Record<string, string | undefined>;
type Area = "uploads" | "fiscal";
const TETO = 12 * 1024 * 1024;

function configuracao(env: Ambiente) {
  const endereco = env.LOJAS_STORAGE_URL;
  const token = env.LOJAS_STORAGE_TOKEN;
  if (!endereco && !token) return null;
  if (!endereco || !token || token.length < 16 || /[\r\n]/.test(token)) throw new Error("Configuração do armazenamento incompleta.");
  let url: URL;
  try { url = new URL(endereco); } catch { throw new Error("Configuração do armazenamento inválida."); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error("Configuração do armazenamento inválida.");
  return { origem: url.origin, token };
}

export function armazenamentoRemotoConfigurado(env: Ambiente = process.env) {
  return configuracao(env) !== null;
}

export function conferirChaveArquivo(chave: string) {
  if (chave.length > 1024 || chave.split("/").some(p => !/^[a-z0-9][a-z0-9._-]*$/i.test(p) || p.includes(".."))) throw new Error("Caminho de arquivo inválido.");
  return chave;
}

async function requisitar(area: Area, chave: string, metodo: "GET" | "PUT" | "DELETE", bytes?: Uint8Array, tipo?: string, env: Ambiente = process.env) {
  conferirChaveArquivo(chave);
  const config = configuracao(env);
  if (!config) throw new Error("Configuração do armazenamento ausente.");
  if (bytes && (!bytes.byteLength || bytes.byteLength > TETO)) throw new Error("Arquivo fora do limite do armazenamento.");
  const resposta = await fetch(`${config.origem}/${area}/${chave}`, {
    method: metodo,
    headers: {
      authorization: `Bearer ${config.token}`,
      ...(bytes ? { "content-type": tipo ?? "application/octet-stream", "x-content-sha256": createHash("sha256").update(bytes).digest("hex") } : {}),
    },
    ...(bytes ? { body: new Uint8Array(bytes) } : {}),
    redirect: "error", cache: "no-store", signal: AbortSignal.timeout(20_000),
  });
  if (resposta.status === 404 && metodo !== "PUT") return null;
  if (!resposta.ok) throw new Error("Armazenamento temporariamente indisponível.");
  return resposta;
}

export async function gravarObjetoRemoto(area: Area, chave: string, bytes: Uint8Array, tipo?: string, env: Ambiente = process.env) {
  await requisitar(area, chave, "PUT", bytes, tipo, env);
}

export async function lerObjetoRemoto(area: Area, chave: string, env: Ambiente = process.env): Promise<Buffer | null> {
  const resposta = await requisitar(area, chave, "GET", undefined, undefined, env);
  if (!resposta) return null;
  if (Number(resposta.headers.get("content-length")) > TETO || !resposta.body) throw new Error("Arquivo remoto fora do limite.");
  const leitor = resposta.body.getReader();
  const partes: Uint8Array[] = [];
  let tamanho = 0;
  try {
    while (true) {
      const { done, value } = await leitor.read();
      if (done) break;
      tamanho += value.byteLength;
      if (tamanho > TETO) { await leitor.cancel(); throw new Error("Arquivo remoto fora do limite."); }
      partes.push(value);
    }
  } finally { leitor.releaseLock(); }
  const corpo = Buffer.concat(partes);
  const digest = resposta.headers.get("x-content-sha256");
  if (digest && createHash("sha256").update(corpo).digest("hex") !== digest) throw new Error("Integridade do arquivo remoto divergente.");
  return corpo;
}

export async function apagarObjetoRemoto(chave: string) {
  return (await requisitar("uploads", chave, "DELETE")) !== null;
}
