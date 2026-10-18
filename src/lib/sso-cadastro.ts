import { createHmac, timingSafeEqual } from "node:crypto";
import type { Tenant } from "@prisma/client";
import { criarConta } from "./cadastro";
import { identificarPorEmail } from "./operadores";
import type { RespostaSSO } from "./sso";

/**
 * Criar loja a partir do login único (Google, Microsoft, Facebook, GitHub no Auth).
 *
 * A pessoa já provou quem é no Auth; aqui só falta ela dizer "sim, quero uma
 * loja com este e-mail". O sim é um formulário, e o formulário leva um selo:
 * HMAC do e-mail com prazo curto, assinado com `LOJAS_SECRET`. O POST confere
 * o selo, a origem e, de novo, a sessão no Auth — o e-mail usado é sempre o
 * que o Auth devolve agora, nunca o que veio no formulário.
 */

const VALIDADE_MS = 15 * 60_000;

function segredo(): Buffer {
  const hex = process.env.LOJAS_SECRET ?? "";
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error("LOJAS_SECRET ausente.");
  return Buffer.from(hex, "hex");
}

function assinar(corpo: string): string {
  return createHmac("sha256", segredo()).update(`criar-sso:${corpo}`).digest("base64url");
}

export function emitirSelo(email: string, agora = Date.now()): string {
  const corpo = Buffer.from(JSON.stringify({ e: email.trim().toLowerCase(), x: agora + VALIDADE_MS })).toString("base64url");
  return `${corpo}.${assinar(corpo)}`;
}

export function seloConfere(selo: string | null | undefined, email: string, agora = Date.now()): boolean {
  if (!selo) return false;
  const [corpo, assinatura] = selo.split(".");
  if (!corpo || !assinatura) return false;
  const esperada = assinar(corpo);
  if (esperada.length !== assinatura.length || !timingSafeEqual(Buffer.from(esperada), Buffer.from(assinatura))) return false;
  try {
    const d = JSON.parse(Buffer.from(corpo, "base64url").toString("utf8")) as { e?: unknown; x?: unknown };
    return d.e === email.trim().toLowerCase() && typeof d.x === "number" && d.x > agora;
  } catch {
    return false;
  }
}

/** O POST veio de uma página nossa? `Origin` é o que o navegador não deixa forjar. */
export function origemConfere(origem: string | null, hostBase: string): boolean {
  if (!origem) return false;
  try {
    const u = new URL(origem);
    return u.protocol === "https:" ? u.host.toLowerCase() === hostBase : u.host.toLowerCase() === hostBase && process.env.NODE_ENV !== "production";
  } catch {
    return false;
  }
}

export type ResultadoCriacao =
  | { tipo: "criada"; tenant: Tenant }
  | { tipo: "existente"; slug: string; operadorId: string | null }
  | { tipo: "recusado"; recado: "sem-sessao" | "sem-email" | "sem-acesso" | "indisponivel" | "selo" };

/**
 * Cria a loja de quem confirmou, ou devolve a que já existe com este e-mail
 * (dois cliques, ou a pessoa virou dona por outro caminho no meio do tempo).
 */
export async function criarLojaPeloSSO(r: RespostaSSO, selo: string | null): Promise<ResultadoCriacao> {
  if (r.tipo === "sem_sessao") return { tipo: "recusado", recado: "sem-sessao" };
  if (r.tipo === "sem_email") return { tipo: "recusado", recado: "sem-email" };
  if (r.tipo === "sem_acesso") return { tipo: "recusado", recado: "sem-acesso" };
  if (r.tipo === "indisponivel") return { tipo: "recusado", recado: "indisponivel" };
  if (!seloConfere(selo, r.email)) return { tipo: "recusado", recado: "selo" };

  const ja = await identificarPorEmail(r.email);
  if (ja) return { tipo: "existente", slug: ja.tenant.slug, operadorId: ja.operador?.id ?? null };

  const tenant = await criarConta({ email: r.email, senha: null });
  if (tenant) return { tipo: "criada", tenant };
  const corrida = await identificarPorEmail(r.email);
  if (corrida) return { tipo: "existente", slug: corrida.tenant.slug, operadorId: corrida.operador?.id ?? null };
  return { tipo: "recusado", recado: "indisponivel" };
}
