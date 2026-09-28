import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ErroCampo,
  chaveDoRotulo,
  fichaPersonalizada,
  lerDefinicoes,
  lerValores,
  lerVideo,
  normalizarValor,
  normalizarValores,
  type CampoPersonalizado,
} from "./campos-personalizados";

const campo = (extra: Partial<CampoPersonalizado> = {}): CampoPersonalizado => ({
  chave: "safra",
  rotulo: "Safra",
  tipo: "texto",
  estado: "ativo",
  ...extra,
});

test("chave sai do rótulo sem acento nem símbolo", () => {
  assert.equal(chaveDoRotulo("Rendimento por litro"), "rendimento-por-litro");
  assert.equal(chaveDoRotulo("Graduação alcoólica (%)"), "graduacao-alcoolica");
  assert.equal(chaveDoRotulo("  ---  "), "");
});

test("definição inválida some da lista em vez de derrubar a página", () => {
  const lidas = lerDefinicoes([
    { chave: "safra", rotulo: "Safra", tipo: "texto", estado: "ativo" },
    { rotulo: "Sem tipo" },
    { rotulo: "Tipo inventado", tipo: "holograma" },
    // Lista de opções sem opção não é campo: não há o que escolher.
    { rotulo: "Corpo", tipo: "escolha", opcoes: [] },
    // Chave repetida: fica a primeira.
    { chave: "safra", rotulo: "Safra de novo", tipo: "numero" },
  ]);
  assert.deepEqual(lidas.map((c) => c.chave), ["safra"]);
  assert.equal(lidas[0].rotulo, "Safra");
  assert.deepEqual(lerDefinicoes(null), []);
  assert.deepEqual(lerDefinicoes({ safra: "x" }), []);
});

test("estado padrão é rascunho: campo novo não vaza para a vitrine sem decisão", () => {
  assert.equal(lerDefinicoes([{ rotulo: "Safra", tipo: "texto" }])[0].estado, "rascunho");
});

test("número aceita vírgula e guarda com ponto", () => {
  assert.equal(normalizarValor(campo({ tipo: "numero" }), "12,5"), "12.5");
  assert.equal(normalizarValor(campo({ tipo: "numero" }), "1.200,50"), "1200.5");
  assert.throws(() => normalizarValor(campo({ tipo: "numero" }), "doze"), ErroCampo);
});

test("escolha só aceita o que está na lista, ignorando caixa", () => {
  const c = campo({ tipo: "escolha", opcoes: ["Seco", "Meio seco"] });
  assert.equal(normalizarValor(c, "seco"), "Seco");
  assert.throws(() => normalizarValor(c, "Doce"), ErroCampo);
});

/**
 * O que impede um campo de link virar XSS na loja de um cliente: nada além de
 * http(s) entra. Se este teste passar a falhar, o painel virou vetor.
 */
test("link só aceita http e https", () => {
  const c = campo({ tipo: "url" });
  assert.equal(normalizarValor(c, "https://fabricante.com/manual.pdf"), "https://fabricante.com/manual.pdf");
  assert.throws(() => normalizarValor(c, "javascript:alert(1)"), ErroCampo);
  assert.throws(() => normalizarValor(c, "data:text/html,<script>"), ErroCampo);
  assert.throws(() => normalizarValor(c, "manual.pdf"), ErroCampo);
});

test("vídeo lê as formas que as pessoas realmente colam", () => {
  const embedYt = "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ";
  for (const url of [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
  ]) {
    assert.equal(lerVideo(url)?.embed, embedYt, url);
  }
  assert.equal(lerVideo("https://vimeo.com/123456789")?.embed, "https://player.vimeo.com/video/123456789");
  // Qualquer outro host devolve null: é o que impede <iframe> arbitrário.
  assert.equal(lerVideo("https://exemplo.com/video.mp4"), null);
  assert.equal(lerVideo("javascript:alert(1)"), null);
  assert.equal(lerVideo(""), null);
});

test("valor de campo apagado não fica pendurado no produto", () => {
  const definicoes = [campo({ chave: "safra", rotulo: "Safra" })];
  const valores = normalizarValores(definicoes, { safra: "2019", campoQueSumiu: "sobra" });
  assert.deepEqual(valores, { safra: "2019" });
});

test("valor vazio apaga em vez de gravar string em branco", () => {
  assert.equal(normalizarValor(campo(), "   "), null);
  assert.deepEqual(normalizarValores([campo()], { safra: "" }), {});
  assert.deepEqual(lerValores({ safra: "  ", outro: null }), {});
});

test("a ficha publica só campo ativo e preenchido, na ordem da loja", () => {
  const definicoes = [
    campo({ chave: "safra", rotulo: "Safra", tipo: "numero" }),
    campo({ chave: "organico", rotulo: "Orgânico", tipo: "booleano" }),
    campo({ chave: "premio", rotulo: "Prêmio", estado: "rascunho" }),
    campo({ chave: "vazio", rotulo: "Vazio" }),
  ];
  const linhas = fichaPersonalizada(definicoes, { safra: "2019", organico: "sim", premio: "Ouro" });
  assert.deepEqual(linhas.map((l) => l.rotulo), ["Safra", "Orgânico"]);
  assert.equal(linhas[0].valor, "2019");
  assert.equal(linhas[1].valor, "Sim");
});

test("unidade e data aparecem como o brasileiro lê", () => {
  const linhas = fichaPersonalizada(
    [
      campo({ chave: "rendimento", rotulo: "Rendimento", tipo: "numero", unidade: "m²/L" }),
      campo({ chave: "validade", rotulo: "Validade", tipo: "data" }),
    ],
    { rendimento: "12.5", validade: "2027-03-01" },
  );
  assert.equal(linhas[0].valor, "12,5 m²/L");
  assert.equal(linhas[1].valor, "01/03/2027");
});

/**
 * Safra, ano de fabricação e número de série são o que mais se cadastra como
 * número numa loja, e "2.019" é leitura errada. Agrupar só a partir de 10.000
 * atende os dois casos sem pedir ao lojista que escolha o tipo "certo".
 */
test("número só ganha separador de milhar quando ele ajuda a ler", () => {
  const linhas = fichaPersonalizada(
    [
      campo({ chave: "safra", rotulo: "Safra", tipo: "numero" }),
      campo({ chave: "pecas", rotulo: "Peças", tipo: "numero" }),
    ],
    { safra: "2019", pecas: "12500" },
  );
  assert.equal(linhas[0].valor, "2019");
  assert.equal(linhas[1].valor, "12.500");
});

test("vídeo que deixou de ser válido não vira iframe quebrado", () => {
  const definicoes = [campo({ chave: "demo", rotulo: "Demonstração", tipo: "video" })];
  assert.deepEqual(fichaPersonalizada(definicoes, { demo: "https://exemplo.com/x" }), []);
  const ok = fichaPersonalizada(definicoes, { demo: "https://youtu.be/dQw4w9WgXcQ" });
  assert.equal(ok[0].video?.plataforma, "youtube");
});
