// Executado por stdin dentro do container. Leitura apenas e projeção pública.
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
async function main() {
  const t = await db.tenant.findUnique({where:{slug:'brilhax'},select:{
    id:true,slug:true,nome:true,plano:true,status:true,tema:true,identidade:true,
    slogan:true,sobre:true,logoUrl:true,bannerUrl:true,faviconUrl:true,avisoTopo:true,
    whatsapp:true,telefone:true,emailContato:true,instagram:true,endereco:true,
    enderecoPublico:true,razaoSocial:true,cnpj:true,horario:true,despachoDiasUteis:true,
    retiradaNaLoja:true,freteGratisAcima:true,meiosPagamento:true,dominioPrincipal:true,
    dominios:true,atualizadoEm:true,cepOrigem:true,caixaPadrao:true,pesoPadraoKg:true,
    categorias:true,
  }});
  if(!t) throw new Error('Tenant ausente');
  console.log(JSON.stringify(t));
}
main().finally(()=>db.$disconnect());
