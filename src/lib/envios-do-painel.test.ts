import { test } from "node:test";
import assert from "node:assert/strict";
import { previaDaPlanilha, receberImagem, type PedidoDeEnvio, type ServicosDeImagem } from "./envios-do-painel";
import { FOLGA_MULTIPART_BYTES, TETO_IMAGEM_BYTES, TETO_PLANILHA_BYTES, UploadInvalido } from "./limites-upload";

const LOJA = { id: "loja-1", slug: "loja-teste" };

class FundoFora extends Error {}

/** Serviços que anotam o que foi chamado; nenhum toca em disco, banco ou modelo. */
function servicos(mudancas: Partial<ServicosDeImagem> = {}) {
  const chamados: string[] = [];
  const s: ServicosDeImagem = {
    produtoPorSku: async () => (chamados.push("produtoPorSku"), null),
    salvarImagem: async () => (chamados.push("salvarImagem"), { url: "https://loja.test/uploads/a.webp" }),
    salvarBytes: async () => (chamados.push("salvarBytes"), { url: "https://loja.test/uploads/b.webp" }),
    removedorConfigurado: () => true,
    removerFundo: async (bytes) => (chamados.push("removerFundo"), bytes),
    eFundoIndisponivel: (e): e is Error => e instanceof FundoFora,
    ...mudancas,
  };
  return { s, chamados };
}

/** Pedido que só declara o tamanho: se alguém ler o corpo, o teste fica sabendo. */
function soCabecalho(caminho: string, contentLength: string | null) {
  let leuOCorpo = false;
  const pedido: PedidoDeEnvio = {
    url: `https://loja.test${caminho}`,
    headers: new Headers(contentLength === null ? {} : { "content-length": contentLength }),
    formData: async () => {
      leuOCorpo = true;
      return new FormData();
    },
  };
  return { pedido, leuOCorpo: () => leuOCorpo };
}

/** Pedido multipart de verdade, com um arquivo do tamanho pedido. */
function comArquivo(caminho: string, nome: string, conteudo: BlobPart, campos: Record<string, string> = {}): Request {
  const form = new FormData();
  form.set("arquivo", new File([conteudo], nome));
  for (const [chave, valor] of Object.entries(campos)) form.set(chave, valor);
  return new Request(`https://loja.test${caminho}`, { method: "POST", body: form });
}

const corpo = async (r: Response) => (await r.json()) as Record<string, unknown>;

test("imagens: content-length acima do teto devolve 413 sem ler o corpo", async () => {
  const { pedido, leuOCorpo } = soCabecalho("/api/painel/imagens", String(TETO_IMAGEM_BYTES + FOLGA_MULTIPART_BYTES + 1));
  const { s, chamados } = servicos();

  const r = await receberImagem(pedido, LOJA, s);

  assert.equal(r.status, 413);
  assert.deepEqual(await corpo(r), { erro: "Imagem acima de 5 MB." });
  assert.equal(leuOCorpo(), false);
  assert.deepEqual(chamados, []);
});

test("imagens: o 413 vale também com ?tratar=1", async () => {
  const { pedido, leuOCorpo } = soCabecalho("/api/painel/imagens?tratar=1", String(30 * 1024 * 1024));
  const { s, chamados } = servicos();

  assert.equal((await receberImagem(pedido, LOJA, s)).status, 413);
  assert.equal(leuOCorpo(), false);
  assert.deepEqual(chamados, []);
});

test("imagens: content-length no limite da folga, ou ausente, segue para a leitura", async () => {
  for (const tamanho of [String(TETO_IMAGEM_BYTES + FOLGA_MULTIPART_BYTES), null]) {
    const { pedido, leuOCorpo } = soCabecalho("/api/painel/imagens", tamanho);
    const r = await receberImagem(pedido, LOJA, servicos().s);
    // Formulário vazio: passou da barreira e parou na falta do arquivo.
    assert.equal(r.status, 400);
    assert.equal(leuOCorpo(), true);
  }
});

test("imagens: ?tratar=1 com arquivo acima de 5 MB devolve 422 antes do removedor de fundo", async () => {
  // Um byte acima do teto: cabe na folga do multipart, então passa pelo 413.
  const pedido = comArquivo("/api/painel/imagens?tratar=1", "foto.jpg", new Uint8Array(TETO_IMAGEM_BYTES + 1));
  const { s, chamados } = servicos();

  const r = await receberImagem(pedido, LOJA, s);

  assert.equal(r.status, 422);
  assert.deepEqual(await corpo(r), { erro: "Imagem acima de 5 MB." });
  assert.deepEqual(chamados, []);
});

test("imagens: ?tratar=1 com arquivo exatamente no teto é tratado e salvo", async () => {
  const pedido = comArquivo("/api/painel/imagens?tratar=1", "foto.jpg", new Uint8Array(TETO_IMAGEM_BYTES));
  const { s, chamados } = servicos();

  const r = await receberImagem(pedido, LOJA, s);

  assert.equal(r.status, 200);
  assert.deepEqual(await corpo(r), { url: "https://loja.test/uploads/b.webp", tratada: true });
  assert.deepEqual(chamados, ["removerFundo", "salvarBytes"]);
});

test("imagens: sem tratar, a recusa do gravador vira 422 e a falha do removedor vira 503", async () => {
  const recusa = servicos({ salvarImagem: async () => { throw new UploadInvalido("Imagem acima de 5 MB."); } });
  const r1 = await receberImagem(comArquivo("/api/painel/imagens", "foto.jpg", "x"), LOJA, recusa.s);
  assert.equal(r1.status, 422);
  assert.deepEqual(await corpo(r1), { erro: "Imagem acima de 5 MB." });

  const fora = servicos({ removerFundo: async () => { throw new FundoFora("Modelo fora do ar."); } });
  const r2 = await receberImagem(comArquivo("/api/painel/imagens?tratar=1", "foto.jpg", "x"), LOJA, fora.s);
  assert.equal(r2.status, 503);
  assert.deepEqual(await corpo(r2), { erro: "Modelo fora do ar. Envie a foto sem tratamento." });
});

test("imagens: SKU que não é da loja devolve 404 e nada é salvo", async () => {
  const { s, chamados } = servicos();
  const r = await receberImagem(comArquivo("/api/painel/imagens", "foto.jpg", "x", { sku: "ABC-1" }), LOJA, s);
  assert.equal(r.status, 404);
  assert.deepEqual(chamados, ["produtoPorSku"]);
});

test("planilha: content-length acima do teto devolve 413 sem ler o corpo", async () => {
  const { pedido, leuOCorpo } = soCabecalho("/api/painel/produtos/planilha", String(TETO_PLANILHA_BYTES + FOLGA_MULTIPART_BYTES + 1));

  const r = await previaDaPlanilha(pedido);

  assert.equal(r.status, 413);
  assert.deepEqual(await corpo(r), { erro: "Arquivo muito grande (máximo 12 MB). Divida a planilha em partes." });
  assert.equal(leuOCorpo(), false);
});

test("planilha: arquivo acima de 12 MB que passou pela folga devolve 413", async () => {
  const r = await previaDaPlanilha(comArquivo("/api/painel/produtos/planilha", "catalogo.csv", new Uint8Array(TETO_PLANILHA_BYTES + 1)));
  assert.equal(r.status, 413);
});

test("planilha: formato que não se lê devolve 422 dizendo o que fazer", async () => {
  const xls = await previaDaPlanilha(comArquivo("/api/painel/produtos/planilha", "catalogo.xls", "x"));
  assert.equal(xls.status, 422);
  assert.match(String((await corpo(xls)).erro), /\.xls é antigo/);

  const pdf = await previaDaPlanilha(comArquivo("/api/painel/produtos/planilha", "catalogo.pdf", "x"));
  assert.equal(pdf.status, 422);

  const { pedido } = soCabecalho("/api/painel/produtos/planilha", null);
  assert.equal((await previaDaPlanilha(pedido)).status, 422);
});

test("planilha: CSV pequeno vira prévia", async () => {
  const r = await previaDaPlanilha(comArquivo("/api/painel/produtos/planilha", "catalogo.csv", "nome,preco\nLimpador 500ml,49.90\n"));
  assert.equal(r.status, 200);
});
