import type { Prisma } from "@prisma/client";
import { gtinValido, INCLUIR_OFERTA, ofertaDaVariante } from "./catalogo-oferta";
import { marcaConfirmada } from "./marca-confirmada";

export const INCLUIR_CATALOGO = { categoria: true, midias: { orderBy: { ordem: "asc" as const } }, variantes: { include: { ...INCLUIR_OFERTA, publicacoes: true }, orderBy: { ordem: "asc" as const } } } satisfies Prisma.ProdutoInclude;
export type ProdutoCatalogo = Prisma.ProdutoGetPayload<{ include: typeof INCLUIR_CATALOGO }>;
export type OcorrenciaCatalogo = { regra: string; versao: 1; campo: string; severidade: "erro"|"aviso"; canal: "loja"|"google"; mensagem: string; acao: string; varianteId?: string };

export function midiasDaOferta(p: ProdutoCatalogo, varianteId: string) {
  const vistas = new Set<string>();
  return p.midias.filter(m=>(m.varianteId===varianteId || m.varianteId===null) && m.tipo==="imagem")
    .sort((a,b)=>Number(b.varianteId===varianteId)-Number(a.varianteId===varianteId) || a.ordem-b.ordem)
    .filter(m => vistas.has(m.url) ? false : (vistas.add(m.url), true));
}

/** Regras locais explícitas. Não atesta fidelidade da foto nem aprovação externa. */
export function diagnosticarProduto(p: ProdutoCatalogo): OcorrenciaCatalogo[] {
  const ocorrencias: OcorrenciaCatalogo[]=[];
  const add=(regra:string,campo:string,severidade:"erro"|"aviso",canal:"loja"|"google",mensagem:string,acao:string,varianteId?:string)=>ocorrencias.push({regra,versao:1,campo,severidade,canal,mensagem,acao,varianteId});
  if(!p.categoriaId) add("categoria_ausente","categoria","aviso","loja","Produto sem categoria.","Escolha a categoria do produto.");
  if(!marcaConfirmada(p.marca)) add("marca_ausente","marca","aviso","google",p.marca?.trim()?"O cadastro contém “DIVERSOS”, que não identifica o fabricante.":"Falta a marca do fabricante.","Confirme a marca na embalagem, ficha técnica ou com o fornecedor.");
  if(!p.descricao?.trim() && !p.descricaoCurta?.trim()) add("descricao_ausente","descricao","erro","google","Falta uma descrição do produto.","Descreva o uso e as características confirmadas.");
  for(const original of p.variantes.filter(v=>v.ativo)) {
    const v=ofertaDaVariante(original);
    if(v.precoCentavos<=0) add("preco_ausente","preco","erro","loja","Preço ainda não definido.","Informe o preço da apresentação para habilitar a compra.",v.id);
    if(!v.sku) add("sku_ausente","sku","aviso","loja","SKU ainda não informado.","Informe o código interno desta apresentação.",v.id);
    else if(/^https?:\/\//i.test(v.sku)) add("sku_url","sku","aviso","loja","O SKU contém uma URL.","Confira o código interno na origem do cadastro.",v.id);
    if(v.gtin && !gtinValido(v.gtin)) add("gtin_invalido","gtin","erro","google","O GTIN não passa na validação de formato e dígito verificador.","Confira os dígitos na embalagem ou com o fabricante.",v.id);
    if(v.identificadoresEstado==="sem_identificador" && (v.gtin || v.mpn)) add("identificador_contraditorio","gtin","erro","google","Há identificadores cadastrados, mas o item está marcado como sem identificador.","Corrija a declaração da apresentação.",v.id);
    if(!v.gtin && !v.mpn && v.identificadoresEstado!=="sem_identificador") add("identificador_desconhecido","gtin","aviso","google","Identificador ainda desconhecido.","Confirme o GTIN/MPN; vazio não significa que o fabricante não atribuiu um.",v.id);
    if(v.disponibilidade==="backorder") add("prazo_encomenda","disponibilidade","erro","google","A encomenda ainda não tem data confirmada para o canal.","Confirme a data de disponibilidade antes de anunciar.",v.id);
    const midias=midiasDaOferta(p,v.id);
    if(!midias.length) add("foto_ausente","imagens","erro","google","Esta apresentação não tem foto.","Envie uma foto do item exato.",v.id);
    else {
      if(midias[0].origem!=="propria") add("foto_representativa","imagens","erro","google","A imagem principal é representativa ou ilustrada.","Escolha uma foto fiel à apresentação vendida.",v.id);
      if(midias[0].correspondencia!=="confirmada") add("foto_nao_conferida","imagens","aviso","google","A correspondência entre foto e item não foi conferida.","Confira a embalagem, cor e apresentação da foto.",v.id);
      if(midias.length===1) add("foto_unica","imagens","aviso","loja","Há apenas uma foto.","Acrescente outro ângulo ou detalhe do item.",v.id);
    }
  }
  if(!p.variantes.some(v=>v.ativo)) add("sem_variante_ativa","variantes","erro","loja","Não há apresentação ativa.","Ative uma apresentação na grade.");
  return ocorrencias;
}
