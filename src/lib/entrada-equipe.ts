import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "lojas_equipe_intencao";
const PRAZO_MS = 10 * 60 * 1000;

function chave(): Buffer | null {
  const hex = process.env.LOJAS_SECRET ?? "";
  return /^[0-9a-f]{64}$/i.test(hex) ? Buffer.from(hex, "hex") : null;
}

function assinatura(payload: string): string | null {
  const key = chave();
  return key ? createHmac("sha256", key).update(payload).digest("base64url") : null;
}

export async function registrarEntradaEquipe() {
  const token = (await cookies()).get("avila_sso")?.value ?? "";
  const vinculo = createHash("sha256").update(token).digest("base64url");
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + PRAZO_MS, vinculo })).toString("base64url");
  const mac = assinatura(payload);
  if (!mac) throw new Error("LOJAS_SECRET ausente para entrada de equipe");
  (await cookies()).set(COOKIE, payload + "." + mac, {
    httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 600,
  });
}

export async function entradaEquipeFoiIniciada(): Promise<boolean> {
  const store = await cookies();
  const valor = store.get(COOKIE)?.value ?? "";
  const pos = valor.lastIndexOf(".");
  if (pos < 1) return false;
  const payload = valor.slice(0, pos);
  const mac = valor.slice(pos + 1);
  const esperado = assinatura(payload);
  if (!esperado || mac.length !== esperado.length ||
      !timingSafeEqual(Buffer.from(mac), Buffer.from(esperado))) return false;
  try {
    const dados = JSON.parse(Buffer.from(payload, "base64url").toString()) as { exp?: number; vinculo?: string };
    const token = store.get("avila_sso")?.value ?? "";
    return typeof dados.exp === "number" && dados.exp > Date.now() &&
      dados.vinculo === createHash("sha256").update(token).digest("base64url");
  } catch { return false; }
}
