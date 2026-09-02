"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Plus, Power, Trash2, UserPlus } from "lucide-react";
import { Secao } from "./campos";

/**
 * Quem entra no painel da loja, cadastrado pelo próprio lojista.
 *
 * Antes existia uma senha só, dividida entre o dono, o balcão e quem cadastra
 * produto. Aqui cada pessoa tem a sua, e desligar alguém não obriga a trocar a
 * senha de todo mundo.
 */
export type OperadorNaTela = {
  id: string;
  nome: string;
  email: string;
  papel: string;
  ativo: boolean;
  ultimoAcessoEm: string | null;
};

const PAPEL: Record<string, { rotulo: string; explica: string }> = {
  GERENTE: { rotulo: "Gerente", explica: "Produtos, preços, pedidos e configurações" },
  OPERADOR: { rotulo: "Balcão", explica: "Vê e despacha pedidos" },
};

const quando = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "nunca entrou";

export default function Equipe({ dono, operadores }: { dono: string | null; operadores: OperadorNaTela[] }) {
  const router = useRouter();
  const [abrindo, setAbrindo] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", email: "", senha: "", papel: "OPERADOR" });

  async function chamar(url: string, init: RequestInit) {
    setErro(null);
    setOcupado(true);
    try {
      const r = await fetch(url, { headers: { "content-type": "application/json" }, ...init });
      const corpo = (await r.json().catch(() => ({}))) as { erro?: string };
      if (!r.ok) throw new Error(corpo.erro ?? "Não consegui salvar.");
      router.refresh();
      return true;
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha inesperada.");
      return false;
    } finally {
      setOcupado(false);
    }
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (await chamar("/api/painel/equipe", { method: "POST", body: JSON.stringify(form) })) {
      setForm({ nome: "", email: "", senha: "", papel: "OPERADOR" });
      setAbrindo(false);
    }
  }

  async function trocarSenha(o: OperadorNaTela) {
    const senha = prompt(`Nova senha para ${o.nome} (mínimo 8 caracteres):`);
    if (!senha) return;
    await chamar(`/api/painel/equipe/${o.id}`, { method: "PATCH", body: JSON.stringify({ senha }) });
  }

  return (
    <>
      {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}

      <Secao
        titulo="Quem entra no painel"
        descricao="Cada pessoa da sua equipe usa o próprio e-mail e a própria senha. Assim você sabe quem despachou cada pedido, e desligar alguém não obriga a trocar a senha dos outros."
      >
        <ul className="grid gap-2">
          {/* O dono não é um operador: ele é a conta da loja, e por isso não
              aparece com botão de desligar. Some da tela seria pior, porque o
              lojista precisa ver que aquele e-mail também entra. */}
          {dono && (
            <li className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
              <span className="flex-1 text-sm">
                <b className="block">{dono}</b>
                <span className="text-xs text-muted-foreground">Dono da loja · acesso total, inclusive assinatura</span>
              </span>
            </li>
          )}

          {operadores.map((o) => (
            <li key={o.id} className={`flex flex-wrap items-center gap-3 rounded-lg border border-border p-3 ${o.ativo ? "" : "opacity-60"}`}>
              <span className="flex-1 text-sm">
                <b className="block">
                  {o.nome}
                  {!o.ativo && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium">desligado</span>}
                </b>
                <span className="text-xs text-muted-foreground">
                  {o.email} · {PAPEL[o.papel]?.rotulo ?? o.papel} · {quando(o.ultimoAcessoEm)}
                </span>
              </span>

              <button
                className="btn-secundario inline-flex h-9 items-center gap-1.5 px-3 text-xs"
                disabled={ocupado}
                onClick={() => trocarSenha(o)}
                title="Definir uma nova senha"
              >
                <KeyRound size={13} /> Senha
              </button>

              <button
                className="btn-secundario inline-flex h-9 items-center gap-1.5 px-3 text-xs"
                disabled={ocupado}
                onClick={() => chamar(`/api/painel/equipe/${o.id}`, { method: "PATCH", body: JSON.stringify({ ativo: !o.ativo }) })}
                title={o.ativo ? "Tirar o acesso, sem apagar o histórico" : "Devolver o acesso"}
              >
                <Power size={13} /> {o.ativo ? "Desligar" : "Reativar"}
              </button>

              {/* Remover de vez só faz sentido para erro de digitação: quem
                  saiu da empresa deve ser desligado, que preserva o histórico. */}
              {!o.ativo && (
                <button
                  className="btn-secundario inline-flex h-9 items-center gap-1.5 px-3 text-xs text-red-700"
                  disabled={ocupado}
                  onClick={() => {
                    if (confirm(`Remover ${o.nome} de vez? Para quem saiu da empresa, deixar desligado é melhor: preserva o histórico.`)) {
                      chamar(`/api/painel/equipe/${o.id}`, { method: "DELETE" });
                    }
                  }}
                >
                  <Trash2 size={13} /> Remover
                </button>
              )}
            </li>
          ))}
        </ul>

        {!abrindo ? (
          <div>
            <button className="btn-primario inline-flex items-center gap-2" onClick={() => setAbrindo(true)}>
              <UserPlus size={15} /> Dar acesso a alguém
            </button>
          </div>
        ) : (
          <form onSubmit={criar} className="grid gap-3 rounded-lg border border-border p-4">
            <label className="grid gap-1 text-sm">
              Nome
              <input
                className="h-11 rounded-lg border border-border bg-background px-3"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Quem vai usar este acesso"
                required
              />
            </label>

            <label className="grid gap-1 text-sm">
              E-mail
              <input
                type="email"
                className="h-11 rounded-lg border border-border bg-background px-3"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </label>

            <label className="grid gap-1 text-sm">
              Senha
              <input
                type="text"
                className="h-11 rounded-lg border border-border bg-background px-3"
                value={form.senha}
                onChange={(e) => setForm({ ...form, senha: e.target.value })}
                minLength={8}
                placeholder="Pelo menos 8 caracteres"
                required
              />
              <small className="text-xs text-muted-foreground">
                Combine com a pessoa e peça para ela trocar depois do primeiro acesso.
              </small>
            </label>

            <fieldset className="grid gap-2">
              <legend className="text-sm">O que ela pode fazer</legend>
              {Object.entries(PAPEL).map(([valor, p]) => (
                <label key={valor} className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm">
                  <input
                    type="radio"
                    name="papel"
                    className="mt-1"
                    checked={form.papel === valor}
                    onChange={() => setForm({ ...form, papel: valor })}
                  />
                  <span>
                    <b className="block">{p.rotulo}</b>
                    <span className="text-xs text-muted-foreground">{p.explica}</span>
                  </span>
                </label>
              ))}
              <small className="text-xs text-muted-foreground">
                Assinatura e acessos ficam só com você.
              </small>
            </fieldset>

            <div className="flex flex-wrap gap-2">
              <button className="btn-primario inline-flex items-center gap-2" disabled={ocupado}>
                <Plus size={15} /> {ocupado ? "Criando…" : "Criar acesso"}
              </button>
              <button type="button" className="btn-secundario px-4" onClick={() => setAbrindo(false)} disabled={ocupado}>
                Cancelar
              </button>
            </div>
          </form>
        )}
      </Secao>
    </>
  );
}
