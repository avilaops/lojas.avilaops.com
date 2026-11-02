"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Envio de imagem com prévia e tratamento opcional.
 *
 * A prévia aparece antes de subir (o lojista confere se pegou a foto certa) e
 * o botão "Tratar com IA" manda pelo removedor de fundo da casa: recorte no
 * produto, fundo branco e quadro quadrado — o que padroniza o catálogo.
 */
export default function EnviarImagem({ aoEnviar, rotulo = "Enviar imagem", valorAtual }: { aoEnviar: (url: string) => void; rotulo?: string; valorAtual?: string | null }) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  // A prévia é derivada do arquivo escolhido; o objectURL é criado na hora da
  // escolha e revogado quando troca, sem efeito sincronizando estado.
  const [previa, setPrevia] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<null | "simples" | "tratada" | "ampliada">(null);
  const [erro, setErro] = useState<string | null>(null);
  const [podeTratar, setPodeTratar] = useState(false);
  const [podeAmpliar, setPodeAmpliar] = useState(false);
  const [dimensoes, setDimensoes] = useState<{ largura: number; altura: number } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/painel/imagens").then((r) => r.json()).then((d) => setPodeTratar(Boolean(d?.tratamentoDisponivel))).catch(() => undefined);
    fetch("/api/painel/imagens/ampliar").then((r) => r.ok ? r.json() : null).then((d) => setPodeAmpliar(Boolean(d?.disponivel))).catch(() => undefined);
  }, []);

  async function ampliar() {
    if (!arquivo || ocupado) return;
    setErro(null);
    setOcupado("ampliada");
    try {
      const fd = new FormData();
      fd.append("arquivo", arquivo);
      const r = await fetch("/api/painel/imagens/ampliar", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.erro ?? "Falha ao ampliar imagem.");
      aoEnviar(d.url);
      setPrevia((anterior) => { if (anterior?.startsWith("blob:")) URL.revokeObjectURL(anterior); return null; });
      setArquivo(null);
      setDimensoes(null);
      if (input.current) input.current.value = "";
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha na ampliação.");
    } finally {
      setOcupado(null);
    }
  }

  async function enviar(tratar: boolean) {
    if (!arquivo) return;
    setErro(null);
    setOcupado(tratar ? "tratada" : "simples");
    try {
      const fd = new FormData();
      fd.append("arquivo", arquivo);
      const r = await fetch(`/api/painel/imagens${tratar ? "?tratar=1" : ""}`, { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.erro ?? "Falha no envio.");
      aoEnviar(d.url);
      setPrevia((anterior) => { if (anterior?.startsWith("blob:")) URL.revokeObjectURL(anterior); return null; });
      setArquivo(null);
      setDimensoes(null);
      if (input.current) input.current.value = "";
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha.");
    } finally {
      setOcupado(null);
    }
  }

  const imagem = previa ?? valorAtual ?? null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-3">
        {imagem && (
          // eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:) ou URL já enviada
          <img src={imagem} alt="Prévia" className="h-20 w-20 shrink-0 rounded-lg border border-border object-cover" />
        )}
        <div className="flex flex-col gap-2">
          <label className={`btn-secundario h-9 cursor-pointer px-3 text-xs ${ocupado ? "opacity-50" : ""}`}>
            {arquivo ? "Trocar arquivo" : rotulo}
            <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" className="hidden" disabled={Boolean(ocupado)} onChange={(e) => {
              setErro(null);
              const escolhido = e.target.files?.[0] ?? null;
              setPrevia((anterior) => { if (anterior?.startsWith("blob:")) URL.revokeObjectURL(anterior); return escolhido ? URL.createObjectURL(escolhido) : null; });
              setArquivo(escolhido);
              setDimensoes(null);
              if (escolhido && ["image/png", "image/jpeg", "image/webp"].includes(escolhido.type)) {
                const url = URL.createObjectURL(escolhido);
                const img = new Image();
                img.onload = () => { setDimensoes({ largura: img.naturalWidth, altura: img.naturalHeight }); URL.revokeObjectURL(url); };
                img.onerror = () => URL.revokeObjectURL(url);
                img.src = url;
              }
            }} />
          </label>
          {arquivo && (
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primario h-9 px-3 text-xs" disabled={Boolean(ocupado)} onClick={() => enviar(false)}>
                {ocupado === "simples" ? "Enviando…" : "Usar como está"}
              </button>
              {podeAmpliar && arquivo.size <= 2 * 1024 * 1024 && dimensoes && dimensoes.largura <= 512 && dimensoes.altura <= 512 && dimensoes.largura * dimensoes.altura <= 262144 && ["image/png", "image/jpeg", "image/webp"].includes(arquivo.type) && (
                <button type="button" className="btn-secundario h-9 px-3 text-xs" disabled={Boolean(ocupado)} onClick={() => void ampliar()} title="Amplia a imagem em 4× com IA, mantendo a original disponível até salvar o produto">
                  {ocupado === "ampliada" ? "Ampliando…" : "Melhorar resolução 4×"}
                </button>
              )}
              {podeTratar && (
                <button type="button" className="btn-secundario h-9 px-3 text-xs" disabled={Boolean(ocupado)} onClick={() => enviar(true)} title="Recorta o produto, deixa o fundo branco e padroniza o enquadramento">
                  {ocupado === "tratada" ? "Tratando…" : "Tratar com IA"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {arquivo && podeAmpliar && <span className="text-xs text-muted-foreground">Ampliação por IA: PNG, JPG ou WebP, até 2 MB e 512 × 512 pixels. A imagem ampliada é salva separadamente; revise antes de associar ao produto.</span>}
      {arquivo && podeTratar && <span className="text-xs text-muted-foreground">“Tratar com IA” recorta o produto, aplica fundo branco e deixa todas as fotos no mesmo enquadramento. Leva alguns segundos.</span>}
      {erro && <span className="text-xs text-red-700">{erro}</span>}
    </div>
  );
}
