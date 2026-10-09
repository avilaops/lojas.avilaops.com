import { z } from "zod";
import { sessaoDoPainel } from "@/lib/sessao";
import { CONVITE_DESLIGADO, configConvite, convidarParaAEquipe } from "@/lib/convite-equipe";
import { ErroOperador, criarOperador, listarOperadores, permite, registrarConvite } from "@/lib/operadores";

const HOST_BASE = (process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com").toLowerCase();

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
  // Em branco, a pessoa recebe o convite por e-mail e cria a senha no login único.
  senha: z.string().min(8).optional().or(z.literal("").transform(() => undefined)),
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
    return Response.json({ erro: "Preencha nome, e-mail e o tipo de acesso. A senha, se houver, precisa de 8 caracteres." }, { status: 400 });
  }

  // Sem senha e sem convite ligado a pessoa ficaria com um acesso que não abre.
  const cfg = configConvite();
  if (!r.data.senha && !cfg) return Response.json({ erro: CONVITE_DESLIGADO }, { status: 400 });

  try {
    const operador = await criarOperador(s.tenant.id, r.data);
    if (r.data.senha) return Response.json({ operador }, { status: 201 });

    const convite = await convidarParaAEquipe(cfg, { email: operador.email, nome: operador.nome, loja: s.tenant.nome, hostBase: HOST_BASE });
    return Response.json({ operador: await registrarConvite(s.tenant.id, operador.id, convite), convite }, { status: 201 });
  } catch (e) {
    if (e instanceof ErroOperador) return Response.json({ erro: e.message }, { status: 400 });
    throw e;
  }
}
