import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import sharp from "sharp";

const require = createRequire(import.meta.url);
type LerMarca = (chave: string) => Promise<Buffer>;

/** Executa a rota real; só a resolução de tenant e o armazenamento são fixtures. */
async function imagemDaRota(lerMarca: LerMarca): Promise<Response> {
  const codigo = await readFile(new URL("../app/opengraph-image.tsx", import.meta.url), "utf8");
  const javascript = ts.transpileModule(codigo, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const tenant = {
    slug: "brilhax", nome: "Marca de teste", slogan: "Prévia pública", faviconUrl: "/uploads/brilhax",
    logoUrl: null, dominioPrincipal: "marca.example",
  };
  const modulo = { exports: {} as { default?: () => Promise<Response> } };
  const carregar = (nome: string): unknown => {
    if (nome === "@/lib/tenant") return {
      tenantAtual: async () => tenant,
      temaDo: () => ({ corPrimaria: "#123456", corPrimariaTexto: "#ffffff" }),
      marcaQuadradaDa: () => "/uploads/brilhax/apple-touch-icon.png",
      urlDaLoja: () => "https://marca.example",
    };
    if (nome === "@/lib/tema") return { corTextoLegivel: () => "#ffffff" };
    if (nome === "@/lib/previa-loja") {
      const real = require("./previa-loja.ts") as {
        carregarMarcaDaPrevia: (dados: unknown, ler?: LerMarca) => Promise<string | null>;
      };
      return { carregarMarcaDaPrevia: (dados: unknown) => real.carregarMarcaDaPrevia(dados, lerMarca) };
    }
    return require(nome);
  };
  // O JavaScript vem exclusivamente do arquivo versionado desta rota no CI.
  new Function("require", "module", "exports", javascript)(carregar, modulo, modulo.exports);
  assert.ok(modulo.exports.default);
  return modulo.exports.default();
}

test("OG da rota real consome bytes públicos em ImageResponse e entrega PNG1200x630", async () => {
  const fixture = await sharp({ create: { width: 32, height: 32, channels: 4, background: "#ed2939" } }).png().toBuffer();
  const lidas: string[] = [];
  const resposta = await imagemDaRota(async chave => { lidas.push(chave); return fixture; });
  // Consumir o stream é essencial: o ImageResponse pode lançar só neste ponto.
  const bytes = Buffer.from(await resposta.arrayBuffer());
  const imagem = await sharp(bytes).metadata();
  assert.equal(resposta.status, 200);
  assert.match(resposta.headers.get("content-type") ?? "", /^image\/png/);
  assert.equal(imagem.format, "png");
  assert.equal(imagem.width, 1200);
  assert.equal(imagem.height, 630);
  assert.deepEqual(lidas, ["brilhax/apple-touch-icon.png"]);
});

test("OG da rota real permanece PNG quando a marca pública está ausente", async () => {
  const resposta = await imagemDaRota(async () => { throw Object.assign(new Error("ausente"), { code: "ENOENT" }); });
  const bytes = Buffer.from(await resposta.arrayBuffer());
  const imagem = await sharp(bytes).metadata();
  assert.equal(resposta.status, 200);
  assert.equal(imagem.format, "png");
  assert.equal(imagem.width, 1200);
  assert.equal(imagem.height, 630);
});
