import { z } from "zod";
import { sessaoDoPainel } from "@/lib/sessao";
import { ErroOperador, atualizarOperador, permite, removerOperador } from "@/lib/operadores";

/**
 * Editar, desligar e remover um acesso.
 *
 * O `tenantId` da sessão entra em toda consulta: sem isso um lojista poderia
 * editar o operador de outra loja mandando um id qualquer.
 */
export const dynamic = "force-dynamic";

const Mudanca = z.object({
  nome: z.string().min(2).optional(),
  papel: z.enum(["GERENTE", "OPERADOR"]).optional(),
  ativo: z.boolean().optional(),
  senha: z.string().min(8).optional(),
});

async function dono() {
  const s = await sessaoDoPainel();
  if (!s) return { erro: Response.json({ erro: "Sessão expirada." }, { status: 401 }) };
  if (!permite(s.papel, "equipe")) {
    return { erro: Response.json({ erro: "Só o dono da loja gerencia os acessos." }, { status: 403 }) };
  }
  return { s };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { s, erro } = await dono();
  if (erro) return erro;
  const { id } = await params;

  const r = Mudanca.safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "Nada para alterar, ou senha com menos de 8 caracteres." }, { status: 400 });

  try {
    return Response.json({ operador: await atualizarOperador(s.tenant.id, id, r.data) });
  } catch (e) {
    if (e instanceof ErroOperador) return Response.json({ erro: e.message }, { status: 400 });
    throw e;
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { s, erro } = await dono();
  if (erro) return erro;
  const { id } = await params;

  try {
    await removerOperador(s.tenant.id, id);
    return Response.json({ removido: true });
  } catch (e) {
    if (e instanceof ErroOperador) return Response.json({ erro: e.message }, { status: 400 });
    throw e;
  }
}
