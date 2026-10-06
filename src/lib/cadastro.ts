import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Prisma, type Plano, type Tenant } from "@prisma/client";
import { prisma } from "./db";
import { slugificar } from "./catalogo";
import { DIAS_DE_TESTE } from "./planos";
import { gerarHashSenha } from "./sessao";

/**
 * Cadastro por conta: primeiro a pessoa, depois a loja.
 *
 *   1. /criar pede só o e-mail e manda o link de confirmação (`tokenDeCadastro`).
 *   2. /confirmar lê o link, a pessoa escolhe a senha e `criarConta` abre a
 *      conta — ou o Google confirma o e-mail e a conta nasce sem senha.
 *   3. Dentro do painel, `concluirPrimeirosPassos` dá nome, WhatsApp e plano
 *      à loja, e só então ela vai ao ar.
 *
 * A conta é o próprio `Tenant` (o dono é `loginEmail`/`senhaHash`), que nasce
 * em PROVISIONANDO com nome e endereço provisórios. Não há tabela de "pré-
 * cadastro": o link de confirmação é assinado e carrega o e-mail, e quem nunca
 * clica não deixa linha nenhuma no banco.
 */

const VALIDADE_DO_LINK_MS = 24 * 3_600_000;
const NOME_PROVISORIO = "Minha loja";

function segredo(): Buffer {
  const hex = process.env.LOJAS_SECRET ?? "";
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error("LOJAS_SECRET ausente.");
  return Buffer.from(hex, "hex");
}

// O prefixo separa este token dos outros assinados com o mesmo segredo (sessão,
// recuperação de senha): um não pode ser aceito no lugar do outro.
function assinar(corpo: string): string {
  return createHmac("sha256", segredo()).update(`cadastro:${corpo}`).digest("base64url");
}

export function normalizarEmailDoCadastro(email: string): string {
  return email.trim().toLowerCase();
}

const PLANOS_VALIDOS = new Set<Plano>(["SITE", "LOJA", "LOJA_PRO"]);

/** O plano que veio da página inicial (/criar?plano=), ou nenhum. É só a sugestão inicial: a escolha é feita no painel. */
export function planoDoCadastro(valor: unknown): Plano | undefined {
  return typeof valor === "string" && PLANOS_VALIDOS.has(valor as Plano) ? (valor as Plano) : undefined;
}

export function tokenDeCadastro(email: string, plano?: Plano, agora = Date.now()): string {
  const corpo = Buffer.from(JSON.stringify({ email: normalizarEmailDoCadastro(email), ...(plano ? { plano } : {}), exp: agora + VALIDADE_DO_LINK_MS })).toString("base64url");
  return `${corpo}.${assinar(corpo)}`;
}

export type LeituraDoToken = { email: string; plano?: Plano } | { erro: "invalido" | "expirado" };

export function lerTokenDeCadastro(token: string, agora = Date.now()): LeituraDoToken {
  const [corpo, assinatura] = token.split(".");
  if (!corpo || !assinatura) return { erro: "invalido" };
  const esperada = assinar(corpo);
  if (esperada.length !== assinatura.length || !timingSafeEqual(Buffer.from(esperada), Buffer.from(assinatura))) return { erro: "invalido" };
  try {
    const dados = JSON.parse(Buffer.from(corpo, "base64url").toString("utf8")) as { email?: unknown; plano?: unknown; exp?: unknown };
    if (typeof dados.email !== "string" || typeof dados.exp !== "number") return { erro: "invalido" };
    return dados.exp < agora ? { erro: "expirado" } : { email: dados.email, plano: planoDoCadastro(dados.plano) };
  } catch {
    return { erro: "invalido" };
  }
}

/**
 * Abre a conta. `senha` nula é a conta que veio do Google: entra pelo Google
 * e, se quiser senha depois, usa "esqueci a senha".
 *
 * Devolve `null` quando o e-mail já tem conta — inclusive na corrida de dois
 * cliques no mesmo link, que o índice único de `loginEmail` decide.
 */
export async function criarConta(entrada: { email: string; senha: string | null; plano?: Plano }, agora = new Date()): Promise<Tenant | null> {
  const email = normalizarEmailDoCadastro(entrada.email);
  if (await prisma.tenant.findUnique({ where: { loginEmail: email }, select: { id: true } })) return null;
  try {
    return await prisma.tenant.create({
      data: {
        // Endereço provisório e fora do ar (PROVISIONANDO não é indexado);
        // o definitivo nasce do nome, nos primeiros passos.
        slug: `nova-${randomBytes(5).toString("hex")}`,
        nome: NOME_PROVISORIO,
        status: "PROVISIONANDO",
        ...(entrada.plano ? { plano: entrada.plano } : {}),
        loginEmail: email,
        emailContato: email,
        senhaHash: entrada.senha ? gerarHashSenha(entrada.senha) : null,
        testeAte: new Date(agora.getTime() + DIAS_DE_TESTE * 86_400_000),
      },
    });
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") return null;
    throw erro;
  }
}

/** Conta aberta, loja ainda sem nome: o painel mostra os primeiros passos no lugar da visão geral. */
export function precisaDosPrimeirosPassos(t: Pick<Tenant, "status" | "whatsapp">): boolean {
  return t.status === "PROVISIONANDO" && !t.whatsapp;
}

/**
 * O endereço definitivo, a partir do nome. Se já existir, ganha um sufixo —
 * a mesma regra do cadastro antigo.
 */
async function slugLivre(nome: string, idProprio: string): Promise<string> {
  const base = slugificar(nome).slice(0, 40).replace(/-+$/, "") || "loja";
  for (const candidato of [base, ...Array.from({ length: 5 }, () => `${base}-${randomBytes(2).toString("hex")}`)]) {
    const dono = await prisma.tenant.findUnique({ where: { slug: candidato }, select: { id: true } });
    if (!dono || dono.id === idProprio) return candidato;
  }
  return `${base}-${randomBytes(4).toString("hex")}`;
}

/**
 * Nome, WhatsApp e plano: o mínimo para a loja ir ao ar.
 *
 * Passa direto a ATIVA, como o cadastro antigo: o provisionamento (DNS, caixa
 * de e-mail) depende de domínio próprio, que costuma chegar semanas depois, e
 * a loja no subdomínio não espera por ele.
 */
export async function concluirPrimeirosPassos(t: Tenant, entrada: { nome: string; whatsapp: string; plano: Plano }): Promise<Tenant> {
  const slug = await slugLivre(entrada.nome, t.id);
  return prisma.tenant.update({
    where: { id: t.id },
    data: { slug, nome: entrada.nome.trim(), whatsapp: entrada.whatsapp, plano: entrada.plano, status: "ATIVA" },
  });
}
