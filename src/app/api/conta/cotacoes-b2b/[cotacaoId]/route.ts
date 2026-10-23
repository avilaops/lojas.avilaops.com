import { z } from "zod";
import { compradorAtual } from "@/lib/conta";
import { erroCotacao } from "@/lib/cotacoes-b2b-api";
import { AcaoSimplesCotacaoSchema, RecomprarCotacaoSchema, VersaoCotacaoSchema } from "@/lib/cotacoes-b2b-schema";
import { aprovarCotacaoB2B, cancelarCotacaoB2B, contraproporCotacaoB2B, obterCotacaoB2B, recusarCotacaoB2B, recomprarCotacaoB2B, submeterCotacaoB2B } from "@/lib/cotacoes-b2b";
import { prisma } from "@/lib/db";
import { tenantAtual } from "@/lib/tenant";

type Ctx = { params: Promise<{ cotacaoId: string }> };
const Contrapropor = VersaoCotacaoSchema.omit({ ator: true }).extend({ acao: z.literal("contrapropor") });
const Simples = AcaoSimplesCotacaoSchema.omit({ ator: true }).extend({ acao: z.enum(["submeter", "aprovar", "recusar", "cancelar"]) });
const Recomprar = RecomprarCotacaoSchema.omit({ ator: true }).extend({ acao: z.literal("recomprar") });
const Entrada = z.union([Contrapropor, Simples, Recomprar]);

async function contexto(cotacaoId: string) {
  const tenant = await tenantAtual();
  if (!tenant) return { resposta: Response.json({ erro: "Loja não encontrada." }, { status: 404 }) } as const;
  const comprador = await compradorAtual(tenant);
  if (!comprador) return { resposta: Response.json({ erro: "Entre na sua conta." }, { status: 401 }) } as const;
  const vinculo = await prisma.compradorEmpresaB2B.findFirst({
    where: { tenantId: tenant.id, compradorId: comprador.id, situacao: "ATIVO", cotacoes: { some: { id: cotacaoId } } },
    select: { id: true },
  });
  if (!vinculo) return { resposta: Response.json({ erro: "Cotação não encontrada." }, { status: 404 }) } as const;
  return { tenant, comprador, vinculo } as const;
}

export async function GET(_: Request, { params }: Ctx) {
  const id = (await params).cotacaoId;
  const c = await contexto(id);
  if ("resposta" in c) return c.resposta;
  try {
    return Response.json(await obterCotacaoB2B(c.tenant.id, id));
  } catch (falha) {
    return erroCotacao(falha);
  }
}

export async function POST(request: Request, { params }: Ctx) {
  const id = (await params).cotacaoId;
  const c = await contexto(id);
  if ("resposta" in c) return c.resposta;
  const entrada = Entrada.safeParse(await request.json().catch(() => null));
  if (!entrada.success) return Response.json({ erro: "Dados inválidos.", detalhes: entrada.error.flatten() }, { status: 422 });
  const ator = { tipo: "COMPRADOR", id: c.vinculo.id, email: c.comprador.email };
  try {
    if (entrada.data.acao === "contrapropor") {
      const versao = {
        itens: entrada.data.itens,
        descontoCentavos: entrada.data.descontoCentavos,
        freteCentavos: entrada.data.freteCentavos,
        condicoes: entrada.data.condicoes,
        justificativa: entrada.data.justificativa,
      };
      return Response.json(await contraproporCotacaoB2B(c.tenant.id, id, versao, ator));
    }
    if (entrada.data.acao === "submeter") return Response.json(await submeterCotacaoB2B(c.tenant.id, id, ator));
    if (entrada.data.acao === "aprovar") return Response.json(await aprovarCotacaoB2B(c.tenant.id, id, c.vinculo.id, { ...ator, tipo: "APROVADOR" }));
    if (entrada.data.acao === "recusar") {
      if (!entrada.data.motivo) return Response.json({ erro: "Informe o motivo da recusa." }, { status: 422 });
      return Response.json(await recusarCotacaoB2B(c.tenant.id, id, ator, entrada.data.motivo));
    }
    if (entrada.data.acao === "cancelar") return Response.json(await cancelarCotacaoB2B(c.tenant.id, id, ator, entrada.data.motivo));
    if (entrada.data.acao === "recomprar") return Response.json(await recomprarCotacaoB2B(c.tenant.id, id, entrada.data.validaAte, ator), { status: 201 });
    return Response.json({ erro: "Ação inválida." }, { status: 422 });
  } catch (falha) {
    return erroCotacao(falha);
  }
}
