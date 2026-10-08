import fs from "node:fs";
const base="https://lojas.avilaops.com", h={authorization:`Bearer ${process.env.LOJAS_ADMIN_TOKEN}`,"content-type":"application/json"};
const mapa=JSON.parse(fs.readFileSync("png/mapa.json","utf8"));
const todos=await (await fetch(`${base}/api/admin/tenants/vedashow/produtos`,{headers:h})).json();
const lote=[]; let pul=0;
for(const p of todos){ const arq=mapa[p.slug]; if(!arq) continue; if(p.imagens?.length){pul++;continue;}
  const url=`${base}/uploads/vedashow/${arq.replace(/^anel_backup-/,"anel-backup-")}`;
  lote.push({slug:p.slug,nome:p.nome,sku:p.sku,precoCentavos:p.precoCentavos,imagens:[url],imagemOrigem:"ilustracao"}); }
console.log("a vincular",lote.length,"ja com imagem",pul);
// toda URL precisa responder antes de ir para o produto
const urls=[...new Set(lote.map(l=>l.imagens[0]))]; let ruins=0;
for(let i=0;i<urls.length;i+=20){ const rs=await Promise.all(urls.slice(i,i+20).map(u=>fetch(u,{method:"HEAD"}).then(r=>r.status).catch(()=>0))); ruins+=rs.filter(s=>s!==200).length; }
console.log("urls",urls.length,"ruins",ruins); if(ruins) process.exit(1);
let ok=0; for(let i=0;i<lote.length;i+=100){ const r=await fetch(`${base}/api/admin/tenants/vedashow/produtos`,{method:"PUT",headers:h,body:JSON.stringify(lote.slice(i,i+100))}); const c=await r.json().catch(()=>({})); if(!r.ok){console.log("ERRO",i,r.status,JSON.stringify(c).slice(0,400));process.exit(1);} ok+=c.atualizados??0; }
console.log("atualizados",ok);
