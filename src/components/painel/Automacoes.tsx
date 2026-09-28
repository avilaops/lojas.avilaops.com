"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Secao } from "./campos";
import Paginacao from "@/components/aplicacao/Paginacao";
import Vazio from "@/components/aplicacao/Vazio";

/**
 * Configurações → Automações: o que a loja disparou e o que aconteceu com
 * cada aviso, na língua de quem vende.
 *
 * Toda automação (WhatsApp de pedido pago, e-mail de carrinho abandonado,
 * relatório semanal) sai da plataforma como evento e é executada no n8n. Até
 * aqui o lojista não tinha como saber se o aviso saiu: quando o comprador
 * dizia "não recebi nada", a resposta dependia de alguém da Avila Ops abrir o
 * n8n. Esta tela lê o registro que a plataforma já guardava e mostra:
 * quando saiu, o que era, se foi feito, e um botão de reenviar quando falhou.
 *
 * O que ela NÃO mostra é o conteúdo do aviso: tem e-mail e telefone de
 * comprador, e a pergunta aqui é "saiu ou não saiu".
 */
type Item = {
  eventId: string;
  tipo: string;
  status: "EMITIDO" | "PROCESSANDO" | "PROCESSADO" | "FALHOU" | "IGNORADO" | "REENVIADO";
  detalhe: string | null;
  emitidoEm: string;
  concluidoEm: string | null;
  correlationId: string | null;
  tentativas: number;
};

type Resposta = { total: number; pagina: number; porPagina: number; paginas: number; resumo: Record<string, number>; itens: Item[] };

/** O nome do evento como o lojista o entende. Tipo desconhecido mostra o código. */
const NOME: Record<string, string> = {
  "loja.criada": "Loja criada",
  "loja.provisionada": "Domínio e e-mail configurados",
  "loja.provisionamento-falhou": "Falha ao configurar domínio ou e-mail",
  "loja.ativada": "Loja no ar",
  "loja.identidade-atualizada": "Marca atualizada",
  "loja.suspensa": "Loja suspensa",
  "loja.reativada": "Loja reativada",
  "loja.mensalidade-paga": "Mensalidade paga",
  "loja.mensalidade-recusada": "Mensalidade recusada",
  "loja.relatorio-semanal": "Relatório semanal",
  "loja.voltou-ao-estoque": "Aviso de produto de volta ao estoque",
  "lojista.recuperar-senha": "Recuperação de senha",
  "pedido.criado": "Pedido recebido",
  "pedido.pago": "Pedido pago",
  "pedido.recusado": "Pagamento recusado",
  "pedido.em-separacao": "Pedido em separação",
  "pedido.enviado": "Pedido enviado",
  "pedido.entregue": "Pedido entregue",
  "pedido.cancelado": "Pedido cancelado",
  "carrinho.abandonado": "Carrinho abandonado",
  "avaliacao.recebida": "Avaliação recebida",
  "categoria.seo-pendente": "SEO de categoria pendente",
  "categoria.seo-publicado": "SEO de categoria publicado",
};

const SITUACAO: Record<Item["status"], { rotulo: string; classe: string }> = {
  EMITIDO: { rotulo: "Enviado, aguardando", classe: "text-muted-foreground" },
  PROCESSANDO: { rotulo: "Em andamento", classe: "text-blue-700" },
  PROCESSADO: { rotulo: "Feito", classe: "text-emerald-700" },
  FALHOU: { rotulo: "Falhou", classe: "text-red-700" },
  IGNORADO: { rotulo: "Sem ação necessária", classe: "text-muted-foreground" },
  REENVIADO: { rotulo: "Reenviado", classe: "text-muted-foreground" },
};

const FICHAS: Array<{ valor: string; rotulo: string }> = [
  { valor: "", rotulo: "Tudo" },
  { valor: "FALHOU", rotulo: "Falhou" },
  { valor: "PROCESSANDO", rotulo: "Em andamento" },
  { valor: "PROCESSADO", rotulo: "Feito" },
];

const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/** "pedido:LJ-1042" vira "Pedido LJ-1042"; "loja:vedashow" some (é a própria loja). */
function contexto(c: string | null): string | null {
  if (!c) return null;
  const [tipo, valor] = c.split(":");
  return tipo === "pedido" ? `Pedido ${valor}` : null;
}

export default function Automacoes() {
  const router = useRouter();
  const caminho = usePathname();
  const params = useSearchParams();
  const status = params.get("status") ?? "";
  const pagina = Math.max(1, Number(params.get("pagina") ?? 1) || 1);
  const chave = `${status}|${pagina}`;
  const [dados, setDados] = useState<(Resposta & { chave: string }) | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const carregando = dados?.chave !== chave;

  const irPara = (mudanca: Record<string, string | null>) => {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(mudanca)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    const qs = p.toString();
    router.push(qs ? `${caminho}?${qs}` : caminho, { scroll: false });
  };

  const carregar = useCallback(async () => {
    const p = new URLSearchParams({ pagina: String(pagina) });
    if (status) p.set("status", status);
    try {
      const r = await fetch(`/api/painel/automacoes?${p}`);
      if (r.ok) setDados({ ...((await r.json()) as Resposta), chave });
    } catch {
      // Sem rede: a lista que já está na tela fica.
    }
  }, [pagina, status, chave]);

  /* eslint-disable-next-line react-hooks/set-state-in-effect -- a lista vem do servidor; o setState é o resultado do fetch */
  useEffect(() => { void carregar(); }, [carregar]);

  async function reenviar(eventId: string) {
    setOcupado(eventId);
    setAviso(null);
    const r = await fetch("/api/painel/automacoes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId }) });
    const d = await r.json().catch(() => ({}));
    setOcupado(null);
    if (!r.ok) { setAviso(d.erro ?? "Não foi possível reenviar."); return; }
    setAviso("Reenviado. Em alguns segundos aparece aqui como um aviso novo.");
    void carregar();
  }

  const r = dados?.resumo ?? {};
  const n = (k: string) => (r[k] ? ` (${r[k]})` : "");

  return (
    <Secao titulo="Automações" descricao="Cada aviso que a loja dispara: WhatsApp de pedido pago, e-mail de carrinho abandonado, relatório semanal. Aqui você vê se saiu e reenvia o que falhou.">
      <div className="flex flex-wrap gap-2">
        {FICHAS.map((f) => (
          <button
            key={f.valor}
            type="button"
            aria-pressed={status === f.valor}
            onClick={() => irPara({ status: f.valor || null, pagina: null })}
            className={`inline-flex h-11 items-center rounded-full border px-4 text-sm ${status === f.valor ? "border-foreground bg-foreground text-background" : "border-border"}`}
          >
            {f.rotulo}{f.valor ? n(f.valor) : ""}
          </button>
        ))}
      </div>

      {aviso && <p className="rounded-lg bg-muted p-3 text-sm">{aviso}</p>}

      {dados === null ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Carregando…</p>
      ) : dados.itens.length === 0 ? (
        <Vazio
          titulo={status ? "Nada com esse filtro." : "Nenhum aviso ainda."}
          texto={status ? "Volte para “Tudo”." : "Quando a loja disparar o primeiro aviso, ele aparece aqui."}
        />
      ) : (
        <ul className={`grid gap-2 ${carregando ? "opacity-50" : ""}`}>
          {dados.itens.map((e) => {
            const sit = SITUACAO[e.status];
            const ctx = contexto(e.correlationId);
            return (
              <li key={e.eventId} className="flex min-h-[56px] flex-wrap items-start gap-3 rounded-lg border border-border p-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{NOME[e.tipo] ?? e.tipo}{ctx ? <span className="font-normal text-muted-foreground"> · {ctx}</span> : null}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {quando(e.emitidoEm)}
                    {e.concluidoEm && e.status === "PROCESSADO" ? ` · feito às ${new Date(e.concluidoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}
                    {e.tentativas > 0 ? ` · ${e.tentativas}ª tentativa` : ""}
                  </div>
                  {/* Falha é vermelha; ressalva é âmbar. Um aviso que sobrou de
                      um evento que deu certo — "a venda entrou, mas não baixei o
                      estoque porque não reconheci a variação" — some da tela se
                      só a falha tiver onde aparecer, e é justamente o que pede
                      ação do lojista.

                      IGNORADO fica de fora de propósito: o detalhe dele é
                      sempre "tópico X ainda não tem tratamento", chega em
                      volume (mensagens de pós-venda, reclamações) e não tem
                      ação do outro lado. Âmbar em toda linha é âmbar que se
                      aprende a ignorar — e levaria junto o que é de verdade. */}
                  {e.detalhe && (e.status === "FALHOU" || e.status === "PROCESSADO") && (
                    <div className={`mt-1 text-xs ${e.status === "FALHOU" ? "text-red-700" : "text-amber-700"}`}>{e.detalhe}</div>
                  )}
                </div>
                <span className={`text-sm ${sit.classe}`}>{sit.rotulo}</span>
                {e.status === "FALHOU" && (
                  <button type="button" className="btn-secundario inline-flex h-11 items-center px-3 text-xs" disabled={ocupado === e.eventId} onClick={() => reenviar(e.eventId)}>
                    {ocupado === e.eventId ? "Reenviando…" : "Reenviar"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {dados && dados.total > 0 && (
        <Paginacao pagina={dados.pagina} paginas={dados.paginas} total={dados.total} porPagina={dados.porPagina} ocupado={carregando} aoMudar={(p) => irPara({ pagina: p > 1 ? String(p) : null })} substantivo="avisos" />
      )}
    </Secao>
  );
}
