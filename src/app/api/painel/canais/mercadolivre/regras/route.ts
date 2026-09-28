import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { exigir } from "@/lib/operadores";
import { gravarRegrasDoCanal, lerRegrasDoCanal } from "@/lib/canais";

/**
 * PUT /api/painel/canais/mercadolivre/regras — por quanto e com quanto estoque
 * o catálogo vai para o canal.
 *
 * Grava o que o leitor devolve, nunca o que chegou: é `lerRegrasDoCanal` quem
 * limita faixa e descarta valor desconhecido, e gravar cru deixaria no banco um
 * número que a leitura depois ignoraria — o lojista digitaria 500% de acréscimo
 * e veria o anúncio sair com outro preço, sem ninguém ter avisado nada.
 *
 * Não republica nada sozinho. O ciclo seguinte encontra a diferença entre o que
 * está no ar e o que as regras mandam, e corrige: mudar de ideia sobre o preço
 * não deveria disparar mil chamadas ao Mercado Livre no instante do clique.
 */
export async function PUT(request: Request) {
  const { s, erro } = await exigir("configuracoes");
  if (erro) return erro;
  const loja = s.tenant;

  const corpo = await request.json().catch(() => null);
  if (!corpo || typeof corpo !== "object") return Response.json({ erro: "Regras ausentes." }, { status: 422 });

  const regras = lerRegrasDoCanal({ mercadolivre: corpo }, "mercadolivre");
  const canais = gravarRegrasDoCanal(loja.canais, "mercadolivre", regras);

  await prisma.tenant.update({
    where: { id: loja.id },
    data: { canais: canais as unknown as Prisma.InputJsonValue },
  });
  return Response.json({ regras });
}
