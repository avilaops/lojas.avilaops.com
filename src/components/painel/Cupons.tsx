"use client";

import { useState } from "react";
import { Campo, Secao, brl, inputClasse } from "./campos";

export interface CupomView { id: string; codigo: string; tipo: string; valor: number; minimoCentavos: number; usosMax: number | null; usos: number; validoAte: string | null; ativo: boolean }

const TIPO: Record<string, string> = { PERCENTUAL: "% de desconto", FIXO: "Valor fixo", FRETE_GRATIS: "Frete grátis" };

export default function Cupons({ cupons, chamar, ocupado }: { cupons: CupomView[]; chamar: (c: string, m: string, b?: unknown, s?: string) => Promise<unknown>; ocupado: boolean }) {
  const [f, setF] = useState({ codigo: "", tipo: "PERCENTUAL", valor: "", minimo: "", usosMax: "", validoAte: "" });
  const centavos = (v: string) => Math.round(Number.parseFloat(v.replace(/[^\d,.-]/g, "").replace(",", ".")) * 100);

  function salvar() {
    const corpo = {
      codigo: f.codigo,
      tipo: f.tipo,
      valor: f.tipo === "PERCENTUAL" ? Number(f.valor) || 0 : f.tipo === "FIXO" ? centavos(f.valor || "0") : 0,
      minimoCentavos: f.minimo ? centavos(f.minimo) : 0,
      usosMax: f.usosMax ? Number(f.usosMax) : null,
      validoAte: f.validoAte ? new Date(`${f.validoAte}T23:59:59`).toISOString() : null,
    };
    chamar("/api/painel/cupons", "POST", corpo, "Cupom salvo.").then(() => setF({ codigo: "", tipo: "PERCENTUAL", valor: "", minimo: "", usosMax: "", validoAte: "" }));
  }

  return (
    <>
      <Secao titulo="Novo cupom" descricao="O cliente digita o código no carrinho. Desconto é calculado no servidor; ninguém consegue inventar valor.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo label="Código"><input className={`${inputClasse} uppercase`} value={f.codigo} onChange={(e) => setF({ ...f, codigo: e.target.value.toUpperCase() })} placeholder="BEMVINDO10" /></Campo>
          <Campo label="Tipo"><select className={inputClasse} value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>{Object.entries(TIPO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select></Campo>
          {f.tipo !== "FRETE_GRATIS" && <Campo label={f.tipo === "PERCENTUAL" ? "Percentual (%)" : "Valor (R$)"}><input className={inputClasse} value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} inputMode="decimal" /></Campo>}
          <Campo label="Compra mínima (R$)" ajuda="Opcional"><input className={inputClasse} value={f.minimo} onChange={(e) => setF({ ...f, minimo: e.target.value })} inputMode="decimal" /></Campo>
          <Campo label="Limite de usos" ajuda="Vazio = ilimitado"><input className={inputClasse} value={f.usosMax} onChange={(e) => setF({ ...f, usosMax: e.target.value })} inputMode="numeric" /></Campo>
          <Campo label="Válido até" ajuda="Vazio = sem prazo"><input className={inputClasse} type="date" value={f.validoAte} onChange={(e) => setF({ ...f, validoAte: e.target.value })} /></Campo>
        </div>
        <div><button className="btn-primario" disabled={ocupado || f.codigo.trim().length < 2} onClick={salvar}>Salvar cupom</button></div>
      </Secao>

      <Secao titulo={`Cupons (${cupons.filter((c) => c.ativo).length} ativos)`}>
        {cupons.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum cupom ainda.</p> : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="py-2">Código</th><th>Desconto</th><th>Mínimo</th><th>Usos</th><th>Validade</th><th></th></tr></thead>
            <tbody>
              {cupons.map((c) => (
                <tr key={c.id} className={`border-t border-border ${c.ativo ? "" : "opacity-50"}`}>
                  <td className="py-2 font-mono font-semibold">{c.codigo}{!c.ativo && " (inativo)"}</td>
                  <td>{c.tipo === "PERCENTUAL" ? `${c.valor}%` : c.tipo === "FIXO" ? brl(c.valor) : "Frete grátis"}</td>
                  <td>{c.minimoCentavos ? brl(c.minimoCentavos) : "—"}</td>
                  <td>{c.usos}{c.usosMax ? ` / ${c.usosMax}` : ""}</td>
                  <td>{c.validoAte ? new Date(c.validoAte).toLocaleDateString("pt-BR") : "—"}</td>
                  <td className="text-right">{c.ativo && <button className="text-xs text-muted-foreground underline" disabled={ocupado} onClick={() => chamar(`/api/painel/cupons?codigo=${c.codigo}`, "DELETE", undefined, "Cupom desativado.")}>desativar</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Secao>
    </>
  );
}
