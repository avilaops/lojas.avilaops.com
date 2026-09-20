"use client";

import { useMemo, useState } from "react";

type Foto = { arquivo: File; sku: string; url?: string; erro?: string; enviando?: boolean };

function skuDoNome(nome: string) {
  return nome.replace(/\.[^.]+$/, "").replace(/^foto[-_]/i, "").trim();
}

export default function ImportarFotosPorSku({ chamar, ocupado, aoConcluir }: {
  chamar: (c: string, m: string, b?: unknown, s?: string) => Promise<unknown>;
  ocupado: boolean;
  aoConcluir: () => void;
}) {
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [confirmado, setConfirmado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [associando, setAssociando] = useState(false);
  const duplicados = useMemo(() => {
    const contagem = new Map<string, number>();
    fotos.forEach((f) => contagem.set(f.sku, (contagem.get(f.sku) ?? 0) + 1));
    return new Set([...contagem].filter(([, n]) => n > 1).map(([sku]) => sku));
  }, [fotos]);

  function selecionar(arquivos: FileList | null) {
    const escolhidos = Array.from(arquivos ?? []).slice(0, 50).map((arquivo) => ({ arquivo, sku: skuDoNome(arquivo.name) }));
    setFotos(escolhidos.map((f) => ({ ...f, erro: !f.sku ? "Nomeie o arquivo com o SKU, por exemplo ABC123.jpg." : undefined })));
    setConfirmado(false);
  }

  async function enviar() {
    if (!confirmado || fotos.length === 0 || enviando || duplicados.size) return;
    setEnviando(true);
    const atualizadas = [...fotos];
    for (let i = 0; i < atualizadas.length; i++) {
      const f = atualizadas[i];
      if (f.url || f.erro) continue;
      atualizadas[i] = { ...f, enviando: true };
      setFotos([...atualizadas]);
      try {
        const fd = new FormData(); fd.append("arquivo", f.arquivo); fd.append("sku", f.sku);
        const r = await fetch("/api/painel/imagens", { method: "POST", body: fd });
        const d = await r.json();
        if (!r.ok) throw new Error(d?.erro ?? "Falha no envio.");
        atualizadas[i] = { ...f, url: d.url };
      } catch (e) {
        atualizadas[i] = { ...f, erro: e instanceof Error ? e.message : "Falha no envio." };
      }
      setFotos([...atualizadas]);
    }
    setEnviando(false);
  }

  async function associar() {
    const prontas = fotos.filter((f) => f.url && !f.erro);
    if (!prontas.length || associando || ocupado) return;
    setAssociando(true);
    const resposta = await chamar("/api/painel/produtos", "PUT", prontas.map((f) => ({ sku: f.sku, imagens: [f.url], imagemOrigem: "propria", confirmarImagemExata: true })), "Fotos associadas ao catálogo.");
    setAssociando(false);
    if (resposta) { setFotos([]); setConfirmado(false); aoConcluir(); }
  }

  const pendentes = fotos.filter((f) => !f.url && !f.erro).length;
  const prontas = fotos.filter((f) => f.url && !f.erro).length;
  const bloqueadas = fotos.some((f) => !f.sku || f.erro) || duplicados.size > 0;

  return <details className="mb-4 rounded-xl border border-border bg-background p-4">
    <summary className="cursor-pointer font-medium">Enviar fotos por SKU</summary>
    <p className="mt-2 text-sm text-muted-foreground">Selecione até 50 imagens nomeadas com o SKU, como ABC123.jpg. O arquivo fica associado depois que você confirma a correspondência.</p>
    <label className="mt-3 inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-border px-3 text-sm">
      Escolher imagens<input className="sr-only" type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" disabled={enviando || associando} onChange={(e) => selecionar(e.target.files)} />
    </label>
    {fotos.length > 0 && <>
      <ul className="my-3 max-h-64 space-y-1 overflow-auto text-sm">
        {fotos.map((f, i) => <li key={`${f.arquivo.name}-${i}`} className="flex flex-wrap justify-between gap-2 border-b border-border py-2"><span>{f.arquivo.name} <span className="text-muted-foreground">→ SKU {f.sku || "não identificado"}</span></span><span>{f.enviando ? "Enviando…" : f.url ? "Enviado" : f.erro ?? (duplicados.has(f.sku) ? "SKU repetido nesta seleção" : "Aguardando")}</span></li>)}
      </ul>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} /> Confirmo que cada imagem mostra exatamente o produto e apresentação correspondentes ao SKU.</label>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn-secundario h-10 px-3 text-sm" disabled={!confirmado || bloqueadas || enviando || !pendentes} onClick={() => void enviar()}>{enviando ? "Enviando fotos…" : `Enviar ${pendentes} foto(s)`}</button>
        <button type="button" className="btn-primario h-10 px-3 text-sm" disabled={!confirmado || !prontas || associando || ocupado} onClick={() => void associar()}>{associando ? "Associando…" : `Associar ${prontas} foto(s) ao catálogo`}</button>
      </div>
    </>}
  </details>;
}
