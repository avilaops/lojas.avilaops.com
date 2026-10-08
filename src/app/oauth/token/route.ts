import { renovar, trocarCodigo } from "@/lib/mcp-conexoes";
import { mesmoRecurso, recurso, respostaDeToken } from "@/lib/mcp-oauth";
import { erroOAuth, jsonSemCache, naoExiste, noDominioBase, preflight } from "@/lib/mcp-oauth-http";

/**
 * Troca o código de autorização pelos tokens, e renova o par depois.
 *
 * Sem segredo de cliente: quem prova que pediu o código é o `code_verifier`
 * (PKCE), e quem prova que tem a conexão é o token de renovação, que muda a
 * cada uso.
 */
export async function POST(request: Request) {
  if (!noDominioBase(request)) return naoExiste();
  const f = new URLSearchParams(await request.text().catch(() => ""));

  const clienteId = f.get("client_id") ?? "";
  if (!clienteId) return erroOAuth("invalid_client", "client_id ausente.", 401);
  const alvo = f.get("resource");
  if (alvo && !mesmoRecurso(alvo)) return erroOAuth("invalid_target", `Este servidor só autoriza ${recurso()}.`);

  const tipo = f.get("grant_type");
  const r =
    tipo === "authorization_code"
      ? await trocarCodigo({ codigo: f.get("code") ?? "", clienteId, retorno: f.get("redirect_uri"), verificador: f.get("code_verifier") ?? "" })
      : tipo === "refresh_token"
        ? await renovar({ renovacao: f.get("refresh_token") ?? "", clienteId })
        : null;

  if (!r) return erroOAuth("unsupported_grant_type", "Use authorization_code ou refresh_token.");
  if ("erro" in r) return erroOAuth(r.erro, r.descricao);
  return jsonSemCache(respostaDeToken(r.acesso, r.renovacao));
}

export const OPTIONS = preflight;
