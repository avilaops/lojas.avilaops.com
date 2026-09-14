import { prisma } from "../src/lib/db";
import { gerarHashSenha } from "../src/lib/sessao";
import { salvarProdutoNoCatalogo, salvarGradeNoCatalogo } from "../src/lib/catalogo-escrita";
const url=new URL(process.env.DATABASE_URL??"http://invalid");
if(url.hostname!=="127.0.0.1"||url.port!=="5548"||!url.pathname.endsWith("_test"))throw new Error("Somente banco QA isolado.");
async function main() {
  const t=await prisma.tenant.upsert({where:{slug:"catalogo-qa"},update:{},create:{slug:"catalogo-qa",nome:"Catálogo · teste local",status:"ATIVA",dominios:["127.0.0.1"],loginEmail:"catalogo@example.test",senhaHash:gerarHashSenha("CatalogoLocal2026!"),plano:"LOJA",mpAccessTokenEnc:"QA-SEM-CREDENCIAL",whatsapp:"5511999999999"}});
  const comum={descricao:"Produto fictício, usado exclusivamente para conferir o cadastro e a vitrine local.",marca:"Marca de teste",imagens:["http://127.0.0.1:3088/lojas-mark.svg"],estoque:4};
  const simples=await salvarProdutoNoCatalogo(t.id,null,{...comum,nome:"Produto QA apresentação única",slug:`simples-${Date.now()}`,sku:`QA-${Date.now()}`,precoCentavos:3990,gtin:"1234567890123"});
  const grade=await salvarProdutoNoCatalogo(t.id,null,{...comum,nome:"Produto QA com apresentações",slug:`grade-${Date.now()}`,precoCentavos:4990});
  const g=await salvarGradeNoCatalogo(t.id,grade.id,["Volume"],[{valores:{Volume:"500 ml"},sku:"QA-V500",precoCentavos:4990,estoque:3},{valores:{Volume:"5 litros"},sku:"QA-V5L",precoCentavos:12990,estoque:2,imagem:"http://127.0.0.1:3088/lojas-mark.svg"}]);
  console.log(JSON.stringify({tenantId:t.id,simples:{id:simples.id,slug:simples.slug},grade:{id:grade.id,slug:grade.slug,variantes:g.variantes.map(v=>({id:v.id,nome:v.nome}))}}));
}
main().finally(()=>prisma.$disconnect());
