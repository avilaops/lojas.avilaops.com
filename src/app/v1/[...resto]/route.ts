import { naoEncontrado } from "@/lib/gapp";

/**
 * O prefixo /v1 é do contrato: o que não é rota declarada responde 404 com o
 * corpo que o padrão exige, e não a página de erro da loja.
 */
export const dynamic = "force-dynamic";

export const GET = naoEncontrado;
export const POST = naoEncontrado;
export const PUT = naoEncontrado;
export const PATCH = naoEncontrado;
export const DELETE = naoEncontrado;
