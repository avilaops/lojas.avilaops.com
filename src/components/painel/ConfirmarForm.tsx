"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Campo, inputClasse } from "./campos";

/** Segundo passo: o e-mail já foi confirmado pelo link; falta a senha. Depois disso a pessoa está dentro. */
export default function ConfirmarForm({ token }: { token: string }) {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senha !== senha2) return setErro("As duas senhas não são iguais.");
    setOcupado(true);
    try {
      const r = await fetch("/api/painel/cadastro/confirmar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, senha }) });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.erro ?? "Não foi possível criar a conta agora.");
      router.push("/painel");
      router.refresh();
    } catch (x) {
      setErro(x instanceof Error ? x.message : "Falha.");
      setOcupado(false);
    }
  }

  return (
    <form onSubmit={enviar} className="grid gap-4">
      <Campo label="Senha" ajuda="Mínimo 8 caracteres">
        <input className={inputClasse} type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" minLength={8} required />
      </Campo>
      <Campo label="Repita a senha">
        <input className={inputClasse} type="password" value={senha2} onChange={(e) => setSenha2(e.target.value)} autoComplete="new-password" minLength={8} required />
      </Campo>
      {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
      <button className="btn-primario" disabled={ocupado}>{ocupado ? "Criando a conta…" : "Criar senha e entrar"}</button>
    </form>
  );
}
