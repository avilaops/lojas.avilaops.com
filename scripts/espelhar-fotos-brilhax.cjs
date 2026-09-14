// Espelha somente as URLs de fotografias previamente conferidas no plano.
// Executar no container do Lojas; preserva bytes, sem tratamento ou geração de imagem.
async function espelharFotos(urls) {
  const {createHash}=require('node:crypto');
  const fs=require('node:fs/promises');
  const path=require('node:path');
  const raiz=path.resolve(process.env.UPLOADS_DIR||'/app/uploads');
  if(raiz!=='/app/uploads')throw new Error('Diretório de produção inesperado');
  const pasta=path.join(raiz,'brilhax');
  const hosts=new Set(['www.vonixx.com.br','images.tcdn.com.br','zacs.com.br','detailer.com.br']);
  await fs.access(pasta);
  for(const url of [...new Set(urls)]) {
    const u=new URL(url);
    if(u.protocol!=='https:'||!hosts.has(u.hostname)||u.port||u.username||u.password)throw new Error('Origem não permitida');
    const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(30000)});
    if(!r.ok||!r.headers.get('content-type')?.startsWith('image/'))throw new Error('Download inválido: '+url);
    const chunks=[];let tamanho=0;
    for await(const c of r.body){tamanho+=c.length;if(tamanho>15*1024*1024)throw new Error('Foto excede limite');chunks.push(c);}
    const b=Buffer.concat(chunks);
    const ext=b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'png':b[0]===255&&b[1]===216&&b[2]===255?'jpg':b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP'?'webp':null;
    if(!ext)throw new Error('Assinatura de imagem desconhecida');
    const sha256=createHash('sha256').update(b).digest('hex');
    const nome='fonte-'+sha256.slice(0,24)+'.'+ext;
    const destino=path.join(pasta,nome);
    try{await fs.writeFile(destino,b,{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;if(createHash('sha256').update(await fs.readFile(destino)).digest('hex')!==sha256)throw new Error('Conflito no arquivo existente');}
    console.log(JSON.stringify({source:url,url:'https://lojas.avilaops.com/uploads/brilhax/'+nome,sha256,bytes:b.length}));
  }
}
