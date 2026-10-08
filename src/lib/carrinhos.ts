import type { Prisma, Tenant } from "@prisma/client";
import { prisma } from "./db";
import { emitir, itensParaTexto } from "./eventos";
import { urlDaLoja } from "./tenant";

/**
 * Carrinho abandonado.
 *
 * Quando a pessoa passa do passo de identificação no checkout, a loja já sabe
 * nome, e-mail e celular: registramos um CheckoutAberto. Se o pedido nascer,
 * ele vira CONVERTIDO. Se depois de MINUTOS_ATE_LEMBRAR continuar ABERTO, a
 * rotina (n8n de hora em hora → /api/admin/carrinhos/verificar) emite
 * `carrinho.abandonado` — uma vez só por checkout — e o n8n manda WhatsApp/e-mail
 * com o link do carrinho.
 */
const MINUTOS_ATE_LEMBRAR = Number(process.env.LOJAS_MINUTOS_CARRINHO ?? 45);

export interface ItemCheckoutAberto { id: string; nome: string; quantidade: number; precoUnitario: number }

export async function registrarCheckoutAberto(t: Tenant, dados: { referencia: string; clienteNome: string; clienteEmail: string; clienteTelefone: string; itens: ItemCheckoutAberto[] }) {
  const totalCentavos = dados.itens.reduce((s, i) => s + i.precoUnitario * i.quantidade, 0);
  const itens = dados.itens as unknown as Prisma.InputJsonValue;
  await prisma.checkoutAberto.upsert({
    where: { referencia: dados.referencia },
    update: { clienteNome: dados.clienteNome, clienteEmail: dados.clienteEmail, clienteTelefone: dados.clienteTelefone, itens, totalCentavos },
    create: { tenantId: t.id, referencia: dados.referencia, clienteNome: dados.clienteNome, clienteEmail: dados.clienteEmail, clienteTelefone: dados.clienteTelefone, itens, totalCentavos },
  });
}

export async function marcarConvertido(referencia: string) {
  await prisma.checkoutAberto.updateMany({ where: { referencia, status: { not: "CONVERTIDO" } }, data: { status: "CONVERTIDO" } });
}

export async function verificarCarrinhosAbandonados(): Promise<{ lembrados: number }> {
  const limite = new Date(Date.now() - MINUTOS_ATE_LEMBRAR * 60_000);
  // Só de lojas que vendem; e nunca mais velho que 3 dias (lembrete tardio irrita).
  const abertos = await prisma.checkoutAberto.findMany({
    where: { status: "ABERTO", criadoEm: { lte: limite, gte: new Date(Date.now() - 3 * 86_400_000) }, tenant: { status: "ATIVA" } },
    include: { tenant: true },
    take: 200,
  });
  let lembrados = 0;
  for (const c of abertos) {
    // Pedido com a mesma referência já existe? Então converteu sem passar pelo marcador.
    const pedido = await prisma.pedido.findUnique({ where: { referencia: c.referencia }, select: { id: true } });
    if (pedido) {
      await prisma.checkoutAberto.update({ where: { id: c.id }, data: { status: "CONVERTIDO" } });
      continue;
    }
    // Reivindica antes de avisar. A rotina e o n8n chamam esta verificação no
    // mesmo horário: lendo ABERTO, avisando e só depois gravando LEMBRADO, as
    // duas passadas mandavam o mesmo lembrete ao comprador.
    const meu = await prisma.checkoutAberto.updateMany({ where: { id: c.id, status: "ABERTO" }, data: { status: "LEMBRADO", lembradoEm: new Date() } });
    if (meu.count !== 1) continue;
    const itens = (c.itens as unknown as ItemCheckoutAberto[]).map((i) => ({ nome: i.nome, quantidade: i.quantidade, precoCentavos: i.precoUnitario }));
    const t = c.tenant;
    await emitir({
      tipo: "carrinho.abandonado",
      slug: t.slug,
      referencia: c.referencia,
      clienteNome: c.clienteNome,
      clienteEmail: c.clienteEmail,
      clienteTelefone: c.clienteTelefone,
      itens,
      itensTexto: itensParaTexto(itens),
      totalCentavos: c.totalCentavos,
      linkCarrinho: `${urlDaLoja(t)}/carrinho`,
      lojaNome: t.nome,
      lojaUrl: urlDaLoja(t),
      lojistaWhatsapp: t.whatsapp,
      lojistaEmail: t.loginEmail ?? t.emailContato,
      emailRemetente: t.emailRemetente,
    }, { chave: `abandonado:${c.referencia}` });
    lembrados++;
  }
  return { lembrados };
}
