import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirTenant } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { formatarBRL } from "@/lib/catalogo";
import Rastreio from "@/components/Rastreio";
import { linkWhatsApp } from "@/components/WhatsAppFlutuante";
import EventoCompra from "@/components/EventoCompra";
import { ConviteAvaliacaoGoogle } from "@/components/AvaliacoesGoogle";
import { conviteAvaliacao } from "@/lib/avaliacoes-google";
import { TEXTO_SEM_PEDIDO, telaSemPedido } from "@/lib/pedido-a-confirmar";

export const metadata: Metadata = { title: "Pedido", robots: { index: false } };

const ROTULO: Record<string, string> = {
  AGUARDANDO_PAGAMENTO: "Aguardando pagamento",
  PAGO: "Pagamento confirmado",
  EM_SEPARACAO: "Em separação",
  ENVIADO: "Enviado",
  ENTREGUE: "Entregue",
  CANCELADO: "Cancelado",
  ESTORNADO: "Estornado",
};

export default async function PedidoPage({ params }: { params: Promise<{ referencia: string }> }) {
  const t = await exigirTenant();
  const { referencia } = await params;
  // A referência é longa e aleatória; funciona como o link "do seu pedido".
  const pedido = await prisma.pedido.findFirst({ where: { tenantId: t.id, referencia }, include: { itens: true } });
  if (!pedido) {
    // Checkout que respondeu "pagamento a confirmar" manda o comprador para cá
    // antes de existir pedido: a tentativa diz o que mostrar no lugar do 404.
    const tentativa = await prisma.tentativaCatalogo.findUnique({ where: { tenantId_referencia: { tenantId: t.id, referencia } }, select: { estado: true } });
    const tela = telaSemPedido(tentativa?.estado);
    if (!tela) notFound();
    const { titulo, texto } = TEXTO_SEM_PEDIDO[tela];
    return (
      <div className="container-loja max-w-2xl py-10">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Pedido {referencia}</p>
        <h1 className="mt-1 text-2xl font-bold">{titulo}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{texto}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {tela === "nao_concluido" ? <Link href="/carrinho" className="btn-primario">Voltar ao carrinho</Link> : <Link href="/produtos" className="btn-secundario">Continuar comprando</Link>}
          {t.whatsapp && (
            <a className={tela === "pago_sem_pedido" ? "btn-primario" : "btn-secundario"} href={linkWhatsApp(t.whatsapp, `Olá! Sobre o pagamento do pedido ${referencia}`)} target="_blank" rel="noopener">
              Falar com a loja
            </a>
          )}
          {tela === "pago_sem_pedido" && t.emailContato && (
            <a className="btn-secundario" href={`mailto:${t.emailContato}?subject=${encodeURIComponent(`Pagamento do pedido ${referencia}`)}`}>
              Escrever para a loja
            </a>
          )}
        </div>
      </div>
    );
  }
  const convite = conviteAvaliacao(t, pedido);

  return (
    <div className="container-loja max-w-2xl py-10">
      {pedido.status !== "AGUARDANDO_PAGAMENTO" && pedido.status !== "CANCELADO" && (
        <EventoCompra
          itens={pedido.itens.map((i) => ({ id: i.produtoId ?? i.nome, nome: i.nome, precoCentavos: i.precoUnitarioCentavos, quantidade: i.quantidade }))}
          totalCentavos={pedido.totalCentavos}
          freteCentavos={pedido.freteCentavos}
          referencia={pedido.referencia}
          googleAdsId={t.googleAdsId}
          rotuloCompra={t.googleAdsRotuloCompra}
        />
      )}
      {convite && <ConviteAvaliacaoGoogle convite={convite} />}
      <p className="text-xs uppercase tracking-widest text-muted-foreground">Pedido #{pedido.numero}</p>
      <h1 className="mt-1 text-2xl font-bold">{ROTULO[pedido.status] ?? pedido.status}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {pedido.status === "PAGO"
          ? `Obrigado, ${pedido.clienteNome.split(" ")[0]}! Enviamos a confirmação para ${pedido.clienteEmail}.`
          : "Assim que o pagamento for confirmado, você recebe um e-mail."}
      </p>

      <ul className="mt-6 divide-y divide-border rounded-xl border border-border bg-card text-sm">
        {pedido.itens.map((i) => (
          <li key={i.id} className="flex justify-between p-3">
            <span>{i.quantidade}x {i.nome}</span>
            <span>{formatarBRL(i.precoUnitarioCentavos * i.quantidade)}</span>
          </li>
        ))}
        <li className="flex justify-between p-3 text-muted-foreground">
          <span>{pedido.freteNome}</span>
          <span>{formatarBRL(pedido.freteCentavos)}</span>
        </li>
        <li className="flex justify-between p-3 font-bold">
          <span>Total</span>
          <span>{formatarBRL(pedido.totalCentavos)}</span>
        </li>
      </ul>

      {pedido.rastreio && <Rastreio codigo={pedido.rastreio} transportadora={pedido.freteNome} />}

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/produtos" className="btn-secundario">Continuar comprando</Link>
        {t.whatsapp && (
          <a className="btn-secundario" href={linkWhatsApp(t.whatsapp, `Olá! Sobre o pedido #${pedido.numero} (${pedido.referencia})`)} target="_blank" rel="noopener">
            Falar sobre o pedido
          </a>
        )}
      </div>
    </div>
  );
}
