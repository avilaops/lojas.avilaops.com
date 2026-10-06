"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Campo, inputClasse } from "./campos";
import { DIAS_DE_TESTE, PLANOS, mensalidade, type IdPlano } from "@/lib/planos";

/**
 * A conta existe; a loja ainda não tem nome. Três perguntas e ela vai ao ar.
 * Identidade visual, catálogo, entrega e recebimento ficam para as seções do
 * painel, no ritmo do lojista.
 */
export default function PrimeirosPassos({ planoInicial, testeAte }: { planoInicial: IdPlano; testeAte: string }) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [plano, setPlano] = useState<IdPlano>(planoInicial);
  const [erro, setErro] = useState<{ campo?: string; mensagem: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setOcupado(true);
    try {
      const r = await fetch("/api/painel/primeiros-passos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ nome, whatsapp, plano }) });
      const d = await r.json().catch(() => null);
      if (!r.ok) {
        setErro({ campo: d?.campo, mensagem: d?.erro ?? "Não foi possível criar a loja agora." });
        setOcupado(false);
        return;
      }
      router.push("/painel?nova=1");
      router.refresh();
    } catch {
      setErro({ mensagem: "Sem conexão. Tente de novo." });
      setOcupado(false);
    }
  }

  return (
    <form onSubmit={enviar} className="mx-auto grid max-w-3xl gap-6">
      <div className="rounded-2xl border border-border bg-card p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Conta criada</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">Agora, a sua loja.</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Três respostas e ela vai ao ar. O teste grátis vai até {new Date(testeAte).toLocaleDateString("pt-BR")} ({DIAS_DE_TESTE} dias), sem cartão; a cobrança só começa quando você ativar.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Campo label="Nome da loja" erro={erro?.campo === "nome" ? erro.mensagem : undefined} obrigatorio>
            <input className={inputClasse} value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} placeholder="Ex.: Padaria Aurora" required />
          </Campo>
          <Campo label="WhatsApp da loja" ajuda="É por onde chegam pedidos e avisos." erro={erro?.campo === "whatsapp" ? erro.mensagem : undefined} obrigatorio>
            <input className={inputClasse} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="(16) 99999-0000" required />
          </Campo>
        </div>
      </div>

      <fieldset className="grid gap-3">
        <legend className="mb-3 text-sm font-semibold">Escolha o plano</legend>
        <div className="grid gap-3 md:grid-cols-3">
          {PLANOS.map((p) => (
            <label key={p.id} className={`cursor-pointer rounded-2xl border p-5 transition ${plano === p.id ? "border-foreground bg-card shadow-sm" : "border-border bg-card/60 hover:border-foreground/40"}`}>
              <input type="radio" name="plano" value={p.id} checked={plano === p.id} onChange={() => setPlano(p.id)} className="sr-only" />
              <span className="flex items-center justify-between gap-2">
                <b className="text-base">{p.nome}</b>
                {p.destaque && <i className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold not-italic text-background">Recomendado</i>}
              </span>
              <span className="mt-1 block text-sm font-semibold tabular-nums">{mensalidade(p.preco)}</span>
              <span className="mt-2 block text-xs text-muted-foreground">{p.descricao}</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Até ativar a cobrança, dá para trocar de plano em Configurações → Assinatura.</p>
      </fieldset>

      {erro && !erro.campo && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro.mensagem}</p>}
      {erro?.campo === "plano" && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro.mensagem}</p>}
      <button className="btn-primario justify-self-start" disabled={ocupado}>{ocupado ? "Criando a loja…" : "Criar minha loja"}</button>
    </form>
  );
}
