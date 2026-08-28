"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ANO_MAX, ANO_MIN, nomeDaMoto, queryDaMoto, type Moto } from "@/lib/motos";

/**
 * "Qual é a sua moto?" — marca, modelo e ano. Formulário GET de verdade
 * (funciona sem JavaScript e cada moto tem URL própria); com JavaScript,
 * guarda a escolha num cookie para a loja inteira lembrar.
 */
export default function SeletorMoto({ opcoes, moto, compacto = false, destino = "/produtos" }: { opcoes: Record<string, string[]>; moto: Moto | null; compacto?: boolean; destino?: string }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [marca, setMarca] = useState(moto?.marca ?? "");
  const [modelo, setModelo] = useState(moto?.modelo ?? "");
  const [ano, setAno] = useState(moto?.ano ? String(moto.ano) : "");
  const [editando, setEditando] = useState(!moto);

  const marcas = Object.keys(opcoes);
  const modelos = opcoes[marca] ?? [];
  const anos: number[] = [];
  for (let a = ANO_MAX; a >= ANO_MIN; a--) anos.push(a);

  async function escolher(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!marca || !modelo) return;
    const nova: Moto = { marca, modelo, ...(ano ? { ano: Number(ano) } : {}) };
    await fetch("/api/minha-moto", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(nova) }).catch(() => null);
    iniciar(() => {
      setEditando(false);
      router.push(`${destino}?${queryDaMoto(nova)}`);
      router.refresh();
    });
  }

  async function esquecer() {
    await fetch("/api/minha-moto", { method: "DELETE" }).catch(() => null);
    setMarca(""); setModelo(""); setAno("");
    iniciar(() => {
      setEditando(true);
      router.push(`${destino}?moto=todas`);
      router.refresh();
    });
  }

  if (moto && !editando) {
    return (
      <div className={`garagem-atual ${compacto ? "garagem-compacta" : ""}`}>
        <span className="garagem-icone" aria-hidden="true">🏍</span>
        <p>
          <small>Sua moto</small>
          <strong>{nomeDaMoto(moto)}</strong>
        </p>
        <div className="garagem-acoes">
          <button type="button" onClick={() => setEditando(true)}>Trocar</button>
          <button type="button" onClick={esquecer} disabled={pendente}>Ver tudo</button>
        </div>
      </div>
    );
  }

  const campo = "h-11 min-w-0 rounded-lg border border-border bg-background px-3 text-sm";
  return (
    <form action={destino} method="get" onSubmit={escolher} className={`garagem-form ${compacto ? "garagem-compacta" : ""}`}>
      {!compacto && <p className="garagem-titulo"><span aria-hidden="true">🏍</span> Encontre peças para a sua moto</p>}
      <div className="garagem-campos">
        <select name="marca" aria-label="Marca" className={campo} value={marca} onChange={(e) => { setMarca(e.target.value); setModelo(""); }} required>
          <option value="">Marca</option>
          {marcas.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select name="modelo" aria-label="Modelo" className={campo} value={modelo} onChange={(e) => setModelo(e.target.value)} required disabled={!marca}>
          <option value="">{marca ? "Modelo" : "Escolha a marca"}</option>
          {modelos.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select name="ano" aria-label="Ano" className={campo} value={ano} onChange={(e) => setAno(e.target.value)} disabled={!modelo}>
          <option value="">Ano (opcional)</option>
          {anos.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <button className="btn-primario h-11 px-5 text-sm" disabled={!marca || !modelo || pendente}>{pendente ? "Buscando…" : "Ver peças"}</button>
        {moto && <button type="button" className="btn-secundario h-11 px-4 text-sm" onClick={() => setEditando(false)}>Cancelar</button>}
      </div>
    </form>
  );
}
