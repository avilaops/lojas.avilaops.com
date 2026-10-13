"use client";

import { useState } from "react";
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
  const [arquivo, setArquivo] = useState<File | null>(null);
  const prazo = expiraEm ? new Date(expiraEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : null;

  async function avisar() {
    setOcupado(true);
    setErro(null);
    const form = new FormData();
    form.set("referencia", referencia);
    if (arquivo) form.set("comprovante", arquivo);
    const r = await fetch("/api/checkout/pix/ja-paguei", { method: "POST", body: form });
    const corpo = (await r.json().catch(() => null)) as { mensagem?: string; erro?: string } | null;
    setOcupado(false);
    if (!r.ok) {
      setErro(corpo?.erro ?? "Não consegui avisar a loja. Tente de novo.");
      return;
    }
    setAviso(corpo?.mensagem ?? "Aviso recebido. A loja confere o Pix e libera o pedido.");
  }

  return (
    <div className="container-loja max-w-lg py-10 text-center">
      <h1 className="text-xl font-bold">Pague com Pix</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Abra o app do banco e escaneie o código, ou copie o código. Pague exatamente {valorFormatado}, sem arredondar: os centavos identificam o seu pedido.
      </p>
      <p className="mt-4 text-2xl font-bold">{valorFormatado}</p>
      {qrCodeBase64 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`data:image/png;base64,${qrCodeBase64}`} alt="QR Code do Pix" className="mx-auto mt-6 h-56 w-56 rounded-lg border border-border bg-white p-2" />
      )}
      <textarea readOnly value={copiaECola} className="mt-4 h-24 w-full rounded-lg border border-border bg-card p-2 text-xs" onFocus={(e) => e.currentTarget.select()} />
      <button type="button" className="btn-secundario mt-2 w-full" onClick={() => navigator.clipboard?.writeText(copiaECola)}>
        Copiar código
      </button>
      {prazo && <p className="mt-3 text-xs text-muted-foreground">Este Pix vale até {prazo}.</p>}
      {aviso ? (
        <p className="mt-6 text-sm">{aviso}</p>
      ) : (
        <div className="mt-6 text-left">
          <label className="block text-xs text-muted-foreground">
            Comprovante (opcional)
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="mt-1 block w-full text-sm"
              onChange={(e) => setArquivo(e.currentTarget.files?.[0] ?? null)}
            />
          </label>
          <p className="mt-1 text-xs text-muted-foreground">Se quiser, anexe o comprovante para a loja conferir mais rápido.</p>
          {erro && <p className="mt-2 text-sm text-red-700">{erro}</p>}
          <button type="button" className="btn-primario mt-3 w-full" disabled={ocupado} onClick={() => void avisar()}>
            {ocupado ? "Enviando…" : "Já paguei"}
          </button>
        </div>
      )}
      <Link href={`/pedido/${referencia}`} className="btn-secundario mt-2 w-full">Acompanhar o pedido</Link>
    </div>
  );
}
