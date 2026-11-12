import { rotaDaApi } from "@/lib/api-rotas";
import { ErroApi, lerCorpo } from "@/lib/api-resposta";
import { ChaveMovimento, MovimentoMultilocal } from "@/lib/estoque-multilocal-schema";
import { movimentarEstoqueMultilocal } from "@/lib/estoque-multilocal";
import { invalidarCatalogo } from "@/lib/catalogo-cache";

export const dynamic = "force-dynamic";

export const POST = rotaDaApi({ escopo: "estoque:escrever" }, async ({ request, tenant, chave }) => {
  const idempotencia = ChaveMovimento.safeParse(request.headers.get("idempotency-key"));
  if (!idempotencia.success) throw new ErroApi("parametro_invalido", "Envie Idempotency-Key com até 120 caracteres (letras, números, : . _ -).");
  const corpo = await lerCorpo(request, MovimentoMultilocal);
  const dados = await movimentarEstoqueMultilocal(tenant.id, idempotencia.data, corpo, `api:${chave.id}`);
  try {
    invalidarCatalogo(tenant.id);
  } catch {
    // O recibo já foi confirmado. A expiração do cache permite recuperar sem falso 500.
    console.error("[estoque/movimentos] falha na invalidação de cache");
  }
  return { dados };
});
