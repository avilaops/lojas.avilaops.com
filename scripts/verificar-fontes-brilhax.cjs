async function verificarFontes(antes,esperado) {
  const assert=require('node:assert/strict');
  const r=await fetch('http://127.0.0.1:'+process.env.PORT+'/api/admin/tenants/brilhax/produtos',{headers:{authorization:'Bearer '+process.env.LOJAS_ADMIN_TOKEN}});
  if(!r.ok)throw new Error('API de catálogo indisponível');
  const atual=await r.json();
  assert.equal(atual.length,antes.length);
  const campos=Object.keys(antes[0]).filter(k=>!['atualizadoEm','busca','criadoEm'].includes(k));
  for(const e of esperado) {
    const p=atual.find(p=>p.id===e.id);
    assert.ok(p,'Produto ausente: '+e.id);
    for(const k of campos)try{assert.deepEqual(p[k]??null,e[k]??null);}catch{throw new Error('Divergência: '+e.nome+' / '+k);}
    assert.equal(new Date(p.criadoEm).getTime(),new Date(e.criadoEm+'Z').getTime());
  }
  const alterados=atual.filter(p=>campos.some(k=>{try{assert.deepEqual(p[k]??null,antes.find(a=>a.id===p.id)[k]??null);return false;}catch{return true;}}));
  const novas=atual.filter(p=>p.imagens.length&&!antes.find(a=>a.id===p.id).imagens.length);
  const urls=[...new Set(novas.flatMap(p=>p.imagens))];
  for(const url of urls){const r=await fetch(url,{method:'HEAD',signal:AbortSignal.timeout(20000)});if(!r.ok||!r.headers.get('content-type')?.startsWith('image/'))throw new Error('Foto indisponível publicamente: '+url);}
  const contar=ps=>({total:ps.length,semFoto:ps.filter(p=>!p.imagens.length).length,umaFoto:ps.filter(p=>p.imagens.length===1).length,maisDeUmaFoto:ps.filter(p=>p.imagens.length>1).length,ativos:ps.filter(p=>p.ativo).length,ativosSemFoto:ps.filter(p=>p.ativo&&!p.imagens.length).length,semDescricao:ps.filter(p=>!p.descricao?.trim()).length,semDescricaoCurta:ps.filter(p=>!p.descricaoCurta?.trim()).length,semGtin:ps.filter(p=>!p.gtin?.trim()).length,semMarca:ps.filter(p=>!p.marca?.trim()).length,precoZerado:ps.filter(p=>p.precoCentavos===0).length,estoqueNaoControlado:ps.filter(p=>p.estoque===null).length,semPeso:ps.filter(p=>!p.pesoKg).length,semDimensoes:ps.filter(p=>!p.alturaCm||!p.larguraCm||!p.comprimentoCm).length});
  const resultado={verificadoEm:new Date().toISOString(),produtosConferidos:atual.length,produtosAlterados:alterados.length,produtosAntesSemFotoComFoto:novas.length,arquivosConferidosPublicamente:urls.length,antes:contar(antes),depois:contar(atual),alteracoesPorCampo:Object.fromEntries(campos.map(k=>[k,atual.filter(p=>{try{assert.deepEqual(p[k]??null,antes.find(a=>a.id===p.id)[k]??null);return false;}catch{return true;}}).length]).filter(([,n])=>n>0)),divergencias:0};
  console.log(JSON.stringify(resultado));
}
