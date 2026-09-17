import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { TemaSchema, lerTema, LAYOUTS } from "./tema";
import { TEMA_PREMIUM_DEMONSTRACAO } from "./tema-demonstracao";

test("o premium é selecionável sem trocar o padrão das outras lojas",()=>{
  assert.equal(lerTema({}).layout,"classico");
  assert.ok(LAYOUTS.some(l=>l.valor==="automotivo-premium"));
  assert.equal(lerTema({layout:"automotivo-premium"}).layout,"automotivo-premium");
  assert.equal(lerTema({layout:"automotivo"}).layout,"automotivo");
});
test("conteúdo completo do template passa pelo schema sem perder campo",()=>{
  assert.deepEqual(TemaSchema.parse(TEMA_PREMIUM_DEMONSTRACAO),TEMA_PREMIUM_DEMONSTRACAO);
  // Campo novo no schema sem entrada na demonstração é campo que ninguém
  // preenche, ninguém revisa e nenhum teste exercita.
  const noSchema=Object.keys(TemaSchema.shape.premium.unwrap().shape).sort();
  assert.deepEqual(Object.keys(TEMA_PREMIUM_DEMONSTRACAO.premium!).sort(),noSchema);
});
test("o plano de identidade preparado para uma loja, quando existe, continua válido",()=>{
  // Fica fora do repositório (é conteúdo de cliente, gerado por
  // `scripts/premium-preparar-assets.cjs`). Na máquina de quem preparou a
  // loja, o teste confere; num clone limpo, não há o que conferir.
  const caminho="output/premium/plano-identidade.json";
  if(!existsSync(caminho)) return;
  const plano=JSON.parse(readFileSync(caminho,"utf8"));
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
