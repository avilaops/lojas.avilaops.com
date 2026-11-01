import { z } from "zod";
import { erroCotacao } from "@/lib/cotacoes-b2b-api";
import { AcaoSimplesCotacaoSchema, ConverterCotacaoSchema, RecomprarCotacaoSchema, VersaoCotacaoSchema } from "@/lib/cotacoes-b2b-schema";
import { cancelarCotacaoB2B, contraproporCotacaoB2B, converterCotacaoB2B, obterCotacaoB2B, recomprarCotacaoB2B, submeterCotacaoB2B } from "@/lib/cotacoes-b2b";
import { exigir } from "@/lib/operadores";

type Ctx = { params: Promise<{ cotacaoId: string }> };
const Contrapropor = VersaoCotacaoSchema.omit({ ator: true }).extend({ acao: z.literal("contrapropor") });
const Simples = AcaoSimplesCotacaoSchema.omit({ ator: true }).extend({ acao: z.enum(["submeter", "cancelar"]) });
const Converter = ConverterCotacaoSchema.omit({ ator: true }).extend({ acao: z.literal("converter") });
const Recomprar = RecomprarCotacaoSchema.omit({ ator: true }).extend({ acao: z.literal("recomprar") });
const Entrada = z.union([Contrapropor, Simples, Converter, Recomprar]);

export async function GET(_: Request, { params }: Ctx) {
  const { s, erro } = await exigir("pedidos");
  if (erro) return erro;
  try {
    return Response.json(await obterCotacaoB2B(s.tenant.id, (await params).cotacaoId));
  } catch (falha) {
    return erroCotacao(falha);
  }
}

export async function POST(request: Request, { params }: Ctx) {
  const { s, erro } = await exigir("pedidos");
  if (erro) return erro;
  const entrada = Entrada.safeParse(await request.json().catch(() => null));
  if (!entrada.success) return Response.json({ erro: "Dados inválidos.", detalhes: entrada.error.flatten() }, { status: 422 });
  const id = (await params).cotacaoId;
  const ator = { tipo: "VENDEDOR", id: s.operador?.id ?? null, email: s.operador?.email ?? s.tenant.loginEmail };
  try {
    if (entrada.data.acao === "contrapropor") {
      const versao = {
        itens: entrada.data.itens,
        descontoCentavos: entrada.data.descontoCentavos,
        freteCentavos: entrada.data.freteCentavos,
        condicoes: entrada.data.condicoes,
        justificativa: entrada.data.justificativa,
        versaoEsperada: entrada.data.versaoEsperada,
      };
      return Response.json(await contraproporCotacaoB2B(s.tenant.id, id, versao, ator));
    }
    if (entrada.data.acao === "submeter") return Response.json(await submeterCotacaoB2B(s.tenant.id, id, ator, entrada.data.versaoEsperada));
    if (entrada.data.acao === "cancelar") return Response.json(await cancelarCotacaoB2B(s.tenant.id, id, ator, entrada.data.motivo, entrada.data.versaoEsperada));
    if (entrada.data.acao === "converter") return Response.json(await converterCotacaoB2B(s.tenant.id, id, entrada.data.chaveIdempotencia, ator, entrada.data.versaoEsperada));
    if (entrada.data.acao === "recomprar") return Response.json(await recomprarCotacaoB2B(s.tenant.id, id, entrada.data.validaAte, ator), { status: 201 });
    return Response.json({ erro: "Ação inválida." }, { status: 422 });
  } catch (falha) {
    return erroCotacao(falha);
  }
}
