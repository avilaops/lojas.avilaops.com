import { readFile, writeFile } from "node:fs/promises";
const base="https://lojas.avilaops.com", h={authorization:`Bearer ${process.env.LOJAS_ADMIN_TOKEN}`,"content-type":"application/json"};
const patch=JSON.parse(await readFile(process.argv[2],"utf8")); const limite=Number(process.argv[3]??Infinity);
const todos=await (await fetch(`${base}/api/admin/tenants/vedashow/produtos`,{headers:h})).json();
const porSku=new Map(todos.filter(p=>p.sku).map(p=>[p.sku,p])); const lote=[];
for(const p of patch.slice(0,limite)){ const a=porSku.get(p.sku); if(!a||a.slug!==p.slug) continue;
  const e={sku:a.sku,slug:a.slug,nome:a.nome,precoCentavos:a.precoCentavos};
  if(p.marca && !a.marca) e.marca=p.marca;
  if(p.mpn && !a.gtin){ e.mpn=p.mpn; e.identificadoresEstado="informado"; }
  else if(p.identificadoresEstado==="sem_identificador" && !a.gtin && !a.marca && !p.marca) e.identificadoresEstado="sem_identificador";
  if(p.pesoKg && !a.pesoKg) e.pesoKg=p.pesoKg;
  if(p.alturaCm && !a.alturaCm){ e.alturaCm=p.alturaCm; e.larguraCm=p.larguraCm; e.comprimentoCm=p.comprimentoCm; }
  if(p.descricao_forcar) e.descricao=p.descricao_forcar;
  if(p.descricao && !(a.descricao??"").trim()) e.descricao=p.descricao;
  if(p.descricaoCurta) e.descricaoCurta=p.descricaoCurta;
  if(p.googleProductCategory && !a.googleProductCategory) e.googleProductCategory=p.googleProductCategory;
  if(p.atributos) e.atributos={...(a.atributos??{}),...p.atributos};
  if(Object.keys(e).length>4) lote.push(e); }
console.log("a enviar",lote.length); let ok=0;
for(let i=0;i<lote.length;i+=100){ const r=await fetch(`${base}/api/admin/tenants/vedashow/produtos`,{method:"PUT",headers:h,body:JSON.stringify(lote.slice(i,i+100))}); const c=await r.json().catch(()=>({})); if(!r.ok){console.log("ERRO lote",i,r.status,JSON.stringify(c).slice(0,600)); process.exit(1);} ok+=c.atualizados??0; }
console.log("atualizados",ok);
