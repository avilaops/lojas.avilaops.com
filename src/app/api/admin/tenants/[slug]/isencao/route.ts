import { z } from "zod";
import { prisma } from "@/lib/db";
import { autorizado, naoAutorizado } from "@/lib/admin-auth";
import { definirIsencao, situacaoDaIsencao } from "@/lib/assinatura";

type Ctx = { params: Promise<{ slug: string }> };

/** GET — a isenção da loja e o que a régua de inadimplência diria se ela não fosse isenta. */
export async function GET(request: Request, { params }: Ctx) {
  if (!autorizado(request)) return naoAutorizado();
  const { slug } = await params;
  const t = await prisma.tenant.findUnique({ where: { slug } });
  if (!t) return Response.json({ erro: "loja não encontrada" }, { status: 404 });
  return Response.json(situacaoDaIsencao(t));
}

const Entrada = z
  .object({
    isenta: z.boolean(),
    /**
     * Obrigatório para TIRAR a isenção de uma loja que cairia na régua de
     * inadimplência: quem tira precisa ter lido a consequência. Sem ele a
     * resposta é 409 com o motivo, e nada muda.
     */
    cienteDaRegua: z.boolean().optional(),
  })
  .strict();

/**
 * POST — marca ou tira a isenção de mensalidade.
 *
 * Tirar a isenção não cobra ninguém: não cria assinatura no Mercado Pago, não
 * gera fatura e não muda o status da loja. O efeito é a loja voltar a ser
 * avaliada pela régua de inadimplência — e é isso que precisa de ciência
 * explícita quando a régua já a reprovaria hoje.
 */
export async function POST(request: Request, { params }: Ctx) {
  if (!autorizado(request)) return naoAutorizado();
  const { slug } = await params;
  const r = Entrada.safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "dados inválidos", detalhes: r.error.flatten() }, { status: 422 });

  const t = await prisma.tenant.findUnique({ where: { slug } });
  if (!t) return Response.json({ erro: "loja não encontrada" }, { status: 404 });

  const antes = situacaoDaIsencao(t);
  if (antes.isenta === r.data.isenta) return Response.json({ mudou: false, antes, depois: antes });

  if (!r.data.isenta && antes.seNaoFosseIsenta && !r.data.cienteDaRegua) {
    return Response.json(
      {
        erro: `Sem a isenção, esta loja cai na régua de inadimplência: ${antes.seNaoFosseIsenta}. ${
          antes.suspensaoAutomatica ? "A suspensão automática está ligada e ela seria suspensa na próxima rodada." : "A suspensão automática está desligada: ela só passa a aparecer na lista de quem seria suspensa."
        } Confirme que leu isto para tirar a isenção.`,
        precisaDeCiencia: true,
        antes,
      },
      { status: 409 },
    );
  }

  const depois = situacaoDaIsencao(await definirIsencao(t, r.data.isenta));
  return Response.json({ mudou: true, antes, depois });
}
