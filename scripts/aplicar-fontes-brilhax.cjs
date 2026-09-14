// Executar dentro do container do Lojas. Não imprime tokens e não toca em preços/estoque.
// Plano explícito por ID, fotografia conferida e snapshot anterior obrigatório.
const {createHmac}=require('node:crypto');
async function aplicarFontes(plano, aplicar=false) {
  const base='http://127.0.0.1:'+process.env.PORT;
  if(!process.env.LOJAS_SECRET || !process.env.LOJAS_ADMIN_TOKEN)throw new Error('Ambiente do Lojas ausente');
  const r=await fetch(base+'/api/admin/tenants/brilhax/produtos',{headers:{authorization:'Bearer '+process.env.LOJAS_ADMIN_TOKEN}});
  if(!r.ok)throw new Error('Leitura do catálogo falhou: '+r.status);
  const todos=await r.json();
  const corpo=Buffer.from(JSON.stringify({slug:'brilhax',exp:Date.now()+10*60*1000})).toString('base64url');
  const token=corpo+'.'+createHmac('sha256',Buffer.from(process.env.LOJAS_SECRET,'hex')).update(corpo).digest('base64url');
  const headers={'content-type':'application/json',cookie:'lojas_sessao='+token};
  for(const item of plano) {
    const p=todos.find(p=>p.id===item.id);
    if(!p||p.tenantId!==item.tenantId||p.slug!==item.slug||p.nome!==item.nome)throw new Error('Identidade divergente: '+item.id);
    if(new Date(p.atualizadoEm).getTime()!==new Date(item.atualizadoEm).getTime())throw new Error('Cadastro mudou após a conferência: '+p.nome);
    const campos=item.campos;
    const permitidos=['descricao','descricaoCurta','imagens','atributos','imagemOrigem','imagemFamilia','gtin','marca'];
    if(Object.keys(campos).some(k=>!permitidos.includes(k)))throw new Error('Campo fora do lote revisado');
    if(campos.gtin!==undefined) {
      const g=campos.gtin;
      if(p.gtin||typeof g!=='string'||!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(g)||/^(\d)\1+$/.test(g))throw new Error('GTIN existente ou inválido');
      const soma=g.slice(0,-1).split('').reverse().reduce((s,n,i)=>s+Number(n)*(i%2===0?3:1),0);
      if((10-soma%10)%10!==Number(g.at(-1))||campos.atributos?._catalogoFonteGtin?.gtin!==g)throw new Error('GTIN sem dígito válido ou sem fonte');
    }
    if(campos.imagens && (!campos.imagens.length||campos.imagens.length>10||campos.imagens.some(u=>!u.startsWith('https://lojas.avilaops.com/uploads/brilhax/'))))throw new Error('Foto fora do acervo Brilhax');
    for(const u of campos.imagens||[]) {
      const foto=await fetch(base+new URL(u).pathname,{method:'HEAD'});
      if(!foto.ok||!foto.headers.get('content-type')?.startsWith('image/'))throw new Error('Foto não publicada: '+u);
    }
    console.log(JSON.stringify({etapa:'conferido',id:p.id,nome:p.nome,campos:Object.keys(campos)}));
  }
  if(!aplicar)return;
  for(const item of plano) {
    const antes=await fetch(base+'/api/painel/produtos?id='+encodeURIComponent(item.id),{headers});
    if(!antes.ok)throw new Error('Conferência individual falhou');
    const p=await antes.json();
    if(new Date(p.atualizadoEm).getTime()!==new Date(item.atualizadoEm).getTime())throw new Error('Conflito antes da gravação: '+item.id);
    const gravado=await fetch(base+'/api/painel/produtos',{method:'PATCH',headers,body:JSON.stringify({id:item.id,...item.campos,...(p.versaoCatalogo?{versaoCatalogo:p.versaoCatalogo}:{})})});
    if(!gravado.ok)throw new Error('Gravação recusada: '+item.id+' '+gravado.status+' '+await gravado.text());
    const depois=await (await fetch(base+'/api/painel/produtos?id='+encodeURIComponent(item.id),{headers})).json();
    for(const k of ['precoCentavos','precoDeCentavos','estoque','sku','gtin','ativo','slug','nome'])if(k in item.campos ? JSON.stringify(depois[k])!==JSON.stringify(item.campos[k]) : JSON.stringify(depois[k])!==JSON.stringify(p[k]))throw new Error('Campo comercial alterado: '+k);
    for(const [k,v] of Object.entries(item.campos)) {
      try { require('node:assert/strict').deepEqual(depois[k],v); }
      catch { throw new Error('Dado não persistiu: '+k); }
    }
    console.log(JSON.stringify({etapa:'gravado',id:item.id,nome:item.nome,fotos:depois.imagens.length,atualizadoEm:depois.atualizadoEm}));
  }
}
