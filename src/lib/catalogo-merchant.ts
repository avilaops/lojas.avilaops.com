import { diagnosticarProduto, midiasDaOferta, type ProdutoCatalogo } from "./catalogo-qualidade";
import { gtinValido, ofertaDaVariante } from "./catalogo-oferta";
import { categoriaGoogle, categoriaGoogleProduto, prateleirasDaLoja } from "./categoria-google";
import { idDaCategoriaGoogle } from "./google-product-taxonomy";
import { marcaConfirmada } from "./marca-confirmada";
import { fichaDoProduto } from "./ficha";
import { textoPuro } from "./seo-texto";
import { paragrafosDaDescricao } from "./descricao-produto";

const esc=(s:string)=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const tag=(k:string,v:string)=>`<g:${k}>${esc(v)}</g:${k}>`;
const preco=(n:number)=>`${(n/100).toFixed(2)} BRL`;

/**
 * A descrição que vai ao Merchant é a que a página mostra: a curta (abaixo do
 * título) e a longa (seção "Descrição"), nesta ordem, em texto puro. Antes só
 * a curta saía quando existia, e a longa, que é onde estão uso, diluição e
 * superfícies, ficava fora do anúncio. O Google compara a descrição do feed
 * com a página de destino, então o que sai daqui é o que está lá.
 */
export function descricaoMerchant(p:{nome:string;descricaoCurta:string|null;descricao:string|null}):string {
  const curta=textoPuro(p.descricaoCurta);
  // Parágrafos preservados: é como a página mostra e como o Google exibe.
  const longa=p.descricao?paragrafosDaDescricao(p.descricao).join("\n\n"):"";
  const partes=curta&&longa&&curta!==longa&&!longa.startsWith(curta)?[curta,longa]:[longa||curta];
  return (partes.filter(Boolean).join("\n\n")||p.nome).slice(0,5000);
}

/**
 * `product_detail`: a ficha técnica visível (`fichaDoProduto`) em pares
 * nome/valor, que o Google mostra como "Especificações" e usa para casar o
 * anúncio com a busca ("shampoo 1,5 L", "boina 6 polegadas"). Só o que a
 * ficha já publica; nada é inventado nem vem de chave interna.
 */
export function detalhesMerchant(atributos:unknown):string {
  return fichaDoProduto((atributos??{}) as Record<string,unknown>).slice(0,100)
    .map(l=>`<g:product_detail>${tag("section_name","Especificações")}${tag("attribute_name",l.rotulo.slice(0,140))}${tag("attribute_value",l.valor.slice(0,1000))}</g:product_detail>`).join("");
}

/**
 * @param prateleira resolvedor de `google_product_category`. O padrão decide só
 *   pelo nome da categoria; o feed passa o de `prateleirasDaLoja`, que conhece
 *   o ramo e por isso também resolve os nomes genéricos ("Acessórios").
 * @param freteGratis diz se a oferta sai com frete zero para o país inteiro
 *   (`freteGratisGarantido`). Só então o item leva `shipping`: o resto é cotado
 *   por CEP e fica para a configuração de frete da conta no Merchant Center.
 */
export function itensMerchant(p:ProdutoCatalogo,base:string,prateleira:(nome:string|null|undefined)=>number|undefined=categoriaGoogle,freteGratis:(precoCentavos:number)=>boolean=()=>false):string[] {
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
    const googleCategoria=idDaCategoriaGoogle(p.googleProductCategory) || categoriaGoogleProduto(p.nome,p.categoria?.nome,prateleira);
    const dimensoesDeEnvioValidas=[v.comprimentoCm,v.larguraCm,v.alturaCm].every(n=>typeof n==="number" && Number.isFinite(n) && n>=1 && n<=400);
    return [`<item>${[
      tag("id",externo),tag("title",titulo.slice(0,150)),tag("description",descricaoMerchant(p)),tag("link",link),
      tag("image_link",imagens[0].url),...imagens.slice(1,10).map(m=>tag("additional_image_link",m.url)),
      tag("availability",v.compravel?"in_stock":"out_of_stock"), tag("price",preco(precoPromocional?v.precoDeCentavos!:v.precoCentavos)), precoPromocional?tag("sale_price",preco(v.precoCentavos)):"", tag("condition","new"),
      marca?tag("brand",marca):"",gtinValido(v.gtin)?tag("gtin",v.gtin!):"",v.mpn?tag("mpn",v.mpn):"",
      v.identificadoresEstado==="sem_identificador"&&!v.gtin&&!v.mpn?tag("identifier_exists","no"):"",
      p.categoria?tag("product_type",p.categoria.nome):"",googleCategoria?tag("google_product_category",String(googleCategoria)):"",
      detalhesMerchant(p.atributos),
      dimensoesDeEnvioValidas?tag("shipping_length",`${v.comprimentoCm} cm`)+tag("shipping_width",`${v.larguraCm} cm`)+tag("shipping_height",`${v.alturaCm} cm`):"",
      v.pesoKg!=null&&Number.isFinite(v.pesoKg)&&v.pesoKg>0&&v.pesoKg<=1000?tag("shipping_weight",`${v.pesoKg} kg`):"",
      freteGratis(v.precoCentavos)?`<g:shipping>${tag("country","BR")}${tag("price",preco(0))}</g:shipping>`:"",
      !v.padrao ? tag("item_group_id",p.id)+p.opcoes.map(o=>{const k=/tamanho|size/i.test(o)?"size":/cor|color/i.test(o)?"color":/material/i.test(o)?"material":null;return k&&valores[o]?tag(k,valores[o]):"";}).join("") : "",
    ].join("")}</item>`];
  });
}

export function gerarFeedMerchant(loja:{nome:string;slogan:string|null},base:string,produtos:ProdutoCatalogo[],freteGratis:(precoCentavos:number)=>boolean=()=>false) {
  // O ramo é da loja: resolve-se uma vez, com todas as categorias à vista.
  const prateleira=prateleirasDaLoja(produtos.map(p=>p.categoria?.nome));
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>${esc(loja.nome)}</title><link>${esc(base)}</link><description>${esc(loja.slogan??`Produtos da ${loja.nome}`)}</description>${produtos.flatMap(p=>itensMerchant(p,base,prateleira,freteGratis)).join("")}</channel></rss>`;
}
