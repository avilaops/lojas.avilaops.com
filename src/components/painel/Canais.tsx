"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, ExternalLink, Link2, RefreshCw, Unlink } from "lucide-react";
import { Secao } from "./campos";

export type CanalMl = {
  conectado: boolean;
  nickname: string | null;
  userId: string | null;
  conectadoEm: string | null;
  expiraEm: string | null;
  /** Anúncios por estado, para o lojista saber o que está de pé. */
  anuncios: { publicado: number; rascunho: number; recusado: number; pausado: number };
};

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** O que o retorno do Mercado Livre diz, na língua do lojista. */
const RETORNO: Record<string, { tom: "ok" | "erro"; texto: string }> = {
  conectado: { tom: "ok", texto: "Conta do Mercado Livre conectada." },
  recusado: { tom: "erro", texto: "Você não autorizou a conexão. Nada foi salvo." },
  incompleto: { tom: "erro", texto: "O Mercado Livre não devolveu os dados da autorização. Tente de novo." },
  falhou: { tom: "erro", texto: "Não consegui completar a conexão. Tente de novo; se insistir, me chame." },
};

/**
 * Canais de venda do lojista.
 *
 * Existe porque o retorno da autorização do Mercado Livre precisa cair em
 * algum lugar: o `/ml/callback` redireciona para cá com `?ml=<resultado>`, e
 * sem esta tela o lojista autorizava no ML e voltava para um 404.
 *
 * A conta do ML é a mesma do Mercado Pago, mas a autorização é outra: o token
 * de pagamento não carrega permissão de venda. Por isso são dois botões em
 * telas diferentes, e não um só.
 */
export default function Canais({ loja, ml, retorno }: {
  loja: { slug: string; nome: string };
  ml: CanalMl;
  retorno?: string;
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const aviso = retorno ? RETORNO[retorno] : undefined;

  async function desconectar() {
    if (!confirm("Desconectar o Mercado Livre? Os anúncios continuam lá, mas a loja para de sincronizar preço e estoque.")) return;
    setErro(null);
    setOcupado(true);
    try {
      const r = await fetch("/api/painel/canais/mercadolivre", { method: "DELETE" });
      if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { erro?: string }).erro ?? "Falha.");
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha inesperada.");
    } finally {
      setOcupado(false);
    }
  }

  const total = ml.anuncios.publicado + ml.anuncios.rascunho + ml.anuncios.recusado + ml.anuncios.pausado;

  return (
    <>
      {aviso && (
        <p className={`rounded-lg p-3 text-sm ${aviso.tom === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
          {aviso.texto}
        </p>
      )}
      {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}

      <Secao
        titulo="Mercado Livre"
        descricao="Anuncie o mesmo catálogo da sua loja no Mercado Livre, com preço e estoque sincronizados. É a mesma conta do Mercado Pago, mas precisa de uma autorização própria para vender."
      >
        {ml.conectado ? (
          <>
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
              <Check size={18} className="flex-none text-emerald-600" />
              <span className="flex-1 text-sm">
                <b className="block">{ml.nickname ?? "Conta conectada"}</b>
                <span className="text-xs text-muted-foreground">
                  {ml.userId && `código ${ml.userId}`}
                  {ml.conectadoEm && ` · conectada em ${dataHora(ml.conectadoEm)}`}
                </span>
              </span>
              <button className="btn-secundario inline-flex h-9 items-center gap-1.5 px-3 text-xs" disabled={ocupado} onClick={desconectar}>
                <Unlink size={14} /> Desconectar
              </button>
            </div>

            {total === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum produto anunciado ainda. O próximo passo é escolher o que vai para o Mercado Livre.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-4">
                {([
                  ["Publicados", ml.anuncios.publicado],
                  ["Rascunhos", ml.anuncios.rascunho],
                  ["Recusados", ml.anuncios.recusado],
                  ["Pausados", ml.anuncios.pausado],
                ] as const).map(([rotulo, n]) => (
                  <div key={rotulo} className="rounded-lg border border-border p-3">
                    <small className="text-xs uppercase text-muted-foreground">{rotulo}</small>
                    <strong className="block text-xl">{n}</strong>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Ao conectar, você autoriza a loja a criar e atualizar anúncios em seu nome. O dinheiro continua caindo na sua
              conta e o anúncio continua sendo seu: se desconectar, ele permanece no ar, só para de sincronizar.
            </p>
            <div>
              <a className="btn-primario inline-flex items-center gap-2" href={`/api/painel/canais/mercadolivre?loja=${loja.slug}`}>
                <Link2 size={15} /> Conectar Mercado Livre
              </a>
            </div>
          </>
        )}
      </Secao>

      <Secao titulo="Outros canais" descricao="Em construção, na ordem em que aparecerem clientes pedindo.">
        <ul className="grid gap-2 text-sm text-muted-foreground">
          {["Amazon", "Shopee", "Magalu", "Leroy Merlin"].map((c) => (
            <li key={c} className="flex items-center gap-2 border-t border-border py-2">
              <AlertTriangle size={14} className="flex-none text-muted-foreground" />
              {c}
              <span className="ml-auto text-xs">ainda não</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          O Google Shopping já funciona sem conectar nada: o feed da sua loja está em{" "}
          <a className="inline-flex items-center gap-1 underline" href="/feed/merchant.xml" target="_blank" rel="noopener">
            /feed/merchant.xml <ExternalLink size={11} />
          </a>
          .
        </p>
      </Secao>
    </>
  );
}

export { RefreshCw };
