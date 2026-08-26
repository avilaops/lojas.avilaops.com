"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const campo = "h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-foreground";

/** Entrar ou criar conta na loja — mesmo formulário, duas abas. */
export default function ContaForm({ aoEntrar }: { aoEntrar?: () => void }) {
  const router = useRouter();
  const [modo, setModo] = useState<"entrar" | "cadastrar">("entrar");
  const [f, setF] = useState({ nome: "", email: "", senha: "", telefone: "" });
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setOcupado(true);
    try {
      const corpo = modo === "entrar" ? { acao: "entrar", email: f.email, senha: f.senha } : { acao: "cadastrar", ...f };
      const r = await fetch("/api/conta", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.erro ?? "Não foi possível continuar.");
      if (aoEntrar) aoEntrar();
      else router.refresh();
    } catch (x) {
      setErro(x instanceof Error ? x.message : "Falha.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex gap-1 rounded-lg bg-muted p-1 text-sm">
        {(["entrar", "cadastrar"] as const).map((m) => (
          <button key={m} type="button" onClick={() => { setModo(m); setErro(null); }} className={`flex-1 rounded-md py-2 font-semibold ${modo === m ? "bg-background shadow-sm" : "text-muted-foreground"}`}>
            {m === "entrar" ? "Já tenho conta" : "Criar conta"}
          </button>
        ))}
      </div>

      <form onSubmit={enviar} className="grid gap-3">
        {modo === "cadastrar" && (
          <>
            <input className={campo} placeholder="Seu nome" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} required minLength={2} autoComplete="name" />
            <input className={campo} placeholder="Celular (opcional)" value={f.telefone} onChange={(e) => setF({ ...f, telefone: e.target.value })} inputMode="tel" autoComplete="tel" />
          </>
        )}
        <input className={campo} type="email" placeholder="E-mail" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required autoComplete="email" />
        <input className={campo} type="password" placeholder={modo === "cadastrar" ? "Crie uma senha (8+ caracteres)" : "Senha"} value={f.senha} onChange={(e) => setF({ ...f, senha: e.target.value })} required minLength={modo === "cadastrar" ? 8 : 1} autoComplete={modo === "cadastrar" ? "new-password" : "current-password"} />
        {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
        <button className="btn-primario" disabled={ocupado}>{ocupado ? "Aguarde…" : modo === "entrar" ? "Entrar" : "Criar minha conta"}</button>
      </form>

      <p className="mt-3 text-xs text-muted-foreground">
        {modo === "cadastrar"
          ? "Ao criar a conta, seus pedidos anteriores feitos com este e-mail aparecem no histórico."
          : "Comprar não exige conta — ela serve para acompanhar pedidos e salvar endereço."}
      </p>
    </div>
  );
}
