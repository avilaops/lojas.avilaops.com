import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { ItemCarrinho } from "@avilaops/checkout";
import { prisma } from "./db";
import { atualizarProjecao, permitirProjecao, travarProduto } from "./catalogo-escrita";
import { dispensavelADistancia } from "./produto-regras";
import { ErroCatalogo, ofertaDaVariante } from "./catalogo-oferta";

type Tx = Prisma.TransactionClient;

async function projetarComEvento(tx: Tx, tenantId: string, ids: string[]) {
  for (const id of [...new Set(ids)].sort()) {
    await atualizarProjecao(tx, tenantId, id);
    const p = await tx.produto.update({ where: { id }, data: { versaoCatalogo: { increment: 1 } } });
    await tx.eventoCatalogo.create({ data: { tenantId, produtoId: id, versao: p.versaoCatalogo, tipo: "catalogo.estoque-alterado" } });
  }
}

/** Reserva antes da cobrança, na mesma ordem de locks usada na edição. */
export async function reservarEstoque(tenantId: string, referencia: string, itens: ItemCarrinho[]) {
  if (!referencia || referencia.length>120 || !itens.length) throw new ErroCatalogo("Referência de checkout inválida.");
  const hash = createHash("sha256").update(JSON.stringify(itens.map(i=>[i.id,i.quantidade,i.precoUnitario]).sort())).digest("hex");
  try {
    return await prisma.$transaction(async tx=>{
      await permitirProjecao(tx);
      if (await tx.pedido.findUnique({ where: { referencia }, select: { id: true } })) throw new ErroCatalogo("Esta tentativa já foi recebida. Consulte o pedido antes de tentar pagar novamente.", 409);
      // Unicidade impede duas cobranças concorrentes da mesma tentativa.
      await tx.tentativaCatalogo.create({ data: { tenantId, referencia, resumoHash: hash } });
      const produtoIds = [...new Set(itens.map(i=>i.id.split(":")[0]))].sort();
      const produtos = [];
      for (const id of produtoIds) produtos.push(await travarProduto(tx, tenantId, id));
      const porVariante = new Map<string,{ quantidade:number; preco:number; produtoId:string }>();
      for (const item of itens) {
        const [produtoId,varianteId] = item.id.split(":");
        if (!varianteId || !Number.isSafeInteger(item.quantidade) || item.quantidade<1) throw new ErroCatalogo("Unidade vendável inválida.");
        const anterior = porVariante.get(varianteId);
        porVariante.set(varianteId,{ produtoId, quantidade:(anterior?.quantidade??0)+item.quantidade, preco:item.precoUnitario });
      }
      for (const [varianteId,item] of [...porVariante.entries()].sort()) {
        const p = produtos.find(p=>p.id===item.produtoId);
        const original = p?.variantes.find(v=>v.id===varianteId);
        const v = original && ofertaDaVariante(original);
        if (p && !dispensavelADistancia(p)) throw new ErroCatalogo("Este medicamento é de controle especial e só pode ser dispensado presencialmente.",422);
        if (!p?.ativo || !v?.compravel || v.precoCentavos!==item.preco || (v.estoque!=null && v.estoque<item.quantidade)) throw new ErroCatalogo("Preço ou estoque mudou. Revise o carrinho antes de pagar.",409);
        const saldo = v.saldos.find(s=>s.local==="principal");
        if (!saldo) throw new ErroCatalogo("Estoque da apresentação não cadastrado.");
        if (saldo.fisico!=null) {
          const atualizado = await tx.saldoEstoque.updateMany({ where: { id:saldo.id, reservado:saldo.reservado, fisico:{gte:saldo.reservado+item.quantidade} }, data:{reservado:{increment:item.quantidade}} });
          if (!atualizado.count) throw new ErroCatalogo("A última unidade acabou de ser reservada.",409);
        }
        await tx.reservaEstoque.create({data:{tenantId,referencia,varianteId,quantidade:item.quantidade}});
      }
      await projetarComEvento(tx,tenantId,produtoIds);
    },{timeout:20000});
  } catch(e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code==="P2002") throw new ErroCatalogo("Esta tentativa já foi recebida. Consulte o pedido antes de tentar pagar novamente.",409);
    throw e;
  }
}

/** Só libera após resposta conclusiva de recusa/cancelamento. Timeout é incerto. */
export async function liberarReservas(tenantId: string, referencia: string) {
  await prisma.$transaction(async tx=>{
    await permitirProjecao(tx);
    await tx.$queryRaw`SELECT id FROM "TentativaCatalogo" WHERE "tenantId"=${tenantId} AND referencia=${referencia} FOR UPDATE`;
    const reservas = await tx.reservaEstoque.findMany({where:{tenantId,referencia,estado:"ATIVA"},include:{variante:true}});
    const ids = [...new Set(reservas.map(r=>r.variante.produtoId))].sort();
    for (const id of ids) await travarProduto(tx,tenantId,id);
    for(const r of reservas) {
      const alterada = await tx.reservaEstoque.updateMany({where:{id:r.id,estado:"ATIVA"},data:{estado:"LIBERADA"}});
      if(alterada.count) await tx.saldoEstoque.updateMany({where:{tenantId,varianteId:r.varianteId,local:"principal",fisico:{not:null}},data:{reservado:{decrement:r.quantidade}}});
    }
    await tx.tentativaCatalogo.updateMany({where:{tenantId,referencia,estado:{not:"CONFIRMADA"}},data:{estado:"LIBERADA"}});
    await projetarComEvento(tx,tenantId,ids);
  },{timeout:20000});
}

/** O que uma linha do pedido pede, no mínimo que a baixa precisa saber. */
export interface ItemParaBaixa { produtoId: string | null; varianteId: string | null; quantidade: number }
/** O produto travado, com as apresentações que ele tem. */
export interface ProdutoParaBaixa { id: string; variantes: Array<{ id: string; padrao: boolean; ativo: boolean }> }

/**
 * Quanto sai de cada apresentação, a partir das linhas do pedido.
 *
 * Separado da transação porque é a decisão mais cara de errar do sistema —
 * estoque que desce da apresentação errada não dá erro, dá cancelamento duas
 * semanas depois — e decisão assim precisa de teste, não de leitura atenta.
 *
 * Duas linhas não baixam nada, e as duas por motivo declarado:
 *
 * - **Sem produto**: venda de canal cujo anúncio não está ligado a nenhum
 *   produto desta loja. Não há estoque nosso a mexer. Lançar aqui derrubava a
 *   baixa do pedido inteiro, inclusive das linhas que casaram.
 * - **Sem variante, em produto com várias**: venda de canal cuja apresentação
 *   não foi reconhecida (ver `resolverVariante`). A padrão só serve quando é a
 *   única que existe; escolhê-la no escuro erra duas de uma vez — tira do que
 *   está na prateleira e deixa à venda o que acabou.
 *
 * O checkout da loja não cai em nenhuma das duas: a linha dele nasce com
 * produto e variante, vindos do id do carrinho.
 */
export function agruparParaBaixa(
  itens: ItemParaBaixa[],
  produtos: ProdutoParaBaixa[],
): { grupos: Map<string, number>; naoBaixados: ItemParaBaixa[] } {
  const grupos = new Map<string, number>();
  const naoBaixados: ItemParaBaixa[] = [];

  for (const item of itens) {
    if (!item.produtoId) { naoBaixados.push(item); continue; }
    const p = produtos.find(p => p.id === item.produtoId);
    if (!item.varianteId && p && p.variantes.filter(v => v.ativo).length > 1) { naoBaixados.push(item); continue; }
    const v = p?.variantes.find(v => item.varianteId ? v.id === item.varianteId : v.padrao);
    if (!v) throw new ErroCatalogo("Pedido sem variante de estoque reconciliada.", 409);
    grupos.set(v.id, (grupos.get(v.id) ?? 0) + item.quantidade);
  }

  return { grupos, naoBaixados };
}

/** Idempotência e baixa na mesma transação. Pedidos antigos mantêm os snapshots. */
export async function confirmarEstoqueDoPedido(pedidoId: string) {
  return prisma.$transaction(async tx=>{
    await permitirProjecao(tx);
    await tx.$queryRaw`SELECT id FROM "Pedido" WHERE id=${pedidoId} FOR UPDATE`;
    const pedido = await tx.pedido.findUnique({where:{id:pedidoId},include:{itens:true}});
    if(!pedido || pedido.estoqueBaixado) return;
    // Mesma ordem que liberar: tentativa antes de produto.
    await tx.$queryRaw`SELECT id FROM "TentativaCatalogo" WHERE "tenantId"=${pedido.tenantId} AND referencia=${pedido.referencia} FOR UPDATE`;
    const ids = [...new Set(pedido.itens.flatMap(i=>i.produtoId?[i.produtoId]:[]))].sort();
    const produtos = [];
    for(const id of ids) produtos.push(await travarProduto(tx,pedido.tenantId,id));
    const { grupos } = agruparParaBaixa(pedido.itens, produtos);
    for(const [varianteId,quantidade] of [...grupos.entries()].sort()) {
      const reserva = await tx.reservaEstoque.findUnique({where:{tenantId_referencia_varianteId:{tenantId:pedido.tenantId,referencia:pedido.referencia,varianteId}}});
      if(reserva && reserva.estado!=="ATIVA") throw new ErroCatalogo("Pagamento chegou após liberação da reserva. Reconciliar estoque antes de separar.",409);
      const saldo = await tx.saldoEstoque.findUnique({where:{tenantId_varianteId_local:{tenantId:pedido.tenantId,varianteId,local:"principal"}}});
      if(!saldo || reserva && reserva.quantidade!==quantidade) throw new ErroCatalogo("Quantidade reservada diverge do pedido.",409);
      if(saldo.fisico!=null) {
        const abaterReserva = reserva?.quantidade??0;
        if(saldo.fisico-saldo.reservado+abaterReserva<quantidade) throw new ErroCatalogo("Saldo insuficiente para confirmar este pedido.",409);
        await tx.saldoEstoque.update({where:{id:saldo.id},data:{fisico:{decrement:quantidade},reservado:{decrement:abaterReserva}}});
      }
      if(reserva) await tx.reservaEstoque.update({where:{id:reserva.id},data:{estado:"CONFIRMADA"}});
      await tx.movimentoEstoque.create({data:{tenantId:pedido.tenantId,varianteId,chave:`pedido:${pedido.id}:${varianteId}`,quantidade:-quantidade,motivo:"pedido_pago"}});
    }
    if(pedido.cupomCodigo) await tx.cupom.updateMany({where:{tenantId:pedido.tenantId,codigo:pedido.cupomCodigo},data:{usos:{increment:1}}});
    await tx.pedido.update({where:{id:pedido.id},data:{estoqueBaixado:true}});
    await tx.tentativaCatalogo.updateMany({where:{tenantId:pedido.tenantId,referencia:pedido.referencia},data:{estado:"CONFIRMADA"}});
    await projetarComEvento(tx,pedido.tenantId,ids);
  },{timeout:20000});
}
