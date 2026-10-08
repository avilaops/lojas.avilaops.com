import { exigir } from "@/lib/operadores";
import { lerCsvProdutos, produtosDeLinhas } from "@/lib/planilha-produtos";
import { ErroPlanilha, linhasDeXlsx } from "@/lib/xlsx-leitor";
import { TETO_PLANILHA_BYTES, corpoAcimaDoTeto } from "@/lib/limites-upload";

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

const GRANDE_DEMAIS = "Arquivo muito grande (máximo 12 MB). Divida a planilha em partes.";

export async function POST(request: Request) {
  const { erro } = await exigir("catalogo");
  if (erro) return erro;

  // Antes de `formData()`, que lê o corpo inteiro para a memória.
  if (corpoAcimaDoTeto(request, TETO_PLANILHA_BYTES)) return Response.json({ erro: GRANDE_DEMAIS }, { status: 413 });

  const formulario = await request.formData().catch(() => null);
  const arquivo = formulario?.get("arquivo");
  if (!(arquivo instanceof File)) return Response.json({ erro: "Nenhum arquivo enviado." }, { status: 422 });
  if (arquivo.size > TETO_PLANILHA_BYTES) return Response.json({ erro: GRANDE_DEMAIS }, { status: 413 });

  const nome = arquivo.name.toLowerCase();
  // O .xls antigo é outro formato (binário, anterior a 2007) e não é lido
  // aqui: recusar dizendo o que fazer é melhor que devolver planilha vazia.
  if (nome.endsWith(".xls")) {
    return Response.json({ erro: "O formato .xls é antigo. No Excel: Arquivo → Salvar como → Pasta de Trabalho do Excel (.xlsx)." }, { status: 422 });
  }

  if (!nome.endsWith(".xlsx") && !nome.endsWith(".csv")) {
    return Response.json({ erro: "Envie um arquivo .csv ou .xlsx." }, { status: 422 });
  }

  try {
    // O CSV passa pelo leitor que entende aspas com quebra de linha dentro;
    // os dois caminhos terminam em `produtosDeLinhas`.
    return Response.json(nome.endsWith(".xlsx")
      ? produtosDeLinhas(linhasDeXlsx(Buffer.from(await arquivo.arrayBuffer())))
      : lerCsvProdutos(await arquivo.text()));
  } catch (e) {
    if (e instanceof ErroPlanilha) return Response.json({ erro: e.message }, { status: 422 });
    return Response.json({ erro: "Não foi possível ler a planilha." }, { status: 422 });
  }
}
