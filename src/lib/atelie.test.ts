import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { PALETA_ATELIE, resolverLooks, secoesDoAtelie, textoDoSobre } from "./atelie";
import { layoutsOferecidos, recusarLayoutBloqueado, temaNaVitrine, templateAtelieLigado } from "./flags";
import { contraste, lerTema, TemaSchema, VALORES_LAYOUT } from "./tema";

const LIGADO = { LOJAS_TEMPLATE_ATELIE: "1" };
const DESLIGADO = { LOJAS_TEMPLATE_ATELIE: "" };

function arquivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = join(dir, entrada.name);
    if (entrada.isDirectory()) return arquivos(caminho);
    return /\.(ts|tsx|css|js|mjs)$/.test(entrada.name) && !entrada.name.endsWith(".test.ts") ? [caminho] : [];
  });
}

test("a bandeira do Ateliê nasce desligada e só liga em 1, true ou on", () => {
  assert.equal(templateAtelieLigado({}), false);
  assert.equal(templateAtelieLigado(DESLIGADO), false);
  for (const valor of ["0", "false", "off", "sim", "yes"]) {
    assert.equal(templateAtelieLigado({ LOJAS_TEMPLATE_ATELIE: valor }), false, valor);
  }
  for (const valor of ["1", "true", "on", "TRUE", " On "]) {
    assert.equal(templateAtelieLigado({ LOJAS_TEMPLATE_ATELIE: valor }), true, valor);
  }
  assert.equal(layoutsOferecidos(DESLIGADO).some((layout) => layout.valor === "atelie"), false);
  assert.equal(layoutsOferecidos(LIGADO).some((layout) => layout.valor === "atelie"), true);
  assert.equal(layoutsOferecidos(LIGADO).length, VALORES_LAYOUT.length);
});

test("trocar para Ateliê com a bandeira desligada é recusado; loja que já está nele continua salvando", () => {
  const classico = lerTema({ layout: "classico", corPrimaria: "#112233" });
  const atelie = lerTema({ layout: "atelie", corPrimaria: "#112233" });
  assert.equal(recusarLayoutBloqueado(classico, "atelie", false), "O modelo Ateliê não está disponível.");
  assert.equal(recusarLayoutBloqueado(atelie, "atelie", false), null);
  assert.equal(recusarLayoutBloqueado(classico, "editorial", false), null);
  assert.equal(recusarLayoutBloqueado(classico, "atelie", true), null);
  assert.equal(recusarLayoutBloqueado(classico, undefined, false), null);
});

test("a loja publicada desenha o Clássico quando o Ateliê está desligado", () => {
  const tema = lerTema({
    layout: "atelie",
    corPrimaria: "#7c4f3e",
    heroTitulo: "Coleção Brisa",
    atelie: { sobre: "Peças leves." },
  });
  const escondido = temaNaVitrine(tema, false);
  assert.equal(escondido.layout, "classico");
  assert.equal(escondido.corPrimaria, "#7c4f3e");
  assert.equal(escondido.heroTitulo, "Coleção Brisa");
  assert.equal(escondido.atelie?.sobre, "Peças leves.");
  assert.equal(temaNaVitrine(tema, true).layout, "atelie");
  assert.equal(temaNaVitrine(lerTema({ layout: "vitrine" }), false).layout, "vitrine");
});

test("tema antigo continua válido e o Ateliê entra só quando o dono escolhe", () => {
  const antigo = lerTema({ corPrimaria: "#0f766e", fonte: "inter", raio: "suave", layout: "classico" });
  assert.equal(antigo.layout, "classico");
  assert.equal(antigo.fonte, "inter");
  assert.equal(antigo.atelie, undefined);
  const novo = TemaSchema.parse({
    layout: "atelie",
    fonte: "dm-serif",
    atelie: {
      secoes: ["lookbook", "hero", "hero"],
      looks: [{ titulo: "Look 01", imagem: "/media/atelie/look-01.svg", produtos: ["vestido-duna-midi", "bolsa-palha-media"] }],
    },
  });
  assert.equal(novo.layout, "atelie");
  assert.equal(TemaSchema.safeParse({
    layout: "atelie",
    atelie: { looks: [{ titulo: "Look", imagem: "/look.svg", produtos: ["a", "a"] }] },
  }).success, false);
});

test("seções omitidas entram todas, vazias somem e repetidas contam uma vez", () => {
  assert.deepEqual(secoesDoAtelie({}), ["hero", "categorias", "destaques", "lookbook", "sobre"]);
  assert.deepEqual(secoesDoAtelie({ atelie: { secoes: [] } }), []);
  assert.deepEqual(secoesDoAtelie({ atelie: { secoes: ["sobre", "hero", "sobre"] } }), ["sobre", "hero"]);
});

test("look sem foto ou com menos de duas peças existentes fica de fora", () => {
  const catalogo = [
    { slug: "vestido-duna-midi", nome: "Vestido Duna midi" },
    { slug: "bolsa-palha-media", nome: "Bolsa Palha média" },
    { slug: "camisa-mare-linho", nome: "Camisa Maré linho" },
  ];
  const tema = {
    atelie: {
      looks: [
        { titulo: "Look 01", imagem: "/media/atelie/look-01.svg", produtos: ["vestido-duna-midi", "bolsa-palha-media", "sumiu"] },
        { titulo: "Sem foto", imagem: "", produtos: ["vestido-duna-midi", "camisa-mare-linho"] },
        { titulo: "Uma peça", imagem: "/media/atelie/look-02.svg", produtos: ["camisa-mare-linho", "nao-existe"] },
      ],
    },
  };
  const looks = resolverLooks(tema, catalogo);
  assert.equal(looks.length, 1);
  assert.deepEqual(looks[0].produtos.map((produto) => produto.slug), ["vestido-duna-midi", "bolsa-palha-media"]);
  assert.equal(textoDoSobre({}, "  ", "Do cadastro"), "Do cadastro");
  assert.equal(textoDoSobre({ atelie: { sobre: "Da home" } }, "Do tenant", "Do cadastro"), "Da home");
});

test("a paleta sugerida do Ateliê passa no contraste de texto", () => {
  assert.ok(contraste(PALETA_ATELIE.corPrimaria, PALETA_ATELIE.corPrimariaTexto) >= 4.5);
  assert.ok(contraste(PALETA_ATELIE.corFundo, PALETA_ATELIE.corTexto) >= 4.5);
});

test("a serifa do Ateliê é arquivo nosso e a vitrine não pede o Google Fonts", () => {
  const fontes = readFileSync("src/lib/fontes-loja.ts", "utf8");
  assert.match(fontes, /dm-serif-display-latin-400-normal\.woff2/);
  assert.equal(fontes.includes("fonts.googleapis.com"), false);
  const woff = readFileSync("src/fonts/dm-serif-display-latin-400-normal.woff2");
  assert.equal(woff.subarray(0, 4).toString("ascii"), "wOF2");
  for (const arquivo of arquivos("src")) {
    assert.equal(readFileSync(arquivo, "utf8").includes("fonts.googleapis.com"), false, arquivo);
  }
});

test("painel, conector e vitrine passam pela bandeira", () => {
  assert.match(readFileSync("src/app/page.tsx", "utf8"), /temaNaVitrine/);
  assert.match(readFileSync("src/app/layout.tsx", "utf8"), /temaNaVitrine/);
  assert.match(readFileSync("src/app/plataforma/(previa)/painel/previa/page.tsx", "utf8"), /familiaHospedada/);
  assert.equal(readFileSync("src/app/plataforma/(previa)/painel/previa/page.tsx", "utf8").includes("fonts.googleapis.com"), false);
  for (const arquivo of [
    "src/app/api/painel/loja/route.ts",
    "src/app/api/admin/tenants/[slug]/route.ts",
    "src/lib/mcp-tools.ts",
  ]) {
    assert.match(readFileSync(arquivo, "utf8"), /recusarLayoutBloqueado/, arquivo);
  }
});
