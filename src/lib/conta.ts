import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import type { Comprador, Tenant } from "@prisma/client";
import { prisma } from "./db";
import { conferirSenha, gerarHashSenha } from "./sessao";

/**
 * Conta do COMPRADOR na loja (não confundir com a sessão do lojista, em
 * sessao.ts). Mesma mecânica — scrypt para a senha, token HMAC assinado com
 * LOJAS_SECRET — mas com duas diferenças que importam:
 *
 *   1. o token carrega o slug da loja, e a sessão só vale naquele host: quem
 *      entra na loja A não vira cliente logado na loja B;
 *   2. o cookie é `loja_conta`, separado do `lojas_sessao` do painel, então
 *      o lojista pode estar logado nos dois papéis sem um derrubar o outro.
 */
const COOKIE = "loja_conta";
const DIAS = 60;

function segredo(): Buffer {
  const hex = process.env.LOJAS_SECRET ?? "";
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error("LOJAS_SECRET ausente.");
  return Buffer.from(hex, "hex");
}

function assinar(corpo: string): string {
  return createHmac("sha256", segredo()).update(`conta:${corpo}`).digest("base64url");
}

function emitirToken(compradorId: string, slug: string): string {
  const corpo = Buffer.from(JSON.stringify({ id: compradorId, slug, exp: Date.now() + DIAS * 86_400_000 })).toString("base64url");
  return `${corpo}.${assinar(corpo)}`;
}

function lerToken(token: string | undefined): { id: string; slug: string } | null {
  if (!token) return null;
  const [corpo, assinatura] = token.split(".");
  if (!corpo || !assinatura) return null;
  const esperada = assinar(corpo);
  if (esperada.length !== assinatura.length || !timingSafeEqual(Buffer.from(esperada), Buffer.from(assinatura))) return null;
  try {
    const d = JSON.parse(Buffer.from(corpo, "base64url").toString("utf8")) as { id: string; slug: string; exp: number };
    return d.exp > Date.now() ? { id: d.id, slug: d.slug } : null;
  } catch {
    return null;
  }
}


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

export async function abrirConta(comprador: Comprador, slug: string) {
  const store = await cookies();
  store.set(COOKIE, emitirToken(comprador.id, slug), {
    httpOnly: true,
    sameSite: "lax",
    secure: await conexaoSegura(),
    path: "/",
    maxAge: DIAS * 86_400,
  });
}

export async function fecharConta() {
  (await cookies()).delete(COOKIE);
}

/** Comprador logado NESTA loja, ou null. */
export async function compradorAtual(t: Tenant): Promise<Comprador | null> {
  const dados = lerToken((await cookies()).get(COOKIE)?.value);
  if (!dados || dados.slug !== t.slug) return null;
  const c = await prisma.comprador.findFirst({ where: { id: dados.id, tenantId: t.id } });
  return c;
}

export class ContaErro extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export async function criarConta(t: Tenant, dados: { nome: string; email: string; senha: string; telefone?: string; documento?: string }) {
  const email = dados.email.trim().toLowerCase();
  if (dados.senha.length < 8) throw new ContaErro("A senha precisa ter pelo menos 8 caracteres.", 422);
  const existe = await prisma.comprador.findUnique({ where: { tenantId_email: { tenantId: t.id, email } } });
  if (existe) throw new ContaErro("Já existe uma conta com este e-mail nesta loja. Entre com sua senha.", 409);
  return prisma.comprador.create({
    data: {
      tenantId: t.id,
      email,
      senhaHash: gerarHashSenha(dados.senha),
      nome: dados.nome.trim(),
      telefone: dados.telefone?.replace(/\D/g, "") || null,
      documento: dados.documento?.replace(/\D/g, "") || null,
    },
  });
}

// Freio contra força bruta, por loja+e-mail, em memória (uma instância).
const tentativas = new Map<string, { n: number; ate: number }>();

export async function autenticar(t: Tenant, email: string, senha: string): Promise<Comprador> {
  const chave = `${t.id}:${email.trim().toLowerCase()}`;
  const bloqueio = tentativas.get(chave);
  if (bloqueio && bloqueio.n >= 8 && bloqueio.ate > Date.now()) throw new ContaErro("Muitas tentativas. Aguarde 15 minutos.", 429);

  const c = await prisma.comprador.findUnique({ where: { tenantId_email: { tenantId: t.id, email: email.trim().toLowerCase() } } });
  if (!c || !conferirSenha(senha, c.senhaHash)) {
    tentativas.set(chave, { n: (bloqueio?.n ?? 0) + 1, ate: Date.now() + 15 * 60_000 });
    throw new ContaErro("E-mail ou senha incorretos.", 401);
  }
  tentativas.delete(chave);
  await prisma.comprador.update({ where: { id: c.id }, data: { ultimoAcesso: new Date() } });
  return c;
}

/**
 * Liga pedidos antigos à conta recém-criada: quem já comprou como visitante
 * com o mesmo e-mail encontra o histórico ao criar a conta.
 */
export async function adotarPedidosAnteriores(comprador: Comprador) {
  await prisma.pedido.updateMany({
    where: { tenantId: comprador.tenantId, clienteEmail: comprador.email, compradorId: null },
    data: { compradorId: comprador.id },
  });
}
