import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { decifrar } from "@/lib/cofre";
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
 * Autentica uma chamada MCP.
 *
 * Aceita:
 * 1. `LOJAS_ADMIN_TOKEN` (Superadmin da Ávila Ops)
 * 2. `lojas_live_<slug>_<hex>` (Chave de API do lojista, exclusiva do plano LOJA_PRO)
 */
export async function autenticarMcp(request: Request): Promise<McpAuthResult> {
  const authHeader = request.headers.get("authorization") ?? "";
  const apiKeyHeader = request.headers.get("x-api-key") ?? "";

  let token = "";
  if (authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim();
  } else if (apiKeyHeader) {
    token = apiKeyHeader.trim();
  }

  if (!token) {
    throw new McpAuthError("Chave de API não informada. Envie no header Authorization: Bearer <chave> ou x-api-key.", 401);
  }

  // 1. Superadmin Ávila Ops
  const adminToken = process.env.LOJAS_ADMIN_TOKEN ?? "";
  if (adminToken && comparaSegura(token, adminToken)) {
    return { tipo: "admin" };
  }

  // 2. Chave de Lojista: lojas_live_<slug>_<hex>
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

  if (!tenant) {
    throw new McpAuthError(`Loja "${slug}" não encontrada.`, 404);
  }

  if (tenant.status !== "ATIVA") {
    throw new McpAuthError(`A loja "${tenant.nome}" está com status ${tenant.status}. Ative a loja no painel para usar o MCP.`, 403);
  }

  // Regra de Ouro: Exclusivo do plano LOJA_PRO
  if (tenant.plano !== "LOJA_PRO") {
    throw new McpAuthError(
      `O conector MCP / Claude é um recurso exclusivo do plano Loja Pro (R$ 349/mês). A loja "${tenant.nome}" está no plano ${tenant.plano}. Faça upgrade no painel para conectar sua IA.`,
      403,
      true,
    );
  }

  if (!tenant.apiKeyEnc) {
    throw new McpAuthError("Esta loja ainda não possui uma chave de API gerada. Gere no painel da sua loja na aba IA / Claude.", 401);
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

  return { tipo: "loja", tenant };
}

