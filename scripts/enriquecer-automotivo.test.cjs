const {test}=require("node:test");
const assert=require("node:assert/strict");
const {marcaDoNome,fichaDoNome,enriquecer}=require("./enriquecer-automotivo.cjs");
test("fabricante da roda não é a montadora da aplicação",()=>{
 assert.equal(marcaDoNome("RODA 20X9 ZEUS BMW X5 M 5X112 BP ET35","rodas"),"Zeus");
 assert.equal(marcaDoNome("RODA 16 ORIGINAL S10 5X120 PRATA","rodas"),null);
 assert.equal(marcaDoNome("RODA 20 IMPORT PORSCHE 5X130","rodas"),null);
});
test("código de fabricante tem prioridade sobre referência visual",()=>{
 assert.equal(marcaDoNome("RODA 20 PRZ1059 VOSSEN CVT 5X112","rodas"),"Presenza");
 assert.equal(marcaDoNome("RODA 17 BRW1130 4X100/108 PD","rodas"),"BRW");
 assert.equal(marcaDoNome("RODA 14 ZK140 4X100 PRATA","rodas"),"Zunky");
});
test("corrige grafias explícitas sem casar pedaços de palavras",()=>{
 assert.equal(marcaDoNome("PNEU 205/55/16 MICHELLIN PRIMACY 3 91V","pneus"),"Michelin");
 assert.equal(marcaDoNome("PNEU 205/55/16 BRIDGSTONE TURANZA","pneus"),"Bridgestone");
 assert.equal(marcaDoNome("RODA 18 MOTORCRAZY F5","rodas"),"Motorcrazy");
});
test("extrai tala, furação fracionária e offset negativo",()=>{
 const a=fichaDoNome("RODA 22X9,5 ZEUS 6X139,7 GRAFITE DIAMANTADA ET -44","rodas");
 assert.equal(a.aro,"22 polegadas");assert.equal(a.tala,"9,5 polegadas");
 assert.equal(a.furacao,"6x139,7");assert.equal(a.offset,"-44 mm");assert.equal(a.acabamento,"grafite diamantado");
});
test("preserva furação múltipla e não interpreta tala como furação",()=>{
 const a=fichaDoNome("RODA 20X10/11 BRW600 4X100/108 PRATA","rodas");
 assert.equal(a.tala,"10/11 polegadas");assert.equal(a.furacao,"4x100/108");
 assert.equal(fichaDoNome("RODA 20X10 ORIGINAL","rodas").furacao,undefined);
});
test("não presume material, acabamento abreviado ou embalagem",()=>{
 const a=fichaDoNome("RODA 17 BRW1130 4X100 PD","rodas");
 assert.equal(a.material,undefined);assert.equal(a.acabamento,undefined);
 assert.equal(a.pesoKg,undefined);assert.equal(a.alturaCm,undefined);
});
test("medida de pneu não vira dimensão de embalagem nem construção radial",()=>{
 const a=fichaDoNome("PNEU 205/55/16 MICHELIN PRIMACY 4 91V","pneus");
 assert.equal(a.aro,"16 polegadas");assert.equal(a.larguraPneu,"205 mm");assert.equal(a.perfilPneu,"55%");
 assert.equal(a.indiceCarga,"91");assert.equal(a.indiceVelocidade,"V");assert.equal(a.construcao,undefined);
});
test("carga dupla, reforço e run flat permanecem códigos declarados",()=>{
 const a=fichaDoNome("PNEU 225/70/15 OVATION XL RUN FLAT 112/110R","pneus");
 assert.equal(a.indiceCarga,"112/110");assert.equal(a.reforco,"XL / Extra Load");assert.equal(a.tecnologia,"Run flat");
});
test("preserva campos revisados e permite repetição sem novas alterações",()=>{
 const p={nome:"RODA 17 BRW1130 4X100 PD",marca:null,descricao:null,descricaoCurta:null,atributos:{_catalogoFonte:"origem"},categoria:{slug:"rodas"}};
 const data=enriquecer(p);assert.equal(data.marca,"BRW");assert.equal(data.gtin,undefined);
 assert.deepEqual(enriquecer({...p,...data}),{});
 const manual=enriquecer({...p,marca:"Marca conferida",descricao:"Texto revisado",descricaoCurta:"Resumo revisado",atributos:{aro:"18 polegadas"}});
 assert.equal(manual.marca,undefined);assert.equal(manual.descricao,undefined);assert.equal(manual.atributos.aro,"18 polegadas");
});

test("linha comercial não substitui fabricante declarado",()=>{
 assert.equal(marcaDoNome("PNEU 265/45/21 PROTOURA DAVANTI SPORT 108W","pneus"),"Davanti");
 assert.equal(marcaDoNome("PNEU 265/40/22 VELOCITA MASSIMO 106W XL","pneus"),"Massimo");
 assert.equal(marcaDoNome("PNEU 205/55/16 ECOVISION VI-682 91 V TL OVATION","pneus"),"Ovation");
 assert.equal(marcaDoNome("PNEU 225/70/15 ROADTOUR 100T","pneus"),null);
});
