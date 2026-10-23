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
type OpcoesDaSessao = { equipe?: boolean; identidadeEmail?: string };

export function emitirToken(slug: string, operadorId?: string | null, opcoes: OpcoesDaSessao = {}): string {
  const corpo = Buffer.from(
    JSON.stringify({
      slug,
      ...(operadorId ? { op: operadorId } : {}),
      ...(opcoes.equipe ? { equipe: true } : {}),
      ...(opcoes.identidadeEmail ? { identidadeEmail: opcoes.identidadeEmail.trim().toLowerCase() } : {}),
      exp: Date.now() + DIAS * 86_400_000,
    }),
  ).toString("base64url");
  return `${corpo}.${assinar(corpo)}`;
}

export function lerToken(token: string | undefined): { slug: string; op?: string; equipe?: true; identidadeEmail?: string } | null {
  if (!token) return null;
  const [corpo, assinatura] = token.split(".");
  if (!corpo || !assinatura) return null;
  const esperada = assinar(corpo);
  if (esperada.length !== assinatura.length || !timingSafeEqual(Buffer.from(esperada), Buffer.from(assinatura))) return null;
  try {
    const dados = JSON.parse(Buffer.from(corpo, "base64url").toString("utf8")) as { slug: string; op?: string; equipe?: unknown; identidadeEmail?: unknown; exp: number };
    return dados.exp > Date.now()
      ? { slug: dados.slug, ...(dados.op ? { op: dados.op } : {}), ...(dados.equipe === true ? { equipe: true as const } : {}), ...(typeof dados.identidadeEmail === "string" && dados.identidadeEmail.includes("@") ? { identidadeEmail: dados.identidadeEmail } : {}) }
      : null;
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

export async function abrirSessao(slug: string, operadorId?: string | null, opcoes: OpcoesDaSessao = {}) {
  const store = await cookies();
  store.set(COOKIE, emitirToken(slug, operadorId, opcoes), {
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
  return (await sessaoDoPainel())?.tenant ?? null;
}

type OperadorDaSessao = { id: string; nome: string; email: string; papel: string };

/** Mantém a validação da sessão comum e da sessão com permissões idêntica. */
export function resolverSessaoDoPainel(tenant: Tenant | null, operadorId: string | undefined, op: OperadorDaSessao | null) {
  if (!tenant || tenant.status === "CANCELADA") return null;
  if (!operadorId) return { tenant, papel: "DONO" as const, operador: null };
  if (!op) return null;
  return {
    tenant,
    papel: op.papel === "GERENTE" ? "GERENTE" as const : "OPERADOR" as const,
    operador: { id: op.id, nome: op.nome, email: op.email },
  };
}

/**
 * Quem está no painel: a loja, o papel e a pessoa.
 *
 * Sessão antiga (token sem `op`) vale como dono, que é o comportamento que
 * existia quando havia uma senha só. Operador desligado depois de entrar perde
 * o acesso na requisição seguinte, sem esperar o cookie vencer.
 */
export async function sessaoDoPainel(): Promise<
  { tenant: Tenant; papel: "DONO" | "GERENTE" | "OPERADOR"; operador: { id: string; nome: string; email: string } | null; equipe: boolean } | null
> {
  const store = await cookies();
  const dados = lerToken(store.get(COOKIE)?.value);
  if (!dados) return null;

  const tenant = await prisma.tenant.findUnique({ where: { slug: dados.slug } });
  if (dados.identidadeEmail && !dados.equipe) {
    if (!tenant) return null;
    const { possuiLoja } = await import("./acessos-loja");
    if (!(await possuiLoja(dados.identidadeEmail, tenant.id))) return null;
  }
  if (!tenant || !dados.op) {
    const sessao = resolverSessaoDoPainel(tenant, dados.op, null);
    return sessao ? { ...sessao, equipe: dados.equipe === true } : null;
  }

  const op = await prisma.operadorLoja.findFirst({
    where: { id: dados.op, tenantId: tenant.id, ativo: true },
    select: { id: true, nome: true, email: true, papel: true },
  });
  const sessao = resolverSessaoDoPainel(tenant, dados.op, op);
  return sessao ? { ...sessao, equipe: dados.equipe === true } : null;
}
