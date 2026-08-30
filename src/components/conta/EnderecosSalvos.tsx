"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface EnderecoView { id: string; apelido: string | null; cep: string; logradouro: string; numero: string; complemento: string | null; bairro: string; cidade: string; uf: string; principal: boolean }

const campo = "h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-foreground";
const vazio = { id: "", apelido: "", cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "", principal: false };

export default function EnderecosSalvos({ enderecos }: { enderecos: EnderecoView[] }) {
  const router = useRouter();
  const [f, setF] = useState(vazio);
  const [aberto, setAberto] = useState(enderecos.length === 0);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function buscarCep(cep: string) {
    const limpo = cep.replace(/\D/g, "");
    if (limpo.length !== 8) return;
    const r = await fetch(`/api/cep?cep=${limpo}`).then((x) => (x.ok ? x.json() : null)).catch(() => null);
    if (r) setF((a) => ({ ...a, logradouro: r.logradouro || a.logradouro, bairro: r.bairro || a.bairro, cidade: r.cidade || a.cidade, uf: r.uf || a.uf }));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setOcupado(true);
    try {
      const r = await fetch("/api/conta/enderecos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...f, id: f.id || undefined, apelido: f.apelido || undefined, complemento: f.complemento || undefined }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.erro ?? "Não foi possível salvar.");
      setF(vazio);
      setAberto(false);
      router.refresh();
    } catch (x) {
      setErro(x instanceof Error ? x.message : "Falha.");
    } finally {
      setOcupado(false);
    }
  }

  async function apagar(id: string) {
    if (!confirm("Apagar este endereço?")) return;
    await fetch(`/api/conta/enderecos?id=${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="grid gap-3">
      {enderecos.length > 0 && (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card text-sm">
          {enderecos.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{e.apelido || "Endereço"}{e.principal && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">principal</span>}</p>
                <p className="text-xs text-muted-foreground">{e.logradouro}, {e.numero}{e.complemento ? `, ${e.complemento}` : ""} · {e.bairro} · {e.cidade}/{e.uf} · {e.cep.replace(/(\d{5})(\d{3})/, "$1-$2")}</p>
              </div>
              <div className="flex gap-3 text-xs">
                <button className="underline" onClick={() => { setF({ ...e, apelido: e.apelido ?? "", complemento: e.complemento ?? "" }); setAberto(true); }}>editar</button>
                <button className="text-muted-foreground underline" onClick={() => apagar(e.id)}>apagar</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!aberto ? (
        <button className="btn-secundario w-fit" onClick={() => setAberto(true)}>+ Novo endereço</button>
      ) : (
        <form onSubmit={salvar} className="grid gap-3 rounded-xl border border-border bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
            <input className={campo} placeholder="Apelido (Casa, Trabalho)" value={f.apelido} onChange={(e) => setF({ ...f, apelido: e.target.value })} />
            <input className={campo} placeholder="CEP" value={f.cep} onChange={(e) => setF({ ...f, cep: e.target.value })} onBlur={(e) => buscarCep(e.target.value)} inputMode="numeric" required autoComplete="postal-code" />
          </div>
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
            <input className={campo} placeholder="Rua" value={f.logradouro} onChange={(e) => setF({ ...f, logradouro: e.target.value })} required autoComplete="address-line1" />
            <input className={campo} placeholder="Número" value={f.numero} onChange={(e) => setF({ ...f, numero: e.target.value })} required />
            <input className={campo} placeholder="Complemento" value={f.complemento} onChange={(e) => setF({ ...f, complemento: e.target.value })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-[2fr_2fr_1fr]">
            <input className={campo} placeholder="Bairro" value={f.bairro} onChange={(e) => setF({ ...f, bairro: e.target.value })} required />
            <input className={campo} placeholder="Cidade" value={f.cidade} onChange={(e) => setF({ ...f, cidade: e.target.value })} required autoComplete="address-level2" />
            <input className={campo} placeholder="UF" maxLength={2} value={f.uf} onChange={(e) => setF({ ...f, uf: e.target.value.toUpperCase() })} required autoComplete="address-level1" />
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.principal} onChange={(e) => setF({ ...f, principal: e.target.checked })} /> Usar como endereço principal</label>
          {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
          <div className="flex gap-2">
            <button className="btn-primario" disabled={ocupado}>{ocupado ? "Salvando…" : "Salvar endereço"}</button>
            <button type="button" className="btn-secundario" onClick={() => { setF(vazio); setAberto(false); }}>Cancelar</button>
          </div>
        </form>
      )}
    </div>
  );
}
