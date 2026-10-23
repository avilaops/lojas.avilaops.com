"use client";

import { useEffect, useState } from "react";
import Link from "@/components/LinkLoja";

/**
 * O Pix que cai na conta da loja. Não confirma sozinho: a pessoa paga o valor
 * exato, avisa, e a loja confere.
 */
export default function PixNaConta({
  referencia,
  valorFormatado,
  copiaECola,
  qrCodeBase64,
  expiraEm,
  jaAvisou = false,
}: {
  referencia: string;
  valorFormatado: string;
  copiaECola: string;
  qrCodeBase64?: string;
  expiraEm?: string;
  jaAvisou?: boolean;
}) {
  const [aviso, setAviso] = useState<string | null>(jaAvisou ? "A loja já foi avisada. Ela confere o Pix e libera o pedido." : null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  // A tela troca no lugar do checkout: sem isso o celular fica rolado lá
  // embaixo e o título "Pague com Pix" some acima da dobra.
  useEffect(() => { window.scrollTo({ top: 0 }); }, [aviso]);
  const prazo = expiraEm ? new Date(expiraEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : null;

  async function avisar() {
    setOcupado(true);
    setErro(null);
    const form = new FormData();
    form.set("referencia", referencia);
    const r = await fetch("/api/checkout/pix/ja-paguei", { method: "POST", body: form });
    const corpo = (await r.json().catch(() => null)) as { mensagem?: string; erro?: string } | null;
    setOcupado(false);
    if (!r.ok) {
      setErro(corpo?.erro ?? "Não consegui avisar a loja. Tente de novo.");
      return;
    }
    setAviso(corpo?.mensagem ?? "Aviso recebido. A loja confere o Pix e libera o pedido.");
  }

  if (aviso) {
    // Depois do aviso, o QR sai da tela: pagar de novo seria cobrar duas vezes.
    return (
      <div className="container-loja max-w-lg py-10 text-center">
        <h1 className="text-xl font-bold">Pix avisado, em conferência</h1>
        <p className="mt-2 text-sm text-muted-foreground">{aviso}</p>
        <p className="mt-4 text-2xl font-bold tabular-nums">{valorFormatado}</p>
        <p className="mt-1 text-xs text-muted-foreground">Não pague de novo. Se o Pix não aparecer na conta da loja, ela avisa você.</p>
        <Link href={`/pedido/${referencia}`} className="btn-primario mt-6 w-full">Acompanhar o pedido</Link>
      </div>
    );
  }

  return (
    <div className="container-loja max-w-lg py-10 text-center">
      {/* O botão do WhatsApp cobria o "Já paguei" no celular: nesta tela ele sai. */}
      <style>{".whatsapp-flutuante{display:none !important}"}</style>
      <h1 className="text-xl font-bold">Pague com Pix</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Abra o app do banco e escaneie o código, ou copie o código. Pague exatamente {valorFormatado}, sem arredondar: os centavos identificam o seu pedido.
      </p>
      <p className="mt-4 text-2xl font-bold tabular-nums">{valorFormatado}</p>
      {qrCodeBase64 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`data:image/png;base64,${qrCodeBase64}`} alt="QR Code do Pix" className="mx-auto mt-6 h-56 w-56 rounded-lg border border-border bg-white p-2" />
      )}
      <textarea aria-label="Código Pix copia e cola" readOnly value={copiaECola} className="mt-4 h-24 w-full rounded-lg border border-border bg-card p-2 text-xs" onFocus={(e) => e.currentTarget.select()} />
      <button type="button" className="btn-secundario mt-2 w-full" onClick={() => navigator.clipboard?.writeText(copiaECola)}>
        Copiar código
      </button>
      {prazo && <p className="mt-3 text-xs text-muted-foreground">Este Pix vale até {prazo}.</p>}
      <p className="mt-6 text-xs text-muted-foreground">A loja confere o Pix na conta dela. Não é aprovação automática.</p>
      {erro && <p className="mt-2 text-sm text-red-700">{erro}</p>}
      <button type="button" className="btn-primario mt-3 w-full" disabled={ocupado} onClick={() => void avisar()}>
        {ocupado ? "Enviando…" : "Já paguei"}
      </button>
      <Link href={`/pedido/${referencia}`} className="btn-secundario mt-2 w-full">Acompanhar o pedido</Link>
    </div>
  );
}
