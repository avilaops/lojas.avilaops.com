import { prisma } from "@/lib/db";
import { autorizado,naoAutorizado } from "@/lib/admin-auth";
import { INCLUIR_CATALOGO,diagnosticarProduto } from "@/lib/catalogo-qualidade";
type Ctx={params:Promise<{slug:string}>};

/** Leitura oficial para automações; não depende das projeções do produto. */
export async function GET(request:Request,{params}:Ctx) {
  if(!autorizado(request))return naoAutorizado();
  const {slug}=await params;
  const t=await prisma.tenant.findUnique({where:{slug},select:{id:true}});
  if(!t)return Response.json({erro:"Loja não encontrada."},{status:404});
  const q=new URL(request.url).searchParams;
  const produtos=await prisma.produto.findMany({where:{tenantId:t.id,...(q.get("produtoId")?{id:q.get("produtoId")!}:{})},include:INCLUIR_CATALOGO,orderBy:{id:"asc"},take:100,...(q.get("cursor")?{cursor:{id:q.get("cursor")!},skip:1}:{})});
  return Response.json({produtos:produtos.map(p=>({...p,qualidade:diagnosticarProduto(p)})),proximoCursor:produtos.length===100?produtos.at(-1)!.id:null});
}
