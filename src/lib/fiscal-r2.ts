import { createHash } from "node:crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

// Arquivo fiscal privado, sem URLs públicas nem acesso direto pelo navegador.
// O banco PostgreSQL continua sendo o índice e a origem autorizadora.
const BUCKET_PADRAO = "avilaops-fiscal-acervo";
type Ambiente = Record<string, string | undefined>;

function configuracao(env: Ambiente) {
  const id = env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = env.FISCAL_R2_ACCESS_KEY_ID;
  const secretAccessKey = env.FISCAL_R2_SECRET_ACCESS_KEY;
  const bucket = env.FISCAL_R2_BUCKET ?? BUCKET_PADRAO;
  if (!id || !/^[a-f0-9]{32}$/.test(id) || !accessKeyId || !secretAccessKey || !/^[a-z0-9-]{3,64}$/.test(bucket)) return null;
  return {
    bucket,
    cliente: new S3Client({ region: "auto", endpoint: `https://${id}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey }, maxAttempts: 3 }),
  };
}

export function arquivoFiscalChave(cnpj: string, chave: string, formato: "xml" | "pdf") {
  if (!/^\d{14}$/.test(cnpj) || !/^\d{44}$/.test(chave)) throw new Error("Identificação fiscal inválida.");
  return `v1/${cnpj}/nfe/${chave.slice(0, 2)}/${chave}.${formato}`;
}

export function arquivoFiscalR2Configurado(env: Ambiente = process.env): boolean {
  return !!configuracao(env);
}

export async function guardarArquivoFiscal(
  cnpj: string, chave: string, formato: "xml" | "pdf", bytes: Uint8Array,
  env: Ambiente = process.env,
): Promise<boolean> {
  const config = configuracao(env);
  if (!config) return false;
  if (!bytes.byteLength || bytes.byteLength > 12 * 1024 * 1024) throw new Error("Arquivo fiscal fora do limite.");
  const key = arquivoFiscalChave(cnpj, chave, formato);
  await config.cliente.send(new PutObjectCommand({
    Bucket: config.bucket, Key: key, Body: bytes,
    ContentType: formato === "xml" ? "application/xml" : "application/pdf",
    Metadata: { sha256: createHash("sha256").update(bytes).digest("hex") },
  }));
  return true;
}

export async function lerArquivoFiscal(
  cnpj: string, chave: string, formato: "xml" | "pdf", env: Ambiente = process.env,
): Promise<Uint8Array | null> {
  const config = configuracao(env);
  if (!config) return null;
  try {
    const result = await config.cliente.send(new GetObjectCommand({
      Bucket: config.bucket, Key: arquivoFiscalChave(cnpj, chave, formato),
    }));
    if (!result.Body) return null;
    const bytes = await result.Body.transformToByteArray();
    if (bytes.byteLength > 12 * 1024 * 1024) throw new Error("Arquivo fiscal acima do limite.");
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (result.Metadata?.sha256 && result.Metadata.sha256 !== digest) throw new Error("Integridade fiscal divergente.");
    return bytes;
  } catch (error) {
    if (error && typeof error === "object" &&
      ("name" in error && (error.name === "NoSuchKey" || error.name === "NotFound"))) return null;
    throw error;
  }
}
