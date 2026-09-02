import { z } from "zod";
import { sessaoDoPainel } from "@/lib/sessao";
import { ErroOperador, criarOperador, listarOperadores, permite } from "@/lib/operadores";

/**
 * A equipe da loja, administrada pelo próprio lojista.
 *
 * Só o dono mexe aqui: deixar gerente criar gerente é deixar quem tem acesso
 * hoje garantir acesso para sempre, mesmo depois de ser desligado.
 */
export const dynamic = "force-dynamic";

const Novo = z.object({
  nome: z.string().min(2),
  email: z.string().email(),
  senha: z.string().min(8),
  papel: z.enum(["GERENTE", "OPERADOR"]),
});

async function dono() {
  const s = await sessaoDoPainel();
  if (!s) return { erro: Response.json({ erro: "Sessão expirada." }, { status: 401 }) };
  if (!permite(s.papel, "equipe")) {
    return { erro: Response.json({ erro: "Só o dono da loja gerencia os acessos." }, { status: 403 }) };
  }
  return { s };
}

export async function GET() {
  const { s, erro } = await dono();
  if (erro) return erro;
  return Response.json({ operadores: await listarOperadores(s.tenant.id) });
}

export async function POST(request: Request) {
  const { s, erro } = await dono();
  if (erro) return erro;

  const r = Novo.safeParse(await request.json().catch(() => null));
  if (!r.success) {
    return Response.json({ erro: "Preencha nome, e-mail, senha (8 caracteres) e o tipo de acesso." }, { status: 400 });
  }

  try {
    return Response.json({ operador: await criarOperador(s.tenant.id, r.data) }, { status: 201 });
  } catch (e) {
    if (e instanceof ErroOperador) return Response.json({ erro: e.message }, { status: 400 });
    throw e;
  }
}
