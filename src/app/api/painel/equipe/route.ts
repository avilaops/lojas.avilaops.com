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

  // O provisionamento é feito em fila persistente, fora da requisição HTTP.
  // Não aceitar senha local: a autenticação deste produto é centralizada no Auth.
  if (r.data.senha) return Response.json({ erro: "O funcionário cria sua senha no Auth por convite; não cadastre senha de terceiros." }, { status: 400 });

  try {
    const operador = await criarOperador(s.tenant.id, r.data);
    const convite = { situacao: "PENDENTE" as const, detalhe: "Convite enfileirado para provisionamento automático no Auth." };
    return Response.json({ operador: await registrarConvite(s.tenant.id, operador.id, convite), convite }, { status: 202 });
  } catch (e) {
    if (e instanceof ErroOperador) return Response.json({ erro: e.message }, { status: 400 });
    throw e;
  }
}
