import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TemaSchema, lerTema, LAYOUTS } from "./tema";

test("o premium é selecionável sem trocar o padrão das outras lojas",()=>{
  assert.equal(lerTema({}).layout,"classico");
  assert.ok(LAYOUTS.some(l=>l.valor==="automotivo-premium"));
  assert.equal(lerTema({layout:"automotivo-premium"}).layout,"automotivo-premium");
  assert.equal(lerTema({layout:"automotivo"}).layout,"automotivo");
});
/* A fixture é versionada de propósito: a versão antiga lia
 * `output/premium/plano-identidade.json`, gerado na máquina de quem montou a
 * primeira loja premium, e o teste falhava em qualquer checkout limpo. */
test("um tema premium preenchido inteiro atravessa o schema sem perder campo",()=>{
  const tema=JSON.parse(readFileSync("tests/fixtures/tema-premium-completo.json","utf8"));
  assert.deepEqual(TemaSchema.parse(tema),tema);
  assert.equal(Object.keys(tema.premium).length,12,"a fixture tem que cobrir todo o bloco premium");
});
test("URLs e slugs de conteúdo rejeitam execução e injeção",()=>{
  for(const url of ['javascript:alert(1)','data:text/html,foo','//externo.com/foto','/foto\"><script>']){
    assert.equal(TemaSchema.safeParse({premium:{editorialImagem:url}}).success,false,url);
  }
  assert.equal(TemaSchema.safeParse({premium:{etapas:[{categoria:'../painel',titulo:'Etapa',texto:'Texto',icone:'kits'}]}}).success,false);
  assert.equal(TemaSchema.safeParse({premium:{editorialImagem:'/media/editorial.webp'}}).success,true);
});
test("não existe identidade de tenant fixa nos componentes reutilizáveis",()=>{
  for(const nome of ['Home.tsx','Cabecalho.tsx','Categorias.tsx','CarrinhoLateral.tsx']){
    const s=readFileSync(`src/components/templates/automotivo-premium/${nome}`,'utf8');
    assert.equal(/brilhax|medusa|app\.brilhax|stripe/i.test(s),false,nome);
  }
});
