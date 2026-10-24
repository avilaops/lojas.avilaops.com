"use strict";
const fs=require("node:fs");
async function main(){
 const directory=process.argv[2];if(!directory)throw new Error("Informe o diretório de saída.");
 fs.mkdirSync(directory,{recursive:true,mode:0o700});
 const base="https://kr-wheels.com/wp-json/wp/v2/media?per_page=100&_fields=id,source_url,title,alt_text&page=";
 const {execFileSync}=require("node:child_process");
 function request(page){
  const headers=directory+"/cabecalho-"+page+".txt";
  const body=execFileSync("curl",["-fsSL","--retry","2","--max-time","30","-D",headers,base+page],{maxBuffer:10000000}).toString();
  return {items:JSON.parse(body),headers:fs.readFileSync(headers,"utf8")};
 }
 const first=request(1);
 const pages=Number(first.headers.match(/x-wp-totalpages:\s*(\d+)/i)?.[1]||1);if(pages>20)throw new Error("Catálogo maior que o limite revisado: "+pages);
 const items=first.items;
 for(let page=2;page<=pages;page+=2){
  const batch=await Promise.all([page,page+1].filter(n=>n<=pages).map(async n=>{
   return request(n).items;
  }));items.push(...batch.flat());
 }
 const media=items.filter(m=>/\.(png|jpe?g|webp)$/i.test(new URL(m.source_url).pathname));
 fs.writeFileSync(directory+"/krmai-midia.json",JSON.stringify(media,null,2));
 const images=[];
 for(const m of media){
  const title=m.title.rendered.replace(/\s+/g,"").replace(/_+/g,"_").toUpperCase();
  const match=title.match(/^([KMRS]\d+)[-_]?(?:(G)[-_])?(GD|BD|HD|SS|GF|BF|B)(?:[-_](G))?[-_]?$/);
  if(match&&(match[2]||match[4]))images.push({model:match[1],finish:match[3],url:m.source_url,source:"https://kr-wheels.com/rodas/"+match[1].toLowerCase()+"/"});
 }
 fs.writeFileSync(directory+"/krmai-imagens-modelo.json",JSON.stringify(images,null,2));
 console.log(JSON.stringify({paginas:pages,midias:media.length,imagensComModeloAcabamento:images.length}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
