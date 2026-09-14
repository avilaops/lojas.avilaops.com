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
test("conteúdo completo da identidade Brilhax passa pelo schema",()=>{
  const plano=JSON.parse(readFileSync("output/premium/plano-identidade.json","utf8"));
  assert.deepEqual(TemaSchema.parse(plano.campos.tema),plano.campos.tema);
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
