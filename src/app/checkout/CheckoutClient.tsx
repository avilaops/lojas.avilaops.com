"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckoutScreen, MercadoPagoCardBrick } from "@avilaops/checkout/ui";
import { FRETE_RETIRADA_ID, type ItemCarrinho, type MeioPagamento, type OpcaoFrete, type ResultadoPagamento } from "@avilaops/checkout";
import { useCart } from "@/components/cart/CartProvider";
import type { TenantPublico } from "@/lib/tenant";

/**
 * A tela é a do @avilaops/checkout — a mesma em todas as lojas. O que este
 * arquivo faz é ligar carrinho local → frete da loja → /api/checkout, e
 * decidir o que mostrar depois (PIX, boleto, aprovado).
 */

function novaReferencia(slug: string) {
  return `${slug}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
}

export default function CheckoutClient({ loja }: { loja: TenantPublico }) {
  const { itens, limpar, pronto, cupom } = useCart();
  const router = useRouter();
  const [fretes, setFretes] = useState<OpcaoFrete[]>(() =>
    loja.retiradaNaLoja ? [{ id: FRETE_RETIRADA_ID, nome: "Retirar na loja", preco: 0, prazoDiasUteis: loja.despachoDiasUteis }] : [],
  );
  const [resultado, setResultado] = useState<ResultadoPagamento | null>(null);
  const [referencia] = useState(() => novaReferencia(loja.slug));

  const itensCheckout = useMemo<ItemCarrinho[]>(
    () => itens.map((i) => ({ id: i.id, nome: i.nome, quantidade: i.quantidade, precoUnitario: i.precoCentavos, imagem: i.imagem })),
    [itens],
  );
  const ids = useMemo(() => itens.map((i) => ({ id: i.id, quantidade: i.quantidade })), [itens]);

  // Polling do PIX: quando cair, vai para a página do pedido.
  useEffect(() => {
    if (!resultado || resultado.status !== "pendente" || resultado.meioPagamento !== "pix") return;
    const timer = setInterval(async () => {
      const r = await fetch(`/api/checkout/status?id=${encodeURIComponent(resultado.id)}`).then((x) => x.json()).catch(() => null);
      if (r?.status === "aprovado") {
        clearInterval(timer);
        limpar();
        router.push(`/pedido/${referencia}`);
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [resultado, limpar, referencia, router]);

  if (!pronto) return null;
  if (itens.length === 0 && !resultado) {
    return (
      <div className="container-loja py-16 text-center">
        <p>Seu carrinho está vazio.</p>
        <Link href="/produtos" className="btn-primario mt-4">Ver produtos</Link>
      </div>
    );
  }

  async function aoInformarCep(cep: string) {
    const r = await fetch("/api/frete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cep, itens: ids, cupom: cupom?.codigo }) });
    const opcoes = (await r.json()) as OpcaoFrete[];
    setFretes(opcoes);
    return opcoes;
  }

  async function aoFinalizar(dados: Parameters<NonNullable<React.ComponentProps<typeof CheckoutScreen>["aoFinalizar"]>>[0]) {
    const r = await fetch("/api/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        referencia,
        itens: ids,
        cupom: cupom?.codigo,
        cliente: dados.cliente,
        entrega: dados.entrega,
        freteId: dados.freteId,
        meioPagamento: dados.meioPagamento,
        cartao: dados.cartaoToken ? { token: dados.cartaoToken, parcelas: dados.parcelas, bandeira: dados.bandeira } : undefined,
      }),
    });
    const corpo = await r.json();
    if (!r.ok) throw new Error(corpo?.erro ?? "Não foi possível processar o pagamento.");
    const res = corpo as ResultadoPagamento;
    setResultado(res);
    if (res.status === "aprovado") {
      limpar();
      router.push(`/pedido/${referencia}`);
    } else if (res.meioPagamento === "boleto") {
      limpar();
    }
    return res;
  }

  if (resultado && resultado.status === "pendente" && resultado.pix) {
    return (
      <div className="container-loja max-w-lg py-10 text-center">
        <h1 className="text-xl font-bold">Pague com PIX</h1>
        <p className="mt-1 text-sm text-muted-foreground">Abra o app do seu banco e escaneie o código. A confirmação é automática.</p>
        {resultado.pix.qrCodeBase64 && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`data:image/png;base64,${resultado.pix.qrCodeBase64}`} alt="QR Code PIX" className="mx-auto mt-6 h-56 w-56 rounded-lg border border-border bg-white p-2" />
        )}
        <textarea readOnly value={resultado.pix.copiaECola} className="mt-4 h-24 w-full rounded-lg border border-border bg-card p-2 text-xs" onFocus={(e) => e.currentTarget.select()} />
        <button className="btn-secundario mt-2 w-full" onClick={() => navigator.clipboard?.writeText(resultado.pix!.copiaECola)}>
          Copiar código
        </button>
        <p className="mt-4 text-xs text-muted-foreground">Pedido {referencia}</p>
      </div>
    );
  }

  if (resultado && resultado.boleto) {
    return (
      <div className="container-loja max-w-lg py-10 text-center">
        <h1 className="text-xl font-bold">Boleto gerado</h1>
        <p className="mt-1 text-sm text-muted-foreground">O pedido é confirmado após a compensação (até 3 dias úteis).</p>
        <a href={resultado.boleto.url} target="_blank" rel="noopener" className="btn-primario mt-6 w-full">Abrir boleto</a>
        {resultado.boleto.linhaDigitavel && <p className="mt-3 break-all text-xs">{resultado.boleto.linhaDigitavel}</p>}
        <Link href={`/pedido/${referencia}`} className="btn-secundario mt-2 w-full">Ver pedido</Link>
      </div>
    );
  }

  return (
    <div className="container-loja py-8">
      <h1 className="mb-6 text-2xl font-bold">Finalizar compra</h1>
      <CheckoutScreen
        itens={itensCheckout}
        fretes={fretes}
        meiosPagamento={loja.meiosPagamento as MeioPagamento[]}
        aoInformarCep={aoInformarCep}
        aoFinalizar={aoFinalizar}
        desconto={cupom?.desconto ?? 0}
        slotCartao={
          loja.mpPublicKey
            ? ({ totalEmCentavos, emailCliente, aoTokenizar }) => (
                <MercadoPagoCardBrick publicKey={loja.mpPublicKey!} totalEmCentavos={totalEmCentavos} emailCliente={emailCliente} aoTokenizar={aoTokenizar} />
              )
            : undefined
        }
      />
    </div>
  );
}
