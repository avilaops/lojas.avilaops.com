"use strict";
const fs = require("node:fs");
const path = require("node:path");
const RODAS = {
  KRMAI:["KRMAI","RKMAI"], RAW:["RAW"], Zunky:["ZUNKY"], Zeus:["ZEUS"], SPW:["SPW"],
  Volcano:["VOLCANO","VOLCANOWELT"], BRW:["BRW"], Presenza:["PRESENZA","PREZENZA"],
  Scorro:["SCORRO"], Vittoria:["VITTORIA"], PDW:["PDW"], Polly:["POLLY"],
  Gisa:["GISA"], GT7:["GT7","GT-7"], Vaska:["VASKA"], Cosmos:["COSMOS"],
  Monaco:["MONACCO","MONACO"], Motorcrazy:["MOTORCRAZY"], Noova:["NOOVA"],
  Tsuya:["TSUYA"], TSW:["TSW"], Kromma:["KROMMA"], Ramlow:["RAMLOW"],
  Ferraro:["FERRARO"], Infinity:["INFINITY"], Niche:["NICHE"], Kyowa:["KYOWA"],
  Vossen:["VOSSEN"], YKW:["YKW"], ZWI:["ZWI"], Rodera:["RODERA"],
  Fuel:["FUEL"], BBS:["BBS"], Rotiform:["ROTIFORM","ROTFORM"], Italsped:["ITALSPED","ITALSPEED"],
  WSP:["WSP"], HRE:["HRE"], Kokuture:["KOKOTURE"], LVR:["LVR"], Spiido:["SPIIDO"],
  Tuff:["TUFF"], Zetta:["ZETTA"], Vorsteiner:["VORSTEINER"], Engemec:["ENGEMEC"],
  Giovanna:["GIOVANNA","GEOVANA"], Status:["STATUS"], Hostile:["HOSTILE"], Ravena:["RAVENA"],
  Binno:["BINNO"], Azad:["AZAD"], Advan:["ADVAN"], DUB:["DUB"], Ruff:["RUFF"],
  Stuttgart:["STUTTGART"], Mangels:["MANGELS"], Ipertec:["IPERTEC"], Venice:["VENICE"],
  Strong:["STRONG"], Rennen:["RENNEN"], Procast:["PROCAST"], Gaúcha:["GAUCHA"],
  Onzo:["ONZO"], Incubus:["INCUBUS"], Vortec:["VORTEC"], Eagle:["EAGLE"],
  "OZ Racing":["OZ RACING","OZ"], "Blaque Diamond":["BLAQUE DIAMOND"],
  Alzor:["ALZOR"], Wraith:["WRAITH"]
};
const PNEUS = {
  Pirelli:["PIRELLI"], Yokohama:["YOKOHAMA","YOKOHANMA"], Delinte:["DELINTE"],
  Toyo:["TOYO"], Landsail:["LANDSAIL","LAND SAIL"], Kumho:["KUMHO","KUHMO"],
  Prinx:["PRINX"], Linglong:["LINGLONG","LING LONG"], Aplus:["APLUS"],
  Continental:["CONTINENTAL"], Maxxis:["MAXXIS"], Michelin:["MICHELIN","MICHELLIN"],
  Triangle:["TRIANGLE"], Dunlop:["DUNLOP"], XBRI:["XBRI"], Nexen:["NEXEN"],
  Bridgestone:["BRIDGESTONE","BRIDGSTONE","BRIGESTONE","BIDGSTONE"],
  Roadcruza:["ROADCRUZA"], Jinyu:["JINYU"], Aptany:["APTANY"], Hifly:["HIFLY","HYFLY"],
  Zelda:["ZELDA"], Barrela:["BARRELA"], Minerva:["MINERVA"], Wanli:["WANLI"],
  Goodyear:["GOODYEAR"], Hankook:["HANKOOK"], Aderenza:["ADERENZA"],
  Doublestar:["DOUBLESTAR"], Comforser:["COMFORSER","COMFORCER"],
  BFGoodrich:["BF GOODRICH","BF GODRICH","GODRICH","BF ALL","BF TRAIL"],
  Sailun:["SAILUN","SAILUM"], Crossleader:["CROSSLEADER"], Onyx:["ONYX"],
  Speedmax:["SPEEDMAX"], Atturo:["ATTURO"], Nankang:["NANKANG"], Westlake:["WESTLAKE"],
  Goform:["GOFORM"], Sunset:["SUNSET"], Ovation:["OVATION"], Roadstone:["ROADSTONE"],
  Dynamo:["DYNAMO"], Trazano:["TRAZANO"], Radar:["RADAR"], Federal:["FEDERAL"],
  Zeta:["ZETA"], Saferich:["SAFERICH"], Farroad:["FARROAD","FARROUD"],
  Sunny:["SUNNY"], Lanvigator:["LANVIGATOR"], Firestone:["FIRESTONE"],
  Autogreen:["AUTOGREEN"], Horizon:["HORIZON"], Davanti:["DAVANTI","DEVANTI"],
  Barum:["BARUM"], Mazzini:["MAZZINI"], Headway:["HEADWAY"], Durable:["DURABLE"],
  Goodride:["GOODRIDE","GOODRIGE"], Compasal:["COMPASAL"], Winrun:["WINRUN"],
  Zeetex:["ZEETEX"], Achilles:["ACHILLES","ACHILES"], Semperit:["SEMPERIT"],
  Windforce:["WINDFORCE"], "Three-A":["THREE-A","TREE-A","TREE A"],
  Chengshan:["CHENGSHAN"], Rotalla:["ROTALLA"], "Speed Way":["SPEED WAY"],
  Duraturn:["DURATURN","DURATUM","DURATUN"], Accelera:["ACCELERA","ACELLERA"],
  Vitour:["VITOUR"], "General Tire":["GENERAL TIRE","GENERAL"], "Royal Black":["ROYAL BLACK","ROYALBLACK","ROYAL EXPLORER","ROYAL MILE","ROYAL PASSENGER"],
  Kingboss:["KINGBOSS"], Tornel:["TORNEL"], Sunfull:["SUNFULL"], Maxtrek:["MAXTREK"],
  Milever:["MILEVER"], Yeada:["YEADA"], Antares:["ANTARES"], Citystar:["CITYSTAR","CITY STAR"],
  Sunwide:["SUNWIDE"], Regal:["REGAL"], Ecovision:["ECOVISION"], Cordiant:["CORDIANT"],
  Provato:["PROVATO"], Fortune:["FORTUNE"], Mastercraft:["MASTERCRAFT"], Artum:["ARTUM"],
  Superia:["SUPERIA"], Forceland:["FORCELAND"], "X-Pounce":["X-POUNCE"],
  Firenza:["FIRENZA"], Fullway:["FULLWAY"], Runway:["RUNWAY"], Suntek:["SUNTEK"],
  Falken:["FALKEN"], RoadX:["ROADX"], Kpatos:["KPATOS"], Ilink:["ILINK"],
  Rapid:["RAPID"], Zetum:["ZETUM"], Waterfall:["WATERFALL"], Zetta:["ZETTA"],
  Routeway:["ROUTEWAY"], Pace:["PACE"], Sunitrac:["SUNITRAC"], Torque:["TORQUE"],
  Sapphire:["SAPPHIRE"], Argos:["ARGOS"], Invovic:["INVOVIC"], "Pearl River":["PEARL RIVER"],
  Habilead:["HABILEAD"], Cooper:["COOPER"], Haida:["HAIDA"], "Black Lion":["BLACKLION","BLACK LION"],
  "JK Tyre":["JK"], Seiberling:["SEIBERLING"], Roadtour:["ROADTOUR"],
  Goalstar:["GOALSTAR"], Acmax:["ACMAX"], Atlas:["ATLAS"], Forceum:["FORCEUM"],
  Ceat:["CEAT"], Kapsen:["KAPSEN"], Constance:["CONSTANCE"], Protura:["PROTOURA"],
  Velocita:["VELOCITA"], Cratos:["CRATOS"], Toucans:["TOUCANS"], Blackarrow:["BLACKARROW"],
  Lykeen:["LYKEEN"], Loyfer:["LOYFER"], Starfire:["STARFIRE"], Itaro:["ITARO"],
  Technic:["TECHNIC"], Apollo:["APOLLO","APOLO"], Alfamotors:["ALFAMOTORS"],
  Kenda:["KENDA"], Nitto:["NITTO"], Massimo:["MASSIMO"], Roadboss:["ROADBOSS"],
  Maggion:["MAGGION"], Komet:["KOMET"], Venom:["VENOM"], Gripmax:["GRIPMAX"],
  Ironhead:["IRONHEAD"], Primewell:["PRIMEWELL"], Viking:["VIKING"], Cachland:["CACHLAND"],
  Agate:["AGATE"], Opals:["OPALS"], Fate:["FATE"], "GT Radial":["GT RADIAL","GT RAYAL"],
  "Road March":["ROAD MARCH"], CST:["CST"], "BF Tyres":["BF TYRES"]
};
const escape = s => s.replace(/[.*+?^{}()|[\]\\$]/g, "\\$&");
function marcaDoNome(nome, categoria) {
  const wheel = categoria === "rodas";
  const hits = [];
  for (const [marca, aliases] of Object.entries(wheel ? RODAS : PNEUS)) for (const alias of aliases) {
    const suffix = wheel && ["BRW","SPW","YKW"].includes(alias) ? "(?=\\d|\\b)" : "\\b";
    const match = new RegExp("\\b"+escape(alias)+suffix,"i").exec(nome);
    if (match) hits.push({ marca, pos:match.index, tamanho:alias.length });
  }
  // Uma montadora citada na aplicação não comprova quem fabricou a roda.
  if (wheel) for (const [pattern,marca] of [[/\bPRZ[- ]?\d/i,"Presenza"],[/\bZK[- ]?\d/i,"Zunky"]]) {
    const m = pattern.exec(nome); if (m) hits.push({marca,pos:m.index,tamanho:m[0].length});
  }
  hits.sort((a,b)=>a.pos-b.pos||b.tamanho-a.tamanho);
  return hits[0]?.marca ?? null;
}
const numero = s => Number(s.replace(",","."));
function fichaDoNome(nome, categoria) {
  const a = {};
  if (categoria === "rodas") {
    const dimension = nome.match(/^RODA\s+(?:ARO\s+)?(\d{2})(?:\s*X\s*(\d{1,2}(?:[.,]\d+)?(?:\/\d{1,2}(?:[.,]\d+)?)?))?/i);
    if (dimension && +dimension[1]>=13 && +dimension[1]<=30) {
      a.aro = dimension[1]+" polegadas";
      if (dimension[2]) a.tala = dimension[2].replace(".",",")+" polegadas";
    }
    const bolts = nome.match(/\b([3-8])\s*X\s*(\d{2,3}(?:[.,]\d+)?(?:\s*[\/X]\s*\d{2,3}(?:[.,]\d+)?)*)/i);
    if (bolts) a.furacao = (bolts[1]+"x"+bolts[2]).replace(/\s+/g,"");
    const et = nome.match(/\b(?:ET|OFFSET)\s*([+-]?\s*\d{1,3}(?:[.,]\d+)?)/i);
    if (et) a.offset = numero(et[1].replace(/\s/g,""))+" mm";
    const code = nome.match(/\b(?:BRW|PRZ|ZK)[- ]?\d{2,4}\b/i);
    if (code) a.modelo = code[0].replace(/[- ]/g,"").toUpperCase();
    else {
      const manufacturer = marcaDoNome(nome,categoria);
      const alias = manufacturer ? RODAS[manufacturer] : null;
      if (alias) {
        const token = nome.match(new RegExp("\\b(?:"+alias.map(escape).join("|")+")\\s+([A-Z]{0,3}[-/]?\\d{1,4}[A-Z]?)\\b","i"));
        if (token && !/^[3-8]X/i.test(token[1])) a.modelo = token[1].toUpperCase();
      }
    }
    const color = nome.match(/\b(GRAFITE|GRAF\.?|PRATA|PRET[AO]|BRONZE|CROMAD[AO]|GUNMETAL|SATIN BLACK|GLOSS BLACK|HYPER SILVER)\b/i);
    const diamond = /\b(DIAMANTAD[AO]|DIAMANT\.?|DIAM\.?|DIMANTAD[AO])\b/i.test(nome);
    const texture = nome.match(/\b(FOSC[AO]|BRILHANTE|BRILHOS[AO])\b/i);
    if (color) a.acabamento = [color[1].replace(/^GRAF\.?$/i,"GRAFITE").toLowerCase(),diamond?"diamantado":null,texture?.[1].toLowerCase()].filter(Boolean).join(" ");
  } else if (categoria === "pneus") {
    const metric = nome.match(/\b(\d{3})\s*\/\s*(\d{2,3})\s*(?:\/|ZR?|R|-)\s*(\d{2})\b/i);
    if (metric && +metric[1]>=125 && +metric[1]<=395 && +metric[2]<=100) {
      a.medida = metric[1]+"/"+metric[2]+" – aro "+metric[3];
      a.larguraPneu = metric[1]+" mm"; a.perfilPneu = metric[2]+"%"; a.aro = metric[3]+" polegadas";
    } else {
      const inch = nome.match(/\b(\d{2}[X/]\d{1,2}[.,]\d{1,2})\s*(?:\/|R|\s)\s*(\d{2})\b/i);
      if (inch) { a.medida = inch[1]+" – aro "+inch[2]; a.aro = inch[2]+" polegadas"; }
      const old = nome.match(/\b(\d{3})\s*R\s*(\d{2})\b/i);
      if (old) { a.larguraPneu=old[1]+" mm"; a.aro=old[2]+" polegadas"; }
    }
    const load = [...nome.matchAll(/\b(\d{2,3}(?:\/\d{2,3})?)\s*([HSTVWYQRLMN])\b/gi)].at(-1);
    if (load) { a.indiceCarga=load[1]; a.indiceVelocidade=load[2].toUpperCase(); }
    if (/\bRUN[ -]?FLA[TE]|RUNFLAT|RFT|ZRF/i.test(nome)) a.tecnologia="Run flat";
    if (/\bEXTRA ?LOAD|\bXL\b/i.test(nome)) a.reforco="XL / Extra Load";
  }
  return a;
}
function enriquecer(p) {
  const categoria = p.categoria?.slug;
  if (!["rodas","pneus"].includes(categoria)) return {};
  const marca = p.marca?.trim() || marcaDoNome(p.nome,categoria);
  const derived = fichaDoNome(p.nome,categoria);
  const attrs = {...derived,...p.atributos};
  const labels={aro:"Aro",tala:"Tala",furacao:"Furação",offset:"Offset (ET)",modelo:"Modelo",acabamento:"Acabamento",medida:"Medida",larguraPneu:"Largura do pneu",perfilPneu:"Perfil do pneu",indiceCarga:"Índice de carga",indiceVelocidade:"Índice de velocidade",tecnologia:"Tecnologia",reforco:"Reforço"};
  const lines=Object.entries(derived).map(([k,v])=>labels[k]+": "+v);
  const resumo=[categoria==="rodas"?"Roda":"Pneu",marca,derived.modelo,derived.medida||derived.aro,derived.furacao,derived.acabamento].filter(Boolean).join(" · ");
  const desc=[p.nome.trim().replace(/\s+/g," ")+".",[marca?"Marca: "+marca:null,...lines].filter(Boolean).join("\n"),
    categoria==="rodas"?"Antes da compra, confirme a compatibilidade da furação, tala e offset com o seu veículo e com o conjunto de pneus.":"Antes da compra, confirme a medida e os índices de carga e velocidade recomendados no manual do veículo."].join("\n\n");
  const data={};
  if (!p.marca?.trim() && marca) data.marca=marca;
  if (!p.descricaoCurta?.trim()) data.descricaoCurta=resumo;
  if (!p.descricao?.trim()) data.descricao=desc;
  if(Object.keys(derived).some(k=>p.atributos?.[k]===undefined))data.atributos={...attrs,_enriquecimentoAutomotivo:{versao:1,fonte:"titulo cadastrado",titulo:p.nome}};
  return data;
}
async function main() {
  const args=process.argv.slice(2),slug=args.find(x=>x.startsWith("--loja="))?.slice(7);
  if(!slug)throw new Error("Informe --loja=slug; --aplicar é opcional.");
  const aplicar=args.includes("--aplicar"),{PrismaClient}=require("@prisma/client"),db=new PrismaClient();
  try{
    const t=await db.tenant.findUniqueOrThrow({where:{slug},select:{id:true}});
    const rows=await db.produto.findMany({where:{tenantId:t.id,ativo:true,categoria:{slug:{in:["rodas","pneus"]}}},include:{categoria:true}});
    const plans=rows.map(p=>({p,data:enriquecer(p)})).filter(x=>Object.keys(x.data).length);
    const stats={loja:slug,total:rows.length,alteracoes:plans.length,marcas:plans.filter(x=>x.data.marca).length,fichas:plans.filter(x=>x.data.atributos).length,semMarca:rows.filter(x=>!x.marca&&!marcaDoNome(x.nome,x.categoria.slug)).map(x=>({id:x.id,nome:x.nome})),aplicar};
    const out=args.find(x=>x.startsWith("--saida="))?.slice(8)||"/tmp/catalogo-automotivo";
    fs.mkdirSync(out,{recursive:true,mode:0o700});
    fs.writeFileSync(path.join(out,"previa.json"),JSON.stringify(stats,null,2),{mode:0o600});
    if(aplicar){
      fs.writeFileSync(path.join(out,"backup-"+Date.now()+".json"),JSON.stringify(plans.map(({p})=>({id:p.id,marca:p.marca,descricao:p.descricao,descricaoCurta:p.descricaoCurta,atributos:p.atributos}))),{flag:"wx",mode:0o600});
      for(let start=0;start<plans.length;start+=100)await db.$transaction(async tx=>{
        for(const {p,data} of plans.slice(start,start+100)){
          const result=await tx.produto.updateMany({where:{id:p.id,tenantId:t.id,atualizadoEm:p.atualizadoEm},data});
          if(result.count!==1)throw new Error("Produto alterado durante a revisão: "+p.id);
        }
      },{timeout:30000});
    }
    console.log(JSON.stringify({...stats,semMarca:stats.semMarca.length}));
  } finally{await db.$disconnect();}
}
module.exports={marcaDoNome,fichaDoNome,enriquecer};
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
