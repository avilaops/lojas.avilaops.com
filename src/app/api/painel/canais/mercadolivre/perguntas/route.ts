import { z } from "zod";
import { exigir } from "@/lib/operadores";
import { perguntasPendentes, responderPerguntaMl } from "@/lib/mercadolivre-perguntas";

/**
 * A fila de perguntas do Mercado Livre e a resposta, do painel.
 *
 * GET devolve o que espera resposta; POST responde. A resposta vai com o nome
 * de quem respondeu: numa loja com operadores, "quem respondeu isso" é a
 * primeira pergunta quando a resposta sai errada.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const { s, erro } = await exigir("configuracoes");
  if (erro) return erro;
  return Response.json({ perguntas: await perguntasPendentes(s.tenant.id) });
}

const Entrada = z.object({
  perguntaId: z.string().min(1).max(60),
  texto: z.string().min(1).max(4000),
});

export async function POST(request: Request) {
  const { s, erro } = await exigir("configuracoes");
  if (erro) return erro;
  const entrada = Entrada.safeParse(await request.json().catch(() => null));
  if (!entrada.success) return Response.json({ erro: "dados inválidos" }, { status: 422 });

  try {
    const r = await responderPerguntaMl(s.tenant, entrada.data.perguntaId, entrada.data.texto, s.operador?.nome ?? null);
    return Response.json({ respondida: r.id, em: r.respondidaEm });
  } catch (e) {
    // A mensagem aqui é para o lojista ler e agir: ou o Mercado Livre recusou,
    // ou o texto tem contato, ou alguém já respondeu pelo app.
    return Response.json({ erro: e instanceof Error ? e.message : "Não consegui responder." }, { status: 422 });
  }
}
