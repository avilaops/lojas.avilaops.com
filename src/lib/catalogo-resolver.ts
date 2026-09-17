import type { ItemCarrinho } from "@avilaops/checkout";
import { prisma } from "./db";
import { INCLUIR_OFERTA, ofertaDaVariante } from "./catalogo-oferta";
import { dispensavelADistancia } from "./produto-regras";

/** IDs antigos de produtos simples continuam aceitos; a saída sempre identifica a variante. */
export async function resolverItensPadronizados(tenantId: string, pedidos: Array<{ id: string; quantidade: number }>): Promise<ItemCarrinho[]> {
  if (pedidos.some(p=>!Number.isSafeInteger(p.quantidade) || p.quantidade<1 || typeof p.id!=="string" || p.id.split(":").length>2)) return [];
  const pares = pedidos.map(p=>({ ...p, produtoId: p.id.split(":")[0], varianteId: p.id.split(":")[1] }));
  const produtos = await prisma.produto.findMany({ where: { tenantId, ativo: true, id: { in: pares.map(p=>p.produtoId) } }, include: { variantes: { where: { ativo: true }, include: INCLUIR_OFERTA } } });
  const quantidades = new Map<string,number>();
  const resolvidos = pares.map(item=>{
    const p = produtos.find(p=>p.id===item.produtoId);
    const variante = p?.variantes.find(v=>item.varianteId ? v.id===item.varianteId : v.padrao);
    if (!p || !variante) return null;
    const v = ofertaDaVariante(variante);
    quantidades.set(v.id,(quantidades.get(v.id)??0)+item.quantidade);
    return { item, p, v };
  });
  return resolvidos.flatMap(r=>{
    // Controle especial nunca entra no carrinho, venha o id de onde vier:
    // a vitrine já não oferece o botão, e aqui é onde isso deixa de ser
    // aparência. Ver dispensavelADistancia em produto-regras.
    if (!r || !r.v.compravel || !dispensavelADistancia(r.p) || (r.v.estoque!=null && r.v.estoque < quantidades.get(r.v.id)!)) return [];
    const { p,v,item } = r;
    return [{ id: `${p.id}:${v.id}`, nome: v.padrao ? p.nome : `${p.nome} · ${v.nome}`, quantidade: item.quantidade,
      precoUnitario: v.precoCentavos, sku: v.sku ?? undefined, imagem: v.imagem ?? p.imagens[0],
      pesoGramas: v.pesoKg!=null ? Math.round(v.pesoKg*1000) : undefined,
      alturaCm: v.alturaCm ?? undefined, larguraCm: v.larguraCm ?? undefined, comprimentoCm: v.comprimentoCm ?? undefined,
    }];
  });
}
