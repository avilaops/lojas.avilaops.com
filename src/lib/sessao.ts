import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import type { Tenant } from "@prisma/client";
import { prisma } from "./db";

/**
 * Sessão do lojista no painel (lojas.avilaops.com/painel).
 *
 * Sem biblioteca: senha em scrypt, sessão num token HMAC-SHA256 assinado com
 * LOJAS_SECRET, cookie httpOnly restrito ao domínio-base. O token carrega só o
 * slug; tudo o mais é lido do banco a cada requisição — trocar a senha ou
 * suspender a loja derruba a sessão na hora.
 */
const COOKIE = "lojas_sessao";
const DIAS = 30;

function segredo(): Buffer {
  const hex = process.env.LOJAS_SECRET ?? "";
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error("LOJAS_SECRET ausente.");
  return Buffer.from(hex, "hex");
}

// ── Senha ──────────────────────────────────────────────────────────────

export function gerarHashSenha(senha: string): string {
  const sal = randomBytes(16);
  const hash = scryptSync(senha, sal, 64);
  return `scrypt.${sal.toString("base64url")}.${hash.toString("base64url")}`;
}

export function conferirSenha(senha: string, armazenado: string | null): boolean {
  if (!armazenado) return false;
  const [alg, sal, hash] = armazenado.split(".");
  if (alg !== "scrypt" || !sal || !hash) return false;
  const esperado = Buffer.from(hash, "base64url");
  const calculado = scryptSync(senha, Buffer.from(sal, "base64url"), esperado.length);
  return calculado.length === esperado.length && timingSafeEqual(calculado, esperado);
}

// ── Token ──────────────────────────────────────────────────────────────

function assinar(corpo: string): string {
  return createHmac("sha256", segredo()).update(corpo).digest("base64url");
}

/**
 * `op` é o id de quem entrou, quando não é o dono.
 *
 * Token antigo não tem esse campo, e por isso `lerToken` trata a ausência como
 * "é o dono": mudar o formato não pode deslogar quem já estava no painel.
 */
export function emitirToken(slug: string, operadorId?: string | null): string {
  const corpo = Buffer.from(
    JSON.stringify({ slug, ...(operadorId ? { op: operadorId } : {}), exp: Date.now() + DIAS * 86_400_000 }),
  ).toString("base64url");
  return `${corpo}.${assinar(corpo)}`;
}

export function lerToken(token: string | undefined): { slug: string; op?: string } | null {
  if (!token) return null;
  const [corpo, assinatura] = token.split(".");
  if (!corpo || !assinatura) return null;
  const esperada = assinar(corpo);
  if (esperada.length !== assinatura.length || !timingSafeEqual(Buffer.from(esperada), Buffer.from(assinatura))) return null;
  try {
    const dados = JSON.parse(Buffer.from(corpo, "base64url").toString("utf8")) as { slug: string; op?: string; exp: number };
    return dados.exp > Date.now() ? { slug: dados.slug, op: dados.op } : null;
  } catch {
    return null;
  }
}

// ── Cookie ─────────────────────────────────────────────────────────────


/**
 * `Secure` vem do protocolo real da requisição, não do NODE_ENV: o
 * `server.js` do build standalone força `production` mesmo quando rodamos em
 * HTTP no desenvolvimento, e um cookie Secure em HTTP simplesmente não é
 * guardado — o login "funcionava" e a sessão sumia. Atrás do Caddy chega
 * `x-forwarded-proto: https`.
 */
async function conexaoSegura(): Promise<boolean> {
  const h = await headers();
  return (h.get("x-forwarded-proto") ?? "").split(",")[0].trim() === "https";
}

export async function abrirSessao(slug: string, operadorId?: string | null) {
  const store = await cookies();
  store.set(COOKIE, emitirToken(slug, operadorId), {
    httpOnly: true,
    sameSite: "lax",
    secure: await conexaoSegura(),
    path: "/",
    maxAge: DIAS * 86_400,
  });
}

export async function fecharSessao() {
  const store = await cookies();
  store.delete(COOKIE);
}

/** Loja do lojista logado, ou null. */
export async function lojistaAtual(): Promise<Tenant | null> {
  const store = await cookies();
  const dados = lerToken(store.get(COOKIE)?.value);
  if (!dados) return null;
  const t = await prisma.tenant.findUnique({ where: { slug: dados.slug } });
  return t && t.status !== "CANCELADA" ? t : null;
}

/**
 * Quem está no painel: a loja, o papel e a pessoa.
 *
 * Sessão antiga (token sem `op`) vale como dono, que é o comportamento que
 * existia quando havia uma senha só. Operador desligado depois de entrar perde
 * o acesso na requisição seguinte, sem esperar o cookie vencer.
 */
export async function sessaoDoPainel(): Promise<
  { tenant: Tenant; papel: "DONO" | "GERENTE" | "OPERADOR"; operador: { id: string; nome: string; email: string } | null } | null
> {
  const store = await cookies();
  const dados = lerToken(store.get(COOKIE)?.value);
  if (!dados) return null;

  const tenant = await prisma.tenant.findUnique({ where: { slug: dados.slug } });
  if (!tenant || tenant.status === "CANCELADA") return null;

  if (!dados.op) return { tenant, papel: "DONO", operador: null };

  const op = await prisma.operadorLoja.findFirst({
    where: { id: dados.op, tenantId: tenant.id, ativo: true },
    select: { id: true, nome: true, email: true, papel: true },
  });
  if (!op) return null;

  return {
    tenant,
    papel: op.papel === "GERENTE" ? "GERENTE" : "OPERADOR",
    operador: { id: op.id, nome: op.nome, email: op.email },
  };
}
