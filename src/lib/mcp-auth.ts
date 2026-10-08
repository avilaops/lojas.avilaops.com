import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { decifrar } from "@/lib/cofre";
import { lojaDoAcesso } from "@/lib/mcp-conexoes";
import { PREFIXO } from "@/lib/mcp-oauth";
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

export type McpAuthResult =
  | { tipo: "admin"; tenant?: undefined }
  | { tipo: "loja"; tenant: Tenant };

function comparaSegura(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Loja ativa e no plano que inclui o conector. Vale igual para a conexão por
 * login e para a chave: rebaixar o plano ou suspender a loja derruba as duas na
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
 *    lojista no Claude, no ChatGPT e no Codex. Ver docs/MCP.md.
 * 2. `lojas_live_<slug>_<hex>` — chave do lojista, para n8n e scripts.
 * 3. `LOJAS_ADMIN_TOKEN` (Superadmin da Ávila Ops)
 *
 * Os dois primeiros são exclusivos do plano LOJA_PRO.
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
    const tenant = await lojaDoAcesso(token);
    if (!tenant) throw new McpAuthError("Conexão vencida ou desconectada. Autorize a loja de novo.", 401);
    exigirLojaComConector(tenant);
    return { tipo: "loja", tenant };
  }

  // 2. Superadmin Ávila Ops
  const adminToken = process.env.LOJAS_ADMIN_TOKEN ?? "";
  if (adminToken && comparaSegura(token, adminToken)) {
    return { tipo: "admin" };
  }

  // 3. Chave de Lojista: lojas_live_<slug>_<hex>
  if (!token.startsWith("lojas_live_")) {
    throw new McpAuthError("Formato de chave inválido. A chave deve iniciar com lojas_live_", 401);
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

  return { tipo: "loja", tenant };
}
