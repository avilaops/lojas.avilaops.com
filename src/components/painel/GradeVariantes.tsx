"use client";

import { useEffect, useMemo, useState } from "react";
import { Campo, inputClasse } from "./campos";

interface Linha { id?: string; valores: Record<string, string>; sku: string; preco: string; estoque: string; pesoKg: string; imagem: string }

/**
 * Grade de variações de um produto: até 3 opções (Tamanho, Cor…), valores
 * separados por vírgula; a grade é gerada por combinação e cada linha tem
 * SKU, preço (vazio = preço do produto), estoque (vazio = não controla).
 */
export default function GradeVariantes({ produtoId, produtoNome, aoFechar, aoSalvar }: { produtoId: string; produtoNome: string; aoFechar: () => void; aoSalvar: (msg: string) => void }) {
  const [opcoes, setOpcoes] = useState<Array<{ nome: string; valores: string }>>([{ nome: "Tamanho", valores: "" }]);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    fetch(`/api/painel/variantes?produtoId=${produtoId}`).then((r) => r.json()).then((d) => {
      if (d?.opcoes?.length) {
        const vals: Record<string, Set<string>> = {};
        for (const o of d.opcoes) vals[o] = new Set();
        for (const v of d.variantes) for (const o of d.opcoes) if (v.valores?.[o]) vals[o].add(v.valores[o]);
        setOpcoes(d.opcoes.map((o: string) => ({ nome: o, valores: Array.from(vals[o]).join(", ") })));
        setLinhas(d.variantes.map((v: { id: string; valores: Record<string, string>; sku: string | null; precoCentavos: number | null; estoque: number | null; pesoKg: number | null; imagem: string | null }) => ({
          id: v.id, valores: v.valores, sku: v.sku ?? "", preco: v.precoCentavos != null ? (v.precoCentavos / 100).toFixed(2).replace(".", ",") : "", estoque: v.estoque != null ? String(v.estoque) : "", pesoKg: v.pesoKg != null ? String(v.pesoKg) : "", imagem: v.imagem ?? "",
        })));
      }
      setCarregado(true);
    });
  }, [produtoId]);

  const opcoesValidas = useMemo(() => opcoes.map((o) => ({ nome: o.nome.trim(), valores: o.valores.split(",").map((v) => v.trim()).filter(Boolean) })).filter((o) => o.nome && o.valores.length), [opcoes]);

  function gerar() {
    if (!opcoesValidas.length) return setErro("Defina ao menos uma opção com valores.");
    const combos: Record<string, string>[] = opcoesValidas.reduce<Record<string, string>[]>((acc, o) => acc.flatMap((c) => o.valores.map((v) => ({ ...c, [o.nome]: v }))), [{}]);
    const chave = (v: Record<string, string>) => opcoesValidas.map((o) => v[o.nome]).join("|");
    const existentes = new Map(linhas.map((l) => [chave(l.valores), l]));
    setLinhas(combos.map((c) => existentes.get(chave(c)) ?? { valores: c, sku: "", preco: "", estoque: "", pesoKg: "", imagem: "" }));
    setErro(null);
  }

  async function salvar() {
    setErro(null); setOcupado(true);
    try {
      const centavos = (v: string) => (v.trim() ? Math.round(Number.parseFloat(v.replace(/[^\d,.-]/g, "").replace(",", ".")) * 100) : null);
      const corpo = {
        produtoId,
        opcoes: opcoesValidas.map((o) => o.nome),
        variantes: linhas.map((l) => ({ id: l.id, valores: l.valores, sku: l.sku || null, precoCentavos: centavos(l.preco), estoque: l.estoque.trim() ? Number(l.estoque) : null, pesoKg: l.pesoKg.trim() ? Number.parseFloat(l.pesoKg.replace(",", ".")) : null, imagem: l.imagem || null })),
      };
      const r = await fetch("/api/painel/variantes", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.erro ?? "Falha ao salvar.");
      aoSalvar(`Grade salva: ${d.variantes.length} variação(ões).`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha.");
    } finally {
      setOcupado(false);
    }
  }

  const atualizar = (i: number, campo: keyof Linha, valor: string) => setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, [campo]: valor } : l)));

  return (
    <div className="rounded-2xl border border-primary/40 bg-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">Variações — {produtoNome}</h3>
          <p className="text-sm text-muted-foreground">Ex.: Tamanho: P, M, G · Cor: Preto, Branco. Depois clique em “Gerar grade”, preencha estoque e salve.</p>
        </div>
        <button className="btn-secundario h-9 px-3 text-xs" onClick={aoFechar}>Fechar</button>
      </div>

      {!carregado ? <p className="mt-4 text-sm text-muted-foreground">Carregando…</p> : (
        <>
          <div className="mt-4 grid gap-3">
            {opcoes.map((o, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
                <input className={inputClasse} placeholder="Opção (Tamanho)" value={o.nome} onChange={(e) => setOpcoes((os) => os.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))} />
                <input className={inputClasse} placeholder="Valores separados por vírgula (P, M, G)" value={o.valores} onChange={(e) => setOpcoes((os) => os.map((x, j) => (j === i ? { ...x, valores: e.target.value } : x)))} />
                <button className="btn-secundario" onClick={() => setOpcoes((os) => os.filter((_, j) => j !== i))} disabled={opcoes.length === 1}>×</button>
              </div>
            ))}
            <div className="flex gap-2">
              {opcoes.length < 3 && <button className="btn-secundario" onClick={() => setOpcoes((os) => [...os, { nome: "", valores: "" }])}>+ opção</button>}
              <button className="btn-secundario" onClick={gerar}>Gerar grade</button>
            </div>
          </div>

          {linhas.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="py-2">Variação</th><th>SKU</th><th>Preço (R$)</th><th>Estoque</th><th>Peso (kg)</th><th>Foto (URL)</th></tr></thead>
                <tbody>
                  {linhas.map((l, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="py-1 pr-2 font-medium">{opcoesValidas.map((o) => l.valores[o.nome]).join(" / ")}</td>
                      <td><input className={`${inputClasse} h-9`} value={l.sku} onChange={(e) => atualizar(i, "sku", e.target.value)} /></td>
                      <td><input className={`${inputClasse} h-9`} placeholder="= produto" value={l.preco} onChange={(e) => atualizar(i, "preco", e.target.value)} /></td>
                      <td><input className={`${inputClasse} h-9`} placeholder="∞" value={l.estoque} onChange={(e) => atualizar(i, "estoque", e.target.value)} inputMode="numeric" /></td>
                      <td><input className={`${inputClasse} h-9`} value={l.pesoKg} onChange={(e) => atualizar(i, "pesoKg", e.target.value)} /></td>
                      <td><input className={`${inputClasse} h-9`} value={l.imagem} onChange={(e) => atualizar(i, "imagem", e.target.value)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {erro && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
          <div className="mt-4 flex gap-2">
            <button className="btn-primario" disabled={ocupado} onClick={salvar}>Salvar grade</button>
            {linhas.length > 0 && <button className="btn-secundario" disabled={ocupado} onClick={() => { setLinhas([]); }}>Limpar (produto simples)</button>}
          </div>
          <Campo label="" ajuda="Salvar com a grade vazia volta o produto para “simples” (estoque no próprio produto)."><span /></Campo>
        </>
      )}
    </div>
  );
}
