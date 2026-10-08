import { exigir } from "@/lib/operadores";
import { previaDaPlanilha } from "@/lib/envios-do-painel";

/**
 * POST /api/painel/produtos/planilha — o arquivo vira a prévia da importação.
 *
 * O painel lia o CSV no navegador e não sabia abrir .xlsx, que é justamente o
 * formato que a exportação oferece para preservar código e código de barras.
 * Aqui os dois formatos passam pelo mesmo leitor, e o que volta é o que o
 * lojista confere antes de gravar: quantos produtos entraram e que linhas
 * ficaram de fora.
 *
 * Nada é gravado neste caminho. Quem grava continua sendo o PUT de
 * `/api/painel/produtos`, depois que a pessoa confirma.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { erro } = await exigir("catalogo");
  if (erro) return erro;
  // As barreiras de tamanho e a leitura estão em `previaDaPlanilha`, com teste.
  return previaDaPlanilha(request);
}
