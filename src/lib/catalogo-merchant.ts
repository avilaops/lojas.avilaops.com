import { diagnosticarProduto, midiasDaOferta, type ProdutoCatalogo } from "./catalogo-qualidade";
import { gtinValido, ofertaDaVariante } from "./catalogo-oferta";
import { categoriaGoogle, prateleirasDaLoja } from "./categoria-google";
import { idDaCategoriaGoogle } from "./google-product-taxonomy";
import { marcaConfirmada } from "./marca-confirmada";

const esc=(s:string)=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const tag=(k:string,v:string)=>`<g:${k}>${esc(v)}</g:${k}>`;
const preco=(n:number)=>`${(n/100).toFixed(2)} BRL`;

/**
 * @param prateleira resolvedor de `google_product_category`. O padrão decide só
 *   pelo nome da categoria; o feed passa o de `prateleirasDaLoja`, que conhece
 *   o ramo e por isso também resolve os nomes genéricos ("Acessórios").
 */
export function itensMerchant(p:ProdutoCatalogo,base:string,prateleira:(nome:string|null|undefined)=>number|undefined=categoriaGoogle):string[] {
  if(!p.ativo) return [];
  const ocorrencias=diagnosticarProduto(p,prateleira);
  const marca=marcaConfirmada(p.marca);
  return p.variantes.filter(v=>v.ativo).flatMap(original=>{
    const v=ofertaDaVariante(original);
    if(v.precoCentavos<=0 || ocorrencias.some(o=>o.severidade==="erro" && o.canal==="google" && (!o.varianteId || o.varianteId===v.id))) return [];
    const imagens=midiasDaOferta(p,v.id);
    const externo=v.publicacoes.find(c=>c.canal==="google" && !c.contaExterna)?.idExterno ?? (v.padrao ? p.id : `${p.id}:${v.id}`);
    const link=`${base}/produtos/${p.slug}${v.padrao ? "" : `?variante=${encodeURIComponent(v.id)}`}`;
    const titulo=v.padrao?p.nome:`${p.nome} · ${v.nome}`;
    const precoPromocional=v.precoDeCentavos!=null&&v.precoDeCentavos>v.precoCentavos;
    const valores=v.valores as Record<string,string>;
    const googleCategoria=idDaCategoriaGoogle(p.googleProductCategory) || prateleira(p.categoria?.nome);
    const dimensoesDeEnvioValidas=[v.comprimentoCm,v.larguraCm,v.alturaCm].every(n=>typeof n==="number" && Number.isFinite(n) && n>=1 && n<=400);
    return [`<item>${[
      tag("id",externo),tag("title",titulo.slice(0,150)),tag("description",(p.descricaoCurta||p.descricao||p.nome).replace(/<[^>]*>/g," ").slice(0,5000)),tag("link",link),
      tag("image_link",imagens[0].url),...imagens.slice(1,10).map(m=>tag("additional_image_link",m.url)),
      tag("availability",v.compravel?"in_stock":"out_of_stock"), tag("price",preco(precoPromocional?v.precoDeCentavos!:v.precoCentavos)), precoPromocional?tag("sale_price",preco(v.precoCentavos)):"", tag("condition","new"),
      marca?tag("brand",marca):"",gtinValido(v.gtin)?tag("gtin",v.gtin!):"",v.mpn?tag("mpn",v.mpn):"",
      v.identificadoresEstado==="sem_identificador"&&!v.gtin&&!v.mpn?tag("identifier_exists","no"):"",
      p.categoria?tag("product_type",p.categoria.nome):"",googleCategoria?tag("google_product_category",String(googleCategoria)):"",
      dimensoesDeEnvioValidas?tag("shipping_length",`${v.comprimentoCm} cm`)+tag("shipping_width",`${v.larguraCm} cm`)+tag("shipping_height",`${v.alturaCm} cm`):"",
      v.pesoKg!=null&&Number.isFinite(v.pesoKg)&&v.pesoKg>0&&v.pesoKg<=1000?tag("shipping_weight",`${v.pesoKg} kg`):"",
      !v.padrao ? tag("item_group_id",p.id)+p.opcoes.map(o=>{const k=/tamanho|size/i.test(o)?"size":/cor|color/i.test(o)?"color":/material/i.test(o)?"material":null;return k&&valores[o]?tag(k,valores[o]):"";}).join("") : "",
    ].join("")}</item>`];
  });
}

export function gerarFeedMerchant(loja:{nome:string;slogan:string|null},base:string,produtos:ProdutoCatalogo[]) {
  // O ramo é da loja: resolve-se uma vez, com todas as categorias à vista.
  const prateleira=prateleirasDaLoja(produtos.map(p=>p.categoria?.nome));
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>${esc(loja.nome)}</title><link>${esc(base)}</link><description>${esc(loja.slogan??`Produtos da ${loja.nome}`)}</description>${produtos.flatMap(p=>itensMerchant(p,base,prateleira)).join("")}</channel></rss>`;
}
