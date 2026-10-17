import { z } from "zod";
import { prisma } from "@/lib/db";
import { autorizado, naoAutorizado } from "@/lib/admin-auth";
import { NOME_PLANO } from "@/lib/assinatura";
import { FAIXAS_ANTIGAS, faixaAntiga, faixaDaLoja, mensalidadeDaLoja, precoDeTabela } from "@/lib/faixas-antigas";
import { esquecerTenantEmCache } from "@/lib/tenant";

type Ctx = { params: Promise<{ slug: string }> };
type Loja = { plano: "SITE" | "LOJA" | "LOJA_PRO"; faixaPreco: string | null };

const situacao = (t: Loja) => ({
  plano: t.plano,
  planoNome: NOME_PLANO[t.plano],
  /** A faixa antiga que está valendo, ou `null` (paga a tabela). */
  faixa: faixaDaLoja(t) ? t.faixaPreco : null,
  faixaNome: faixaDaLoja(t)?.nome ?? null,
  mensalidadeCentavos: mensalidadeDaLoja(t),
  tabelaCentavos: precoDeTabela(t.plano),
});

/** GET — quanto a loja paga, se está numa faixa antiga, e as faixas que existem. */
export async function GET(request: Request, { params }: Ctx) {
  if (!autorizado(request)) return naoAutorizado();
  const { slug } = await params;
  const t = await prisma.tenant.findUnique({ where: { slug } });
  if (!t) return Response.json({ erro: "loja não encontrada" }, { status: 404 });
  return Response.json({
    ...situacao(t),
    faixas: Object.entries(FAIXAS_ANTIGAS).map(([id, f]) => ({ id, nome: f.nome, plano: f.plano, centavos: f.centavos, nota: f.nota, fechada: f.fechada })),
  });
}

const Entrada = z.object({ faixa: z.string().trim().min(1).max(60).nullable() }).strict();

/**
 * POST { faixa } — põe a loja numa faixa de preço antiga, ou tira (`null`).
 *
 * Pôr na faixa também põe a loja no plano da faixa: a faixa é o anúncio antigo
 * daquele plano. Não cobra ninguém nem cria mensalidade; muda o valor que a
 * próxima mensalidade criada vai ter e o que o lojista vê no painel dele.
 *
 * Com mensalidade já criada no Mercado Pago o valor mora lá também: mudar a
 * faixa só aqui faria a loja mostrar um preço e o cartão pagar outro. Aí a
 * resposta é 409, e o caminho é reajustar a mensalidade (ação `valor`).
 */
export async function POST(request: Request, { params }: Ctx) {
  if (!autorizado(request)) return naoAutorizado();
  const { slug } = await params;
  const r = Entrada.safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "dados inválidos", detalhes: r.error.flatten() }, { status: 422 });

  const t = await prisma.tenant.findUnique({ where: { slug } });
  if (!t) return Response.json({ erro: "loja não encontrada" }, { status: 404 });

  const nova = r.data.faixa === null ? null : faixaAntiga(r.data.faixa);
  if (r.data.faixa !== null && !nova) return Response.json({ erro: "faixa de preço desconhecida" }, { status: 422 });
  if (nova?.fechada && t.faixaPreco !== r.data.faixa) return Response.json({ erro: "esta faixa está fechada para novas lojas" }, { status: 409 });

  const antes = situacao(t);
  const depoisLoja: Loja = { plano: nova?.plano ?? t.plano, faixaPreco: r.data.faixa };
  if (mensalidadeDaLoja(depoisLoja) === antes.mensalidadeCentavos && depoisLoja.plano === t.plano && (faixaDaLoja(depoisLoja) ? r.data.faixa : null) === antes.faixa) {
    return Response.json({ mudou: false, antes, depois: antes });
  }
  if (t.assinaturaId && t.assinaturaStatus !== "CANCELADA") {
    return Response.json(
      { erro: "A loja já tem mensalidade no Mercado Pago, com o valor gravado lá. Reajuste a mensalidade em vez de trocar a faixa.", antes },
      { status: 409 },
    );
  }

  const gravada = await prisma.tenant.update({ where: { id: t.id }, data: depoisLoja });
  esquecerTenantEmCache(t.slug);
  return Response.json({ mudou: true, antes, depois: situacao(gravada) });
}
