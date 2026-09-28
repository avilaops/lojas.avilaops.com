import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { exigir } from "@/lib/operadores";
import {
  TIPOS_POLITICA,
  lerPoliticasEscritas,
  lerRegrasDevolucao,
  modeloDePolitica,
  type TipoPolitica,
} from "@/lib/politicas";

/**
 * POST /api/painel/politicas — o lojista escreve as próprias políticas.
 *
 * Três ações, porque são três decisões separadas:
 *
 * - `salvar`   grava o texto próprio de um tipo;
 * - `restaurar` apaga o texto próprio e volta ao modelo da plataforma. É
 *   apagar mesmo, e não gravar o modelo como se fosse escrito pelo lojista:
 *   texto colado congela, e a loja que "restaurou" pararia de receber as
 *   correções do modelo (uma mudança na lei, por exemplo);
 * - `regras`   grava as regras de devolução, que o modelo lê para montar o
 *   texto sozinho.
 */

/** Teto de tamanho: política é página, não livro. */
const LIMITE_CORPO = 20_000;

export async function POST(request: Request) {
  const { s, erro } = await exigir("configuracoes");
  if (erro) return erro;
  const loja = s.tenant;

  const corpo = (await request.json().catch(() => null)) as
    | { acao?: string; tipo?: string; corpo?: string; regras?: unknown }
    | null;
  const acao = corpo?.acao ?? "salvar";

  if (acao === "regras") {
    // O leitor já corrige o que vier fora da faixa — inclusive prazo abaixo do
    // piso legal. Gravar o resultado dele, e não a entrada, é o que impede uma
    // chamada direta na API de publicar política ilegal.
    const regras = lerRegrasDevolucao(corpo?.regras);
    await prisma.tenant.update({
      where: { id: loja.id },
      data: { regrasDevolucao: regras as unknown as Prisma.InputJsonValue },
    });
    return Response.json({ regras });
  }

  const tipo = corpo?.tipo as TipoPolitica | undefined;
  if (!tipo || !TIPOS_POLITICA.includes(tipo)) {
    return Response.json({ erro: "Política desconhecida." }, { status: 422 });
  }

  const escritas = lerPoliticasEscritas(loja.politicas);

  if (acao === "restaurar") {
    delete escritas[tipo];
    await prisma.tenant.update({
      where: { id: loja.id },
      data: { politicas: escritas as unknown as Prisma.InputJsonValue },
    });
    return Response.json({ restaurado: true, modelo: modeloDePolitica(loja, tipo).join("\n\n") });
  }

  const texto = (corpo?.corpo ?? "").trim();
  if (texto.length > LIMITE_CORPO) {
    return Response.json({ erro: `Texto muito longo: o limite é de ${LIMITE_CORPO.toLocaleString("pt-BR")} caracteres.` }, { status: 422 });
  }

  // Salvar em branco é o mesmo pedido que restaurar: some o texto próprio e
  // volta o modelo. O lojista não fica com uma política vazia no ar.
  if (!texto) delete escritas[tipo];
  else escritas[tipo] = { corpo: texto, atualizadoEm: new Date().toISOString() };

  await prisma.tenant.update({
    where: { id: loja.id },
    data: { politicas: escritas as unknown as Prisma.InputJsonValue },
  });
  return Response.json({ salvo: true, propria: Boolean(escritas[tipo]) });
}
