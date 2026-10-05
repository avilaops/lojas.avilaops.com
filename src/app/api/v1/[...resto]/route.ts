import { randomUUID } from "node:crypto";
import { corpoDeErro } from "@/lib/api-resposta";

/**
 * O que não é rota declarada da API responde no formato da API, e não com a
 * página de erro da loja: cliente que erra o caminho recebe JSON que o
 * tratador de erro dele já entende.
 */
export const dynamic = "force-dynamic";

function naoEncontrado(): Response {
  return Response.json(corpoDeErro("nao_encontrado", "Rota inexistente. GET /api/v1 lista as rotas da API.", randomUUID()), { status: 404 });
}

export const GET = naoEncontrado;
export const POST = naoEncontrado;
export const PUT = naoEncontrado;
export const PATCH = naoEncontrado;
export const DELETE = naoEncontrado;
