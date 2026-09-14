const fs=require('node:fs');
const path=require('node:path');
const sharp=require('sharp');
async function main(){
  const origem=path.resolve('../Websites/brilhax.com/public');
  const destino=path.resolve('public/media/automotivo-premium');
  fs.mkdirSync(destino,{recursive:true});
  const imagens=[
    ['images/hero-studio-v2.png','hero-brilhax-v1.webp',1800],
    ['brand/brilhax-logo-light.jpg','simbolo-claro-v1.webp',128],
    ['brand/brilhax-logo-dark.jpg','simbolo-escuro-v1.webp',128],
    ...['lavagem','polimento','vitrificacao','protecao','acessorios','kits','moto'].map(c=>['images/categorias/'+c+'.jpg','categoria-'+c+'-v1.webp',640]),
  ];
  for(const [src,nome,w] of imagens){
    const out=path.join(destino,nome);
    if(fs.existsSync(out))continue;
    await sharp(path.join(origem,src)).resize({width:w,withoutEnlargement:true}).webp({quality:86}).toFile(out);
    console.log(nome,fs.statSync(out).size);
  }
  const editorial=path.join(destino,'editorial-cuidado-v1.webp');
  if(!fs.existsSync(editorial))await sharp('C:/Users/nicol/.codex/generated_images/01a09343-325f-7233-966d-9ae726cfea68/exec-7fd6d0c4-5535-47f6-909f-a244db3f0094.png').resize({width:1200}).webp({quality:85}).toFile(editorial);
  console.log('editorial-cuidado-v1.webp',fs.statSync(editorial).size);
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
