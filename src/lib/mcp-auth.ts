import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { decifrar } from "@/lib/cofre";
import { hashDaChave, PREFIXO_CHAVE, tipoPeloFormato } from "@/lib/api-chaves";
import { conexaoDoAcesso } from "@/lib/mcp-conexoes";
import { PREFIXO } from "@/lib/mcp-oauth";
import { ESCOPO_DO_CONECTOR, ESCOPOS_DO_MCP } from "@/lib/mcp-permissoes";
import type { Tenant } from "@prisma/client";

export class McpAuthError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401,
    public upgradeRequired: boolean = false,
  ) {
    super(message);
    this.name = "McpAuthError";
  }
}

/** Quem está chamando, para o limite por credencial e para o histórico. */
export interface OrigemMcp {
  tipo: "conexao" | "chave" | "chave-antiga";
  /** Id da conexão ou da chave; o slug da loja, na chave antiga. */
  id: string;
  /** O que o lojista lê no histórico: nome do assistente ou rótulo da chave. */
  nome: string;
}

export type McpAuthResult =
  | { tipo: "admin"; tenant?: undefined }
  | { tipo: "loja"; tenant: Tenant; escopos: readonly string[]; origem: OrigemMcp };

function comparaSegura(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Loja ativa e no plano que inclui o conector. Vale igual para a conexão por
 * login e para as chaves: rebaixar o plano ou suspender a loja derruba todas na
 * chamada seguinte, sem esperar token vencer.
 */
function exigirLojaComConector(tenant: Tenant): void {
  if (tenant.status !== "ATIVA") {
    throw new McpAuthError(`A loja "${tenant.nome}" está com status ${tenant.status}. Ative a loja no painel para usar o MCP.`, 403);
  }
  // Regra de Ouro: Exclusivo do plano LOJA_PRO
  if (tenant.plano !== "LOJA_PRO") {
    throw new McpAuthError(
      `O conector MCP é um recurso exclusivo do plano Loja Pro (R$ 497/mês). A loja "${tenant.nome}" está no plano ${tenant.plano}. Faça upgrade no painel para conectar sua IA.`,
      403,
      true,
    );
  }
}

/**
 * Autentica uma chamada MCP.
 *
 * Aceita:
 * 1. `lojas_at_<hex>` — token da conexão por login (OAuth), o caminho do
 *    lojista no Claude, no ChatGPT e no Codex. Pode o que ele marcou na tela.
 * 2. `lojas_sk_<hex>` — chave secreta da API com o escopo `mcp:usar`, para n8n
 *    e scripts. Pode o que os outros escopos dela dizem.
 * 3. `lojas_live_<slug>_<hex>` — a chave antiga do conector. Não se emite mais;
 *    as que existem seguem valendo, com acesso inteiro, até serem revogadas.
 * 4. `LOJAS_ADMIN_TOKEN` (Superadmin da Ávila Ops)
 *
 * Os três primeiros são exclusivos do plano LOJA_PRO. Ver docs/MCP.md.
 */
export async function autenticarMcp(request: Request): Promise<McpAuthResult> {
  const authHeader = request.headers.get("authorization") ?? "";
  const apiKeyHeader = request.headers.get("x-api-key") ?? "";

  let token = "";
  if (/^Bearer /i.test(authHeader)) {
    token = authHeader.slice(7).trim();
  } else if (apiKeyHeader) {
    token = apiKeyHeader.trim();
  }

  if (!token) {
    throw new McpAuthError("Conexão não autorizada. Conecte a loja pelo login do conector ou envie a chave no header Authorization: Bearer <chave>.", 401);
  }

  // 1. Conexão por login
  if (token.startsWith(PREFIXO.acesso)) {
    const conexao = await conexaoDoAcesso(token);
    if (!conexao) throw new McpAuthError("Conexão vencida ou desconectada. Autorize a loja de novo.", 401);
    exigirLojaComConector(conexao.tenant);
    return {
      tipo: "loja",
      tenant: conexao.tenant,
      escopos: conexao.escopos,
      origem: { tipo: "conexao", id: conexao.conexaoId, nome: conexao.assistente },
    };
  }

  // 2. Chave secreta da API, com o escopo do conector
  if (token.startsWith(PREFIXO_CHAVE.SECRETA)) {
    const chave = tipoPeloFormato(token) === "SECRETA"
      ? await prisma.chaveApi.findUnique({ where: { hash: hashDaChave(token) }, include: { tenant: true } })
      : null;
    if (!chave || chave.revogadaEm) throw new McpAuthError("Chave de API inválida ou revogada.", 401);
    // Chave criada para o ERP não vira chave do conector sozinha: quem a criou
    // marcou escopos pensando na API, e o conector alcança mais coisa.
    if (!chave.escopos.includes(ESCOPO_DO_CONECTOR)) {
      throw new McpAuthError("Esta chave não tem o escopo `mcp:usar`. Crie no painel uma chave secreta com ele para usar o conector.", 403);
    }
    exigirLojaComConector(chave.tenant);
    if (!chave.ultimoUsoEm || Date.now() - chave.ultimoUsoEm.getTime() > 60_000) {
      prisma.chaveApi.update({ where: { id: chave.id }, data: { ultimoUsoEm: new Date() } }).catch(() => {});
    }
    return {
      tipo: "loja",
      tenant: chave.tenant,
      escopos: chave.escopos,
      origem: { tipo: "chave", id: chave.id, nome: chave.nome },
    };
  }

  // 3. Superadmin Ávila Ops
  const adminToken = process.env.LOJAS_ADMIN_TOKEN ?? "";
  if (adminToken && comparaSegura(token, adminToken)) {
    return { tipo: "admin" };
  }

  // 4. Chave antiga do conector: lojas_live_<slug>_<hex>
  if (!token.startsWith("lojas_live_")) {
    throw new McpAuthError("Credencial em formato desconhecido.", 401);
  }

  const partes = token.split("_");
  if (partes.length < 4) {
    throw new McpAuthError("Formato de chave inválido.", 401);
  }

  // lojas_live_<slug>_<hex>
  const slug = partes.slice(2, partes.length - 1).join("_");
  if (!slug) {
    throw new McpAuthError("Slug não identificado na chave de API.", 401);
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
  });

  // A mesma resposta para loja que não existe, loja sem chave e chave errada:
  // dizer qual das três é deixaria qualquer um descobrir quais lojas existem.
  if (!tenant || !tenant.apiKeyEnc) {
    throw new McpAuthError("Chave de API inválida ou revogada.", 401);
  }

  let chaveReal = "";
  try {
    chaveReal = decifrar(tenant.apiKeyEnc);
  } catch {
    throw new McpAuthError("Erro ao validar chave de API da loja.", 500);
  }

  if (!comparaSegura(token, chaveReal)) {
    throw new McpAuthError("Chave de API inválida ou revogada.", 401);
  }

  // Só depois de a chave conferir: status e plano são da loja, e só o dono dela
  // tem por que saber.
  exigirLojaComConector(tenant);

  return {
    tipo: "loja",
    tenant,
    escopos: ESCOPOS_DO_MCP,
    origem: { tipo: "chave-antiga", id: tenant.slug, nome: "Chave antiga do conector" },
  };
}
