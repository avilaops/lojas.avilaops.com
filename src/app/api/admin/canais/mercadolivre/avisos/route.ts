import { z } from "zod";
import { autorizado, naoAutorizado } from "@/lib/admin-auth";
import { processarAvisosMl } from "@/lib/mercadolivre-avisos";

/**
 * POST /api/admin/canais/mercadolivre/avisos — processa a fila de notificações.
 *
 * O webhook do ML só enfileira (ele precisa de 200 em segundos). Quem age é
 * esta rota, chamada pelo n8n de minutos em minutos: venda vira pedido, envio
 * vira rastreio, anúncio mexido vira pendência.
 *
 * Idempotente e segura para rodar em paralelo: cada aviso é reivindicado antes
 * do efeito, e o pedido é único por (loja, canal, id do pedido no ML).
 */
const Entrada = z.object({ limite: z.number().int().min(1).max(200).optional() });

export async function POST(request: Request) {
  if (!autorizado(request)) return naoAutorizado();
  const entrada = Entrada.safeParse(await request.json().catch(() => ({})));
  if (!entrada.success) return Response.json({ erro: "dados inválidos", detalhes: entrada.error.flatten() }, { status: 422 });
  const resumo = await processarAvisosMl(entrada.data);
  return Response.json(resumo, { status: resumo.falhas ? 207 : 200 });
}
