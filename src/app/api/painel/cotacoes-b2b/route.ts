import { CriarCotacaoSchema } from "@/lib/cotacoes-b2b-schema";
import { criarCotacaoB2B, expirarCotacoesVencidas } from "@/lib/cotacoes-b2b";
import { erroCotacao } from "@/lib/cotacoes-b2b-api";
import { listarCotacoesB2B } from "@/lib/cotacoes-b2b-consulta";
import { exigir } from "@/lib/operadores";

const Entrada = CriarCotacaoSchema.omit({ ator: true });

export async function GET(request: Request) {
  const { s, erro } = await exigir("pedidos");
  if (erro) return erro;
  await expirarCotacoesVencidas(s.tenant.id);
  try { return Response.json(await listarCotacoesB2B(s.tenant.id, new URL(request.url).searchParams)); }
  catch (error) { return erroCotacao(error); }
}

export async function POST(request: Request) {
  const { s, erro } = await exigir("pedidos");
  if (erro) return erro;
  const entrada = Entrada.safeParse(await request.json().catch(() => null));
  if (!entrada.success) return Response.json({ erro: "Dados inválidos.", detalhes: entrada.error.flatten() }, { status: 422 });
  const ator = {
    tipo: "VENDEDOR",
    id: s.operador?.id ?? null,
    email: s.operador?.email ?? s.tenant.loginEmail,
  };
  try {
    return Response.json(await criarCotacaoB2B(s.tenant.id, entrada.data, ator), { status: 201 });
  } catch (falha) {
    return erroCotacao(falha);
  }
}
