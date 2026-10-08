"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Campo, inputClasse } from "./campos";

export default function RecuperarForm({ modo, token = "" }: { modo: "pedir" | "trocar"; token?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null); setMsg(null); setOcupado(true);
    try {
      const r = await fetch("/api/painel/recuperar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(modo === "pedir" ? { email } : { token, senha }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.erro ?? "Falha.");
      if (modo === "pedir") setMsg(d.mensagem ?? "Enviado.");
      else { setMsg("Senha alterada. Entrando…"); setTimeout(() => router.push("/entrar?senha=1"), 1200); }
    } catch (x) {
      setErro(x instanceof Error ? x.message : "Falha.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form onSubmit={enviar} className="grid gap-4">
      {modo === "pedir"
        ? <Campo label="E-mail"><input className={inputClasse} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Campo>
        : <Campo label="Nova senha" ajuda="Mínimo 8 caracteres"><input className={inputClasse} type="password" value={senha} onChange={(e) => setSenha(e.target.value)} minLength={8} required /></Campo>}
      {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
      {msg && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{msg}</p>}
      <button className="btn-primario" disabled={ocupado}>{ocupado ? "Aguarde…" : modo === "pedir" ? "Enviar link" : "Salvar senha"}</button>
    </form>
  );
}
