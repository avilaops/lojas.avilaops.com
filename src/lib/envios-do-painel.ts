/**
 * O que as rotas de envio do painel fazem depois de conferir a sessão:
 * `POST /api/painel/imagens` e `POST /api/painel/produtos/planilha`.
 *
 * Mora aqui, e não no `route.ts`, para a ordem das barreiras ficar presa em
 * `npm test`: 413 pelo `content-length` **antes** de `formData()`, que lê o
 * corpo inteiro para a memória, e o teto do painel antes de entregar a foto ao
 * removedor de fundo. Módulo leve pela mesma razão de `limites-upload.ts`: o
 * que grava, otimiza e recorta chega por parâmetro, e nada daqui importa
 * `uploads.ts`, `fundo.ts` nem o Prisma.
 */
import { lerCsvProdutos, produtosDeLinhas } from "./planilha-produtos";
import { ErroPlanilha, linhasDeXlsx } from "./xlsx-leitor";
import { TETO_IMAGEM_BYTES, TETO_PLANILHA_BYTES, UploadInvalido, corpoAcimaDoTeto } from "./limites-upload";

/** O que estas funções usam do `Request`. */
export type PedidoDeEnvio = Pick<Request, "headers" | "url" | "formData">;

export interface ServicosDeImagem {
  /** Produto da loja com este SKU, ou nulo. */
  produtoPorSku(tenantId: string, sku: string): Promise<{ id: string; nome: string; imagens: string[] } | null>;
  salvarImagem(slug: string, arquivo: File): Promise<{ url: string }>;
  salvarBytes(slug: string, bytes: Buffer, ext: string): Promise<{ url: string }>;
  removedorConfigurado(): boolean;
  removerFundo(bytes: Buffer): Promise<Buffer>;
  /** Falha do removedor que o lojista contorna enviando sem tratamento. */
  eFundoIndisponivel(erro: unknown): erro is Error;
}

const IMAGEM_GRANDE = "Imagem acima de 5 MB.";

export async function receberImagem(request: PedidoDeEnvio, loja: { id: string; slug: string }, servicos: ServicosDeImagem): Promise<Response> {
  // Antes de `formData()`, que lê o corpo inteiro para a memória.
  if (corpoAcimaDoTeto(request, TETO_IMAGEM_BYTES)) return Response.json({ erro: IMAGEM_GRANDE }, { status: 413 });

  const form = await request.formData().catch(() => null);
  const arquivo = form?.get("arquivo");
  if (!(arquivo instanceof File)) return Response.json({ erro: "Envie um arquivo no campo 'arquivo'." }, { status: 400 });
  const sku = String(form?.get("sku") ?? "").trim();
  const produto = sku ? await servicos.produtoPorSku(loja.id, sku) : null;
  if (sku && !produto) return Response.json({ erro: `SKU ${sku} não encontrado nesta loja.` }, { status: 404 });
  if (produto?.imagens.length) return Response.json({ erro: `${sku}: o produto já tem foto principal. Remova ou revise a foto no cadastro antes de enviar outra.` }, { status: 409 });

  const tratar = new URL(request.url).searchParams.get("tratar") === "1";
  try {
    if (!tratar) {
      const r = await servicos.salvarImagem(loja.slug, arquivo);
      return Response.json({ url: r.url, tratada: false, ...(produto ? { sku, produto: produto.nome, produtoId: produto.id } : {}) });
    }
    if (!servicos.removedorConfigurado()) return Response.json({ erro: "Tratamento de imagem indisponível nesta instalação." }, { status: 503 });
    // O removedor aceita até 30 MB (tem outros chamadores); o painel, 5 MB.
    if (arquivo.size > TETO_IMAGEM_BYTES) return Response.json({ erro: IMAGEM_GRANDE }, { status: 422 });
    const bytes = Buffer.from(await arquivo.arrayBuffer());
    const recortada = await servicos.removerFundo(bytes);
    const r = await servicos.salvarBytes(loja.slug, recortada, "webp");
    return Response.json({ url: r.url, tratada: true });
  } catch (erro) {
    if (erro instanceof UploadInvalido) return Response.json({ erro: erro.message }, { status: 422 });
    if (servicos.eFundoIndisponivel(erro)) return Response.json({ erro: `${erro.message} Envie a foto sem tratamento.` }, { status: 503 });
    console.error("[imagens]", erro);
    return Response.json({ erro: "Não foi possível salvar a imagem." }, { status: 500 });
  }
}

const PLANILHA_GRANDE = "Arquivo muito grande (máximo 12 MB). Divida a planilha em partes.";

export async function previaDaPlanilha(request: PedidoDeEnvio): Promise<Response> {
  // Antes de `formData()`, que lê o corpo inteiro para a memória.
  if (corpoAcimaDoTeto(request, TETO_PLANILHA_BYTES)) return Response.json({ erro: PLANILHA_GRANDE }, { status: 413 });

  const formulario = await request.formData().catch(() => null);
  const arquivo = formulario?.get("arquivo");
  if (!(arquivo instanceof File)) return Response.json({ erro: "Nenhum arquivo enviado." }, { status: 422 });
  if (arquivo.size > TETO_PLANILHA_BYTES) return Response.json({ erro: PLANILHA_GRANDE }, { status: 413 });

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
