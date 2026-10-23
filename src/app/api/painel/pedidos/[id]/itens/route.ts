import { z } from "zod";
import { exigir } from "@/lib/operadores";
import { atualizarProgressoDosItens, MudancaDeStatusRecusada } from "@/lib/pedidos-status";

const Entrada = z.object({
  itens: z.array(z.object({
    id: z.string().min(1),
    quantidadePaga: z.number().int().min(0).optional(),
    quantidadeExpedida: z.number().int().min(0).optional(),
    quantidadeCancelada: z.number().int().min(0).optional(),
    quantidadeDevolvida: z.number().int().min(0).optional(),
  }).strict()).min(1),
}).strict();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { s, erro } = await exigir("pedidos");
  if (erro) return erro;
  const idempotencia = request.headers.get("idempotency-key")?.trim();
  if (!idempotencia) return Response.json({ erro: "Informe o cabeçalho Idempotency-Key." }, { status: 400 });
  const entrada = Entrada.safeParse(await request.json().catch(() => null));
  if (!entrada.success) return Response.json({ erro: "Dados inválidos." }, { status: 422 });

  try {
    const pedido = await atualizarProgressoDosItens(s.tenant, (await params).id, entrada.data.itens, {
      ator: { tipo: s.papel, id: s.operador?.id, email: s.operador?.email ?? s.tenant.loginEmail },
      origem: "painel",
      idempotencia,
    });
    return Response.json({ id: pedido.id, itens: pedido.itens });
  } catch (error) {
    if (!(error instanceof MudancaDeStatusRecusada)) throw error;
    return Response.json({ erro: error.message }, { status: error.motivo === "nao_encontrado" ? 404 : 409 });
  }
}
