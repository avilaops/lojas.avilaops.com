import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Cifra os tokens de gateway guardados no banco.
 *
 * O access token do Mercado Pago de cada loja mora no Postgres, porque é por
 * loja e não por instância. Guardar em claro faria de um dump do banco um
 * dump de todas as contas de pagamento dos clientes. AES-256-GCM com a chave
 * em LOJAS_SECRET (só no servidor) — o banco sozinho não abre nada.
 */

function chave(): Buffer {
  const hex = process.env.LOJAS_SECRET ?? "";
  if (!/^[0-9a-f]{64}$/i.test(hex)) {
    throw new Error("LOJAS_SECRET precisa ter 32 bytes em hex (openssl rand -hex 32).");
  }
  return Buffer.from(hex, "hex");
}

export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", chave(), iv);
  const dados = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${dados.toString("base64url")}`;
}

export function decifrar(envelope: string): string {
  const [versao, iv, tag, dados] = envelope.split(".");
  if (versao !== "v1" || !iv || !tag || !dados) throw new Error("Envelope cifrado inválido.");
  const decipher = createDecipheriv("aes-256-gcm", chave(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dados, "base64url")), decipher.final()]).toString("utf8");
}
