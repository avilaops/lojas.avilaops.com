import { z } from "zod";
import { prisma } from "@/lib/db";
import { autorizado,naoAutorizado } from "@/lib/admin-auth";
type Ctx={params:Promise<{slug:string}>};
async function tenant(slug:string){return prisma.tenant.findUnique({where:{slug},select:{id:true}});}

/** O n8n busca a fila; repetição é segura pelo id do evento + versão do produto. */
export async function GET(request:Request,{params}:Ctx) {
  if(!autorizado(request))return naoAutorizado();
  const t=await tenant((await params).slug);
  if(!t)return Response.json({erro:"Loja não encontrada."},{status:404});
  const eventos=await prisma.eventoCatalogo.findMany({where:{tenantId:t.id,processadoEm:null},orderBy:[{criadoEm:"asc"},{id:"asc"}],take:100});
  const produtos=await prisma.produto.findMany({where:{tenantId:t.id,id:{in:eventos.map(e=>e.produtoId)}},select:{id:true,versaoCatalogo:true}});
  return Response.json({eventos:eventos.map(e=>({...e,obsoleto:produtos.find(p=>p.id===e.produtoId)?.versaoCatalogo!==e.versao}))});
}

export async function POST(request:Request,{params}:Ctx) {
  if(!autorizado(request))return naoAutorizado();
  const t=await tenant((await params).slug);
  if(!t)return Response.json({erro:"Loja não encontrada."},{status:404});
  const r=z.object({eventoId:z.string(),versao:z.number().int().positive()}).safeParse(await request.json().catch(()=>null));
  if(!r.success)return Response.json({erro:"Evento inválido."},{status:422});
  const e=await prisma.eventoCatalogo.findFirst({where:{id:r.data.eventoId,tenantId:t.id,versao:r.data.versao}});
  if(!e)return Response.json({erro:"Evento não encontrado nesta loja."},{status:404});
  const resultado=await prisma.eventoCatalogo.updateMany({where:{id:e.id,tenantId:t.id,processadoEm:null},data:{processadoEm:new Date()}});
  return Response.json({ok:true,repetido:resultado.count===0});
}
