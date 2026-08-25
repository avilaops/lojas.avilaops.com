"use client";

import { useEffect, useState } from "react";
import { Campo, inputClasse } from "./campos";
import EnviarImagem from "./EnviarImagem";

interface Form { nome: string; categoria: string; marca: string; sku: string; preco: string; precoDe: string; descricaoCurta: string; descricao: string; imagens: string[]; destaque: boolean; ativo: boolean; disponibilidade: string; estoque: string; pesoKg: string }

/** Formulário completo de um produto existente: várias fotos, descrição longa, estoque, ativo/destaque. */
export default function EditarProduto({ produtoId, aoFechar, aoSalvar }: { produtoId: string; aoFechar: () => void; aoSalvar: (msg: string) => void }) {
  const [f, setF] = useState<Form | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    fetch(`/api/painel/produtos?id=${produtoId}`).then((r) => r.json()).then((p) => {
      if (p?.erro) return setErro(p.erro);
      setF({
        nome: p.nome, categoria: p.categoria ?? "", marca: p.marca ?? "", sku: p.sku ?? "",
        preco: (p.precoCentavos / 100).toFixed(2).replace(".", ","), precoDe: p.precoDeCentavos != null ? (p.precoDeCentavos / 100).toFixed(2).replace(".", ",") : "",
        descricaoCurta: p.descricaoCurta ?? "", descricao: p.descricao ?? "", imagens: p.imagens ?? [], destaque: p.destaque, ativo: p.ativo,
        disponibilidade: p.disponibilidade, estoque: p.estoque != null ? String(p.estoque) : "", pesoKg: p.pesoKg != null ? String(p.pesoKg) : "",
      });
    });
  }, [produtoId]);

  const centavos = (v: string) => Math.round(Number.parseFloat(v.replace(/[^\d,.-]/g, "").replace(",", ".")) * 100);

  async function salvar() {
    if (!f) return;
    const preco = centavos(f.preco);
    if (!f.nome.trim() || !Number.isFinite(preco)) return setErro("Nome e preço são obrigatórios.");
    setErro(null); setOcupado(true);
    try {
      const precoDe = f.precoDe.trim() ? centavos(f.precoDe) : undefined;
      const r = await fetch("/api/painel/produtos", {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: produtoId, nome: f.nome, categoria: f.categoria, marca: f.marca || undefined, sku: f.sku || undefined, precoCentavos: preco,
          ...(precoDe !== undefined && Number.isFinite(precoDe) ? { precoDeCentavos: precoDe } : {}),
          descricaoCurta: f.descricaoCurta || undefined, descricao: f.descricao || undefined, imagens: f.imagens, destaque: f.destaque, ativo: f.ativo,
          disponibilidade: f.disponibilidade, ...(f.estoque.trim() ? { estoque: Number(f.estoque) } : {}), ...(f.pesoKg.trim() ? { pesoKg: Number.parseFloat(f.pesoKg.replace(",", ".")) } : {}),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.erro ?? "Falha ao salvar.");
      aoSalvar("Produto atualizado.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha.");
    } finally {
      setOcupado(false);
    }
  }

  if (!f) return <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">{erro ?? "Carregando…"}</div>;
  const set = (k: keyof Form, v: unknown) => setF({ ...f, [k]: v });

  return (
    <div className="rounded-2xl border border-primary/40 bg-card p-6">
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-semibold">Editar — {f.nome}</h3>
        <button className="btn-secundario h-9 px-3 text-xs" onClick={aoFechar}>Fechar</button>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Campo label="Nome"><input className={inputClasse} value={f.nome} onChange={(e) => set("nome", e.target.value)} /></Campo>
        <Campo label="Categoria"><input className={inputClasse} value={f.categoria} onChange={(e) => set("categoria", e.target.value)} /></Campo>
        <Campo label="Marca"><input className={inputClasse} value={f.marca} onChange={(e) => set("marca", e.target.value)} /></Campo>
        <Campo label="SKU"><input className={inputClasse} value={f.sku} onChange={(e) => set("sku", e.target.value)} /></Campo>
        <Campo label="Preço (R$)"><input className={inputClasse} value={f.preco} onChange={(e) => set("preco", e.target.value)} inputMode="decimal" /></Campo>
        <Campo label="Preço “de” (R$)"><input className={inputClasse} value={f.precoDe} onChange={(e) => set("precoDe", e.target.value)} inputMode="decimal" /></Campo>
        <Campo label="Estoque" ajuda="Vazio = não controla"><input className={inputClasse} value={f.estoque} onChange={(e) => set("estoque", e.target.value)} inputMode="numeric" /></Campo>
        <Campo label="Peso (kg)"><input className={inputClasse} value={f.pesoKg} onChange={(e) => set("pesoKg", e.target.value)} /></Campo>
        <Campo label="Disponibilidade">
          <select className={inputClasse} value={f.disponibilidade} onChange={(e) => set("disponibilidade", e.target.value)}><option value="in_stock">Em estoque</option><option value="backorder">Sob encomenda</option><option value="out_of_stock">Esgotado</option></select>
        </Campo>
        <div className="flex items-end gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={f.destaque} onChange={(e) => set("destaque", e.target.checked)} /> Destaque</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={f.ativo} onChange={(e) => set("ativo", e.target.checked)} /> Ativo (visível)</label>
        </div>
      </div>
      <div className="mt-4 grid gap-4">
        <Campo label="Descrição curta" ajuda="Aparece no card e no Google"><input className={inputClasse} value={f.descricaoCurta} onChange={(e) => set("descricaoCurta", e.target.value)} maxLength={300} /></Campo>
        <Campo label="Descrição completa" ajuda="Parágrafos separados por linha em branco"><textarea className={`${inputClasse} h-32 py-2`} value={f.descricao} onChange={(e) => set("descricao", e.target.value)} /></Campo>
        <Campo label="Fotos" ajuda="A primeira é a principal. Arraste não; use os botões.">
          <div className="flex flex-wrap gap-2">
            {f.imagens.map((url, i) => (
              <div key={url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-20 w-20 rounded-lg border border-border object-cover" />
                <div className="mt-1 flex gap-1 text-[10px]">
                  {i > 0 && <button className="underline" onClick={() => { const a = [...f.imagens]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; set("imagens", a); }}>← principal</button>}
                  <button className="text-red-700 underline" onClick={() => set("imagens", f.imagens.filter((_, j) => j !== i))}>remover</button>
                </div>
              </div>
            ))}
            <EnviarImagem aoEnviar={(url) => set("imagens", [...f.imagens, url])} rotulo="+ foto" />
          </div>
        </Campo>
      </div>
      {erro && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
      <div className="mt-4"><button className="btn-primario" disabled={ocupado} onClick={salvar}>Salvar produto</button></div>
    </div>
  );
}
