"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Campo, inputClasse } from "./campos";

export default function EntrarForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setOcupado(true);
    try {
      const r = await fetch("/api/painel/entrar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, senha }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.erro ?? "Não foi possível entrar.");
      router.push("/painel");
      router.refresh();
    } catch (x) {
      setErro(x instanceof Error ? x.message : "Falha.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form onSubmit={entrar} className="grid gap-4">
      <Campo label="E-mail"><input className={inputClasse} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></Campo>
      <Campo label="Senha"><input className={inputClasse} type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" required /></Campo>
      {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
      <button className="btn-primario" disabled={ocupado}>{ocupado ? "Entrando…" : "Entrar"}</button>
    </form>
  );
}
