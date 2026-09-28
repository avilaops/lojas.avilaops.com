"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Foto = { arquivo: File; sku: string; previa: string; confirmada: boolean; url?: string; produtoId?: string; erro?: string; erroAssociacao?: string; enviando?: boolean; associado?: boolean };

function skuDoNome(nome: string) {
  return nome.replace(/\.[^.]+$/, "").replace(/^foto[-_]/i, "").trim();
}

export default function ImportarFotosPorSku({ ocupado, aoConcluir }: {
  ocupado: boolean;
  aoConcluir: () => void;
}) {
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [associando, setAssociando] = useState(false);
  const previas = useRef(new Set<string>());
  useEffect(() => () => previas.current.forEach((url) => URL.revokeObjectURL(url)), []);
  const duplicados = useMemo(() => {
    const contagem = new Map<string, number>();
    fotos.forEach((f) => contagem.set(f.sku, (contagem.get(f.sku) ?? 0) + 1));
    return new Set([...contagem].filter(([, n]) => n > 1).map(([sku]) => sku));
  }, [fotos]);

  function selecionar(arquivos: FileList | null) {
    previas.current.forEach((url) => URL.revokeObjectURL(url));
    previas.current.clear();
    const escolhidos = Array.from(arquivos ?? []).slice(0, 50).map((arquivo) => {
      const previa = URL.createObjectURL(arquivo);
      previas.current.add(previa);
      return { arquivo, previa, sku: skuDoNome(arquivo.name), confirmada: false };
    });
    setFotos(escolhidos.map((f) => ({ ...f, erro: !f.sku ? "Nomeie o arquivo com o SKU, por exemplo ABC123.jpg." : undefined })));
  }

  async function enviar() {
    if (!fotos.some((f) => f.confirmada && !f.url && !f.erro) || enviando || duplicados.size) return;
    setEnviando(true);
    const atualizadas = [...fotos];
    for (let i = 0; i < atualizadas.length; i++) {
      const f = atualizadas[i];
      if (!f.confirmada || f.url || f.erro) continue;
      atualizadas[i] = { ...f, enviando: true };
      setFotos([...atualizadas]);
      try {
        const fd = new FormData(); fd.append("arquivo", f.arquivo); fd.append("sku", f.sku);
        const r = await fetch("/api/painel/imagens", { method: "POST", body: fd });
        const d = await r.json();
        if (!r.ok) throw new Error(d?.erro ?? "Falha no envio.");
        atualizadas[i] = { ...f, url: d.url, produtoId: d.produtoId };
      } catch (e) {
        atualizadas[i] = { ...f, erro: e instanceof Error ? e.message : "Falha no envio." };
      }
      setFotos([...atualizadas]);
    }
    setEnviando(false);
  }

  async function associar() {
    const prontas = fotos.filter((f) => f.confirmada && f.url && f.produtoId && !f.erro && !f.associado);
    if (!prontas.length || associando || ocupado) return;
    setAssociando(true);
    let sucessos = 0;
    const atualizadas = [...fotos];
    for (const foto of prontas) {
      const indice = atualizadas.findIndex((f) => f.arquivo === foto.arquivo);
      try {
        const resposta = await fetch("/api/painel/produtos", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: foto.produtoId, sku: foto.sku, imagens: [foto.url], imagemOrigem: "propria", confirmarImagemExata: true, associarFotoSku: true }) });
        const dados = await resposta.json();
        if (!resposta.ok) throw new Error(dados?.erro ?? "Falha ao associar.");
        atualizadas[indice] = { ...atualizadas[indice], associado: true, erroAssociacao: undefined };
        sucessos++;
      } catch (e) {
        atualizadas[indice] = { ...atualizadas[indice], erroAssociacao: e instanceof Error ? e.message : "Falha ao associar." };
      }
      setFotos([...atualizadas]);
    }
    setAssociando(false);
    if (sucessos) aoConcluir();
  }

  async function descartar(foto: Foto) {
    if (!foto.url || foto.associado || enviando || associando) return;
    try {
      const r = await fetch(`/api/painel/imagens?url=${encodeURIComponent(foto.url)}`, { method: "DELETE" });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.erro ?? "Falha ao remover.");
      setFotos((atuais) => atuais.filter((f) => f.arquivo !== foto.arquivo));
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : "Falha ao remover.";
      setFotos((atuais) => atuais.map((f) => f.arquivo === foto.arquivo ? { ...f, erroAssociacao: mensagem } : f));
    }
  }

  const pendentes = fotos.filter((f) => f.confirmada && !f.url && !f.erro).length;
  const prontas = fotos.filter((f) => f.confirmada && f.url && f.produtoId && !f.erro && !f.associado).length;
  const bloqueadas = duplicados.size > 0;
  const lotePreservado = fotos.some((f) => f.url && !f.associado);

  return <details className="mb-4 rounded-xl border border-border bg-background p-4">
    <summary className="cursor-pointer font-medium">Enviar fotos por SKU</summary>
    <p className="mt-2 text-sm text-muted-foreground">Selecione até 50 imagens nomeadas com o SKU, como ABC123.jpg. Confira a prévia e confirme cada produto separadamente antes de enviar.</p>
    <label className="mt-3 inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-border px-3 text-sm">
      Escolher imagens<input className="sr-only" type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" disabled={enviando || associando || lotePreservado} onChange={(e) => selecionar(e.target.files)} />
    </label>
    {fotos.length > 0 && <>
      <ul className="my-3 max-h-96 space-y-2 overflow-auto text-sm">
        {fotos.map((f, i) => <li key={`${f.arquivo.name}-${i}`} className="grid grid-cols-[4rem_1fr] gap-3 rounded-lg border border-border p-2">
          {/* A confirmação é por produto: uma foto correta no lote não valida as demais. */}
          <img src={f.previa} alt={`Prévia de ${f.arquivo.name}`} className="h-16 w-16 rounded-md bg-muted object-contain" />
          <div className="min-w-0">
            <p className="break-all font-medium">{f.arquivo.name}</p>
            <p className="text-muted-foreground">SKU {f.sku || "não identificado"}</p>
            <label className="mt-1 flex min-h-10 items-center gap-2"><input type="checkbox" checked={f.confirmada} disabled={!f.sku || Boolean(f.erro) || f.associado} onChange={(e) => setFotos((atuais) => atuais.map((item) => item.arquivo === f.arquivo ? { ...item, confirmada: e.target.checked } : item))} /> Esta imagem corresponde exatamente ao produto e à apresentação deste SKU.</label>
            <p className="text-xs text-muted-foreground">{f.enviando ? "Enviando…" : f.associado ? "Associado ao catálogo" : f.erroAssociacao ?? (f.url ? "Enviado, aguardando associação" : f.erro ?? (duplicados.has(f.sku) ? "SKU repetido nesta seleção" : "Aguardando confirmação"))}</p>
            {f.url && !f.associado && <button type="button" className="mt-1 underline" disabled={enviando || associando} onClick={() => void descartar(f)}>Remover upload</button>}
          </div>
        </li>)}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn-secundario h-10 px-3 text-sm" disabled={bloqueadas || enviando || !pendentes} onClick={() => void enviar()}>{enviando ? "Enviando fotos…" : `Enviar ${pendentes} foto(s) confirmada(s)`}</button>
        <button type="button" className="btn-primario h-10 px-3 text-sm" disabled={!prontas || associando || ocupado} onClick={() => void associar()}>{associando ? "Associando…" : `Associar ${prontas} foto(s) confirmada(s)`}</button>
      </div>
    </>}
  </details>;
}
