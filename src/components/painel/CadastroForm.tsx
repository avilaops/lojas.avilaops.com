"use client";

import { useState } from "react";
import { Campo, inputClasse } from "./campos";
import BotaoGoogle from "./BotaoGoogle";

/** Primeiro passo do cadastro: só o e-mail. O resto acontece depois que ele é confirmado. */
export default function CadastroForm({ google, plano }: { google: boolean; plano?: string }) {
  const [email, setEmail] = useState("");
  const [enviadoPara, setEnviadoPara] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setOcupado(true);
    try {
      const r = await fetch("/api/painel/cadastro", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, plano }) });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.erro ?? "Não foi possível enviar o link agora.");
      setEnviadoPara(email.trim());
    } catch (x) {
      setErro(x instanceof Error ? x.message : "Falha.");
    } finally {
      setOcupado(false);
    }
  }

  if (enviadoPara) {
    return (
      <div className="pl-cadastro-enviado" role="status">
        <strong>Confira o seu e-mail.</strong>
        <p>Enviamos um link para <b>{enviadoPara}</b>. Abra-o para confirmar o endereço e criar a sua senha. O link vale por 24 horas.</p>
        <p>Não chegou em alguns minutos? Olhe o spam ou <button type="button" onClick={() => setEnviadoPara(null)}>tente outro e-mail</button>.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {google && (
        <>
          <BotaoGoogle rotulo="Continuar com Google" />
          <p className="pl-divisor"><span>ou com o seu e-mail</span></p>
        </>
      )}
      <form onSubmit={enviar} className="grid gap-4">
        <Campo label="E-mail">
          <input className={inputClasse} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="voce@seunegocio.com.br" required />
        </Campo>
        {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
        <button className="btn-primario" disabled={ocupado}>{ocupado ? "Enviando…" : "Criar minha conta"}</button>
      </form>
    </div>
  );
}
