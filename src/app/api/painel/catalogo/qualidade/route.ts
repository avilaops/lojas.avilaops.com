import { prisma } from "@/lib/db";
import { exigir } from "@/lib/operadores";
import { INCLUIR_CATALOGO, diagnosticarProduto } from "@/lib/catalogo-qualidade";

export async function GET(request:Request) {
  const {s,erro}=await exigir("catalogo");
  if(erro) return erro;
  const id=new URL(request.url).searchParams.get("produtoId")??"";
  const p=await prisma.produto.findFirst({where:{id,tenantId:s.tenant.id},include:INCLUIR_CATALOGO});
  if(!p) return Response.json({erro:"Produto não encontrado."},{status:404});
  const ocorrencias=diagnosticarProduto(p);
  return Response.json({versao:p.versaoCatalogo,ocorrencias,validacaoLocal:ocorrencias.some(o=>o.severidade==="erro")?"COM_PENDENCIAS":"SEM_BLOQUEIOS_LOCAIS",
    canais:p.variantes.filter(v=>v.ativo).flatMap(v=>v.publicacoes.map(c=>({varianteId:v.id,nome:v.padrao?p.nome:v.nome,canal:c.canal,idExterno:c.idExterno,estadoEnvio:c.estadoEnvio,resultadoExterno:c.resultadoExterno,enviadoEm:c.enviadoEm,consultadoEm:c.consultadoEm}))),
  });
}
