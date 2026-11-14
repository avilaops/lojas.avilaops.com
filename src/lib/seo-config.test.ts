import test from "node:test";
import assert from "node:assert/strict";
import { SeoConfiguracaoEntradaSchema, lerConfiguracaoSeo, mesclarConfiguracaoSeo, metadadosSeo, orientacoesSeo, opcoesResumoIa } from "./seo-config";

test("lojas existentes mantêm os padrões atuais mesmo sem configuração", () => {
  for (const entrada of [undefined, null, {}, []]) {
    assert.deepEqual(lerConfiguracaoSeo(entrada), { tituloInicio: "", descricaoInicio: "", incluirDestaques: true, limiteDestaques: 12 });
  }
});

test("leitura de dados antigos inválidos usa padrões sem quebrar a página", () => {
  const config = lerConfiguracaoSeo({ tituloInicio: 18, descricaoInicio: "Resumo válido.", incluirDestaques: "não", limiteDestaques: -1 });
  assert.equal(config.tituloInicio, "");
  assert.equal(config.descricaoInicio, "Resumo válido.");
  assert.equal(config.incluirDestaques, true);
  assert.equal(config.limiteDestaques, 12);
});

test("PATCH parcial mantém os demais campos e aceita desligar destaques", () => {
  const config = mesclarConfiguracaoSeo({ tituloInicio: "Empresa Exemplo • Catálogo", incluirDestaques: true, limiteDestaques: 8 }, { incluirDestaques: false });
  assert.equal(config.tituloInicio, "Empresa Exemplo • Catálogo");
  assert.equal(config.limiteDestaques, 8);
  assert.equal(config.incluirDestaques, false);
  assert.throws(() => mesclarConfiguracaoSeo(config, { limiteDestaques: 100 }));
});

test("contrato recusa chaves externas, HTML, limites inválidos e coerção de booleano", () => {
  for (const entrada of [{ slug: "outra-loja" }, { tituloInicio: "x".repeat(121) }, { descricaoInicio: "x".repeat(321) }, { tituloInicio: "<script>texto</script>" }, { incluirDestaques: "false" }, { limiteDestaques: 0 }, { limiteDestaques: 21 }, { limiteDestaques: 1.5 }]) {
    assert.equal(SeoConfiguracaoEntradaSchema.safeParse(entrada).success, false);
  }
  assert.deepEqual(SeoConfiguracaoEntradaSchema.parse({ tituloInicio: "  Empresa Exemplo  " }), { tituloInicio: "Empresa Exemplo" });
});

test("metadados manuais são exatos e valores vazios restauram os automáticos", () => {
  const automaticos = { titulo: "Empresa Exemplo • Produtos", descricao: "Descrição automática do catálogo da empresa." };
  assert.deepEqual(metadadosSeo({ tituloInicio: "Título próprio", descricaoInicio: "Resumo próprio" }, automaticos), { titulo: "Título próprio", descricao: "Resumo próprio" });
  assert.deepEqual(metadadosSeo({ tituloInicio: "", descricaoInicio: "" }, automaticos), automaticos);
});

test("resumo pode retirar produtos sem alterar o limite salvo nem os demais conteúdos", () => {
  assert.deepEqual(opcoesResumoIa({ incluirDestaques: false, limiteDestaques: 8 }), { limiteDestaques: 0 });
  assert.deepEqual(opcoesResumoIa({ incluirDestaques: true, limiteDestaques: 8 }), { limiteDestaques: 8 });
  assert.deepEqual(opcoesResumoIa({}), { limiteDestaques: 12 });
});

test("orientações explicam redação sem inventar pontuação ou aprovação do Google", () => {
  const adequados = orientacoesSeo({ titulo: "Empresa Exemplo • Peças para sua operação", descricao: "Conheça as peças e os serviços da Empresa Exemplo. Consulte o catálogo, compare referências e fale com a equipe para escolher a solução adequada." });
  assert.ok(adequados.every(item => item.estado === "ok"));
  const revisar = orientacoesSeo({ titulo: "X", descricao: "Curta" });
  assert.ok(revisar.some(item => item.estado === "atencao"));
  assert.doesNotMatch(JSON.stringify(adequados), /pontua[cç][aã]o|indexa[cç][aã]o garantida|100\/100/i);
});
