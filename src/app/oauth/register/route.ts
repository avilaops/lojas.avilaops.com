import { registrarCliente } from "@/lib/mcp-conexoes";
import { lerRegistro, respostaDoRegistro } from "@/lib/mcp-oauth";
import { erroOAuth, jsonSemCache, limiteDoRegistro, naoExiste, noDominioBase, preflight } from "@/lib/mcp-oauth-http";
import { medirRota } from "@/lib/metricas-rota";

/**
 * Registro dinâmico de cliente (RFC 7591): o assistente se apresenta sozinho.
 *
 * Aberto, como o protocolo pede, e por isso o registro não dá poder nenhum:
 * sem o lojista entrar no painel e confirmar, um cliente registrado não lê nada.
 */
export const POST = medirRota("mcp", registrar, { host: () => null });

async function registrar(request: Request) {
  if (!noDominioBase(request)) return naoExiste();
  const recusa = limiteDoRegistro(request);
  if (recusa) return recusa;
  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return erroOAuth("invalid_client_metadata", "Corpo JSON inválido.");
  }
  const lido = lerRegistro(corpo);
  if ("erro" in lido) return erroOAuth(lido.erro, lido.descricao);

  const c = await registrarCliente(lido.cliente);
  return jsonSemCache(respostaDoRegistro(c), 201);
}

export const OPTIONS = preflight;
