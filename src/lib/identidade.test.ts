import assert from "node:assert/strict";
import test from "node:test";
import { assinaturaDaMarca, criarDirecaoVisual, lerIdentidade, LIMITE_SLOGAN } from "./identidade";

test("gera direção tecnológica coerente a partir do diagnóstico", () => {
  const direcao = criarDirecaoVisual({
    segmento: "tecnologia",
    publico: "pequenas empresas que precisam vender melhor",
    diferencial: "implantação acompanhada e operação integrada",
    personalidade: ["tecnologica", "sofisticada"],
    tomDeVoz: "especialista",
    objetivo: "vender",
    estiloFotografico: "tecnico",
  }, "Loja Exemplo");
  assert.equal(direcao.tema.layout, "vitrine");
  assert.equal(direcao.tema.modo, "escuro");
  assert.equal(direcao.identidade.segmento, "tecnologia");
  assert.match(direcao.identidade.assinatura, /implantação acompanhada/);
  assert.match(direcao.identidade.direcaoFotografica, /Detalhes/);
});

test("normaliza identidade vazia com padrões seguros", () => {
  const identidade = lerIdentidade({});
  assert.equal(identidade.segmento, "outro");
  assert.deepEqual(identidade.personalidade, ["sofisticada"]);
  assert.match(identidade.corApoio, /^#[0-9a-f]{6}$/i);
});

/**
 * A assinatura vira o `slogan` da loja na criação, e o slogan cabe em 140. Um
 * diferencial longo (o campo aceita 300, e o rascunho automático usa quase
 * tudo) derrubava a publicação com 422 num campo que a pessoa deixou vazio.
 */
test("assinatura cabe no slogan mesmo com diferencial longo", () => {
  const diferencial = "Estoque conferido peça a peça, orientação técnica de quem monta, entrega no dia seguinte em toda a região e troca sem burocracia para quem compra errado";
  const assinatura = assinaturaDaMarca("Ferragens Aurora", diferencial, "acolhedora");
  assert.ok(assinatura.length <= LIMITE_SLOGAN, `assinatura com ${assinatura.length} caracteres`);
  assert.doesNotMatch(assinatura, /\s…$/);
});

test("diferencial curto vira assinatura com o nome da marca", () => {
  assert.equal(assinaturaDaMarca("Ferragens Aurora", "Entrega no mesmo dia.", "acolhedora"), "Ferragens Aurora: Entrega no mesmo dia.");
});

test("só a primeira frase do diferencial entra na assinatura", () => {
  assert.equal(
    assinaturaDaMarca("Aurora", "Entrega no mesmo dia. Também trocamos sem burocracia.", "acolhedora"),
    "Aurora: Entrega no mesmo dia.",
  );
});

test("sem diferencial, a assinatura nasce da personalidade", () => {
  const assinatura = assinaturaDaMarca("Aurora", "   ", "artesanal");
  assert.match(assinatura, /Aurora, uma experiência artesanal/);
  assert.ok(assinatura.length <= LIMITE_SLOGAN);
});

test("direção visual nunca gera assinatura maior que o slogan", () => {
  const direcao = criarDirecaoVisual({
    segmento: "casa",
    publico: "famílias reformando a casa",
    diferencial: "x".repeat(300),
    personalidade: ["acolhedora"],
    tomDeVoz: "proximo",
    objetivo: "vender",
    estiloFotografico: "produto",
  }, "Ferragens Aurora");
  assert.ok(direcao.identidade.assinatura.length <= LIMITE_SLOGAN);
});
