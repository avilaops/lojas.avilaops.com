import { readFileSync } from "node:fs";
import { PrismaClient, Prisma } from "@prisma/client";

const db = new PrismaClient();
async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if(url.hostname !== "127.0.0.1" || url.port !== "5548" || url.pathname !== "/lojas_template_premium_test") throw new Error("Este seed só aceita o banco de QA local isolado.");
  const antes = JSON.parse(readFileSync("output/premium/tenant-antes.json", "utf8"));
  const plano = JSON.parse(readFileSync("output/premium/plano-identidade.json", "utf8"));
  const {categorias, atualizadoEm: _data, ...tenant} = antes;
  void _data;
  await db.tenant.upsert({where:{id:tenant.id},create:{...tenant,...plano.campos,mpAccessTokenEnc:"QA_LOCAL_NAO_E_CREDENCIAL",mpPublicKey:null},update:{...plano.campos,mpAccessTokenEnc:"QA_LOCAL_NAO_E_CREDENCIAL",mpPublicKey:null}});
  for(const categoria of categorias){
    const campos = plano.categorias.find((c:{id:string})=>c.id===categoria.id);
    const data={...categoria,...campos};
    await db.categoria.upsert({where:{id:data.id},create:data,update:data});
  }
  const produtos=JSON.parse(readFileSync("output/catalogo-padrao/brilhax-catalogo-final.json","utf8"));
  for(const p of produtos){
    const {busca:_busca,...data}=p;
    void _busca;
    await db.produto.upsert({where:{id:p.id},create:data as Prisma.ProdutoUncheckedCreateInput,update:data});
  }
  await db.tenant.upsert({where:{slug:"qa-outra-loja"},create:{slug:"qa-outra-loja",nome:"Loja de teste isolada",status:"ATIVA",plano:"SITE",tema:{layout:"classico",corPrimaria:"#2563eb"}},update:{}});
  console.log(JSON.stringify({ambiente:url.pathname,produtos:await db.produto.count({where:{tenantId:tenant.id}}),ativo:await db.produto.count({where:{tenantId:tenant.id,ativo:true}}),template:plano.campos.tema.layout}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>db.$disconnect());
