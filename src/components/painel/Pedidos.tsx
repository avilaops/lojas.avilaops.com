"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Secao, brl, inputClasse } from "./campos";
import ListaDeRegistros from "@/components/aplicacao/ListaDeRegistros";
import Filtros from "@/components/aplicacao/Filtros";
import Paginacao from "@/components/aplicacao/Paginacao";
import Vazio from "@/components/aplicacao/Vazio";
import { paginaValida } from "@/lib/pedidos-painel";
import BaixarPlanilha from "./BaixarPlanilha";

/**
 * Os pedidos da loja.
 *
 * A lista vem de `/api/painel/pedidos`, com busca, situação e página
 * resolvidas no banco. Antes a tela recebia os 200 mais recentes com itens e
 * filtrava no navegador: numa loja grande o pedido 201 não existia, e toda
 * rota do painel pagava esses 200 pedidos mesmo sem mostrá-los.
 *
 * Busca, situação e página moram na URL (`?situacao=PAGO&pagina=3`): voltar
 * no navegador volta para o filtro anterior, e o endereço pode ser colado
 * para alguém da equipe abrir a mesma fila.
 *
 * A regra da linha continua: uma ação principal por pedido, a que faz o
 * pedido andar. As demais moram na tela do pedido.
 */
type Item = {
  id: string;
  numero: number;
  referencia: string;
  status: string;
  clienteNome: string;
  clienteTelefone: string;
  totalCentavos: number;
  criadoEm: string;
  rastreio: string | null;
  itens: number;
};

type Resposta = {
  total: number;
  pagina: number;
  porPagina: number;
  paginas: number;
  resumo: Record<string, number>;
  itens: Item[];
};

const SITUACAO: Record<string, string> = {
  AGUARDANDO_PAGAMENTO: "Aguardando pagamento",
  PAGO: "Pago",
  EM_SEPARACAO: "Em separação",
  ENVIADO: "Enviado",
  ENTREGUE: "Entregue",
  CANCELADO: "Cancelado",
  ESTORNADO: "Estornado",
};

/** O passo que faz o pedido andar, e o rótulo que o lojista entende. */
const PROXIMO: Record<string, string> = {
  PAGO: "Separar",
  EM_SEPARACAO: "Marcar enviado",
  ENVIADO: "Marcar entregue",
};

const dia = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

export default function Pedidos({
  chamar,
  ocupado,
}: {
  chamar: (c: string, m: string, b?: unknown, s?: string) => Promise<unknown>;
  ocupado: boolean;
}) {
  const router = useRouter();
  const caminho = usePathname();
  const params = useSearchParams();

  // A URL é a fonte: o estado local só existe para a busca não disparar a
  // cada tecla.
  const situacao = params.get("situacao") ?? "";
  const aplicada = params.get("q") ?? "";
  const pagina = paginaValida(params.get("pagina"));
  const [busca, setBusca] = useState(aplicada);
  // A resposta guarda a chave dos filtros que a geraram. "Carregando" é a
  // resposta na tela não ser a da URL atual: derivado, sem setState no efeito.
  const [dados, setDados] = useState<(Resposta & { chave: string }) | null>(null);
  const [rastreio, setRastreio] = useState<Record<string, string>>({});
  const chave = `${pagina}|${aplicada}|${situacao}`;
  const carregando = dados?.chave !== chave;
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null);

  const irPara = useCallback(
    (mudanca: Record<string, string | null>) => {
      const p = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(mudanca)) {
        if (v) p.set(k, v);
        else p.delete(k);
      }
      const qs = p.toString();
      router.push(qs ? `${caminho}?${qs}` : caminho, { scroll: false });
    },
    [params, caminho, router],
  );

  useEffect(() => {
    if (busca === aplicada) return;
    if (relogio.current) clearTimeout(relogio.current);
    relogio.current = setTimeout(() => irPara({ q: busca.trim() || null, pagina: null }), 300);
    return () => { if (relogio.current) clearTimeout(relogio.current); };
  }, [busca, aplicada, irPara]);

  const carregar = useCallback(async () => {
    const p = new URLSearchParams({ pagina: String(pagina) });
    if (aplicada) p.set("q", aplicada);
    if (situacao) p.set("situacao", situacao);
    try {
      const r = await fetch(`/api/painel/pedidos?${p}`);
      if (r.ok) setDados({ ...((await r.json()) as Resposta), chave });
    } catch {
      // Falha de rede não apaga a lista que já está na tela.
    }
  }, [pagina, aplicada, situacao, chave]);

  /* eslint-disable-next-line react-hooks/set-state-in-effect -- a lista vem do servidor; o setState é o resultado do fetch, não um cálculo derivado de props */
  useEffect(() => { void carregar(); }, [carregar]);

  async function avancar(p: Item) {
    const corpo: Record<string, unknown> = { id: p.id };
    if (p.status === "EM_SEPARACAO" && rastreio[p.id]) corpo.rastreio = rastreio[p.id];
    await chamar("/api/painel/pedidos", "PATCH", corpo, "Pedido atualizado.");
    void carregar();
  }

  const r = dados?.resumo ?? {};
  const n = (k: string) => (r[k] ? ` (${r[k].toLocaleString("pt-BR")})` : "");
  // As fichas dizem quantos há em cada fila: é o número que decide por onde
  // começar o dia, e sai do banco, não da página carregada.
  const fichas = [
    { valor: "", rotulo: "Todos" },
    { valor: "PAGO", rotulo: `A separar${n("PAGO")}` },
    { valor: "EM_SEPARACAO", rotulo: `Separando${n("EM_SEPARACAO")}` },
    { valor: "ENVIADO", rotulo: `Enviados${n("ENVIADO")}` },
    { valor: "AGUARDANDO_PAGAMENTO", rotulo: `Aguardando pagamento${n("AGUARDANDO_PAGAMENTO")}` },
  ];

  const cliente = (p: Item) => (
    <>
      {p.clienteNome}
      {p.itens > 0 && (
        <span className="text-muted-foreground">
          {" · "}
          {p.itens} {p.itens === 1 ? "item" : "itens"}
        </span>
      )}
    </>
  );

  const acao = (p: Item) =>
    PROXIMO[p.status] ? (
      <button className="btn-secundario inline-flex h-11 items-center px-3 text-xs" disabled={ocupado} onClick={() => avancar(p)}>
        {PROXIMO[p.status]}
      </button>
    ) : null;

  const filtrando = Boolean(aplicada || situacao);
  const itens = dados?.itens ?? [];

  return (
    <Secao titulo="Pedidos" descricao="Procure pelo número, nome ou telefone. Toque no pedido para ver os itens, o endereço e a etiqueta.">
      <Filtros
        busca={busca}
        aoBuscar={setBusca}
        exemplo="Número do pedido, nome ou telefone"
        fichas={fichas}
        ativa={situacao}
        aoEscolher={(v) => irPara({ situacao: v || null, pagina: null })}
      />

      <ListaDeRegistros
        itens={itens}
        carregando={carregando}
        href={(p) => `/painel/pedidos/${p.id}`}
        titulo={(p) => (
          <>
            <span className="font-mono">#{p.numero}</span>
            <span className="ml-2 font-normal text-muted-foreground">{dia(p.criadoEm)}</span>
          </>
        )}
        subtitulo={cliente}
        selo={(p) => (
          <>
            <b className="tabular-nums">{brl(p.totalCentavos)}</b>
            <span className="text-muted-foreground">{SITUACAO[p.status] ?? p.status}</span>
            {/* O código de rastreio aparece onde ele é digitado: quando o
                pedido está em separação e falta despachar. */}
            {p.status === "EM_SEPARACAO" && (
              <input
                className={`${inputClasse} ml-auto h-11 w-40`}
                placeholder="Código de rastreio"
                aria-label={`Código de rastreio do pedido ${p.numero}`}
                value={rastreio[p.id] ?? ""}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setRastreio({ ...rastreio, [p.id]: e.target.value })}
              />
            )}
            {acao(p) && <span className="ml-auto">{acao(p)}</span>}
          </>
        )}
        colunas={[
          { rotulo: "Pedido", celula: (p) => <span className="font-mono">#{p.numero}</span>, largura: "w-28" },
          { rotulo: "Cliente", celula: cliente },
          { rotulo: "Total", celula: (p) => brl(p.totalCentavos), largura: "w-28", numero: true },
          { rotulo: "Situação", celula: (p) => SITUACAO[p.status] ?? p.status, largura: "w-40" },
          { rotulo: "Data", celula: (p) => dia(p.criadoEm), largura: "w-24" },
        ]}
        acoes={acao}
        vazio={
          dados === null ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Carregando pedidos…</p>
          ) : (
            <Vazio
              titulo={filtrando ? "Nenhum pedido com esse filtro." : "Nenhum pedido ainda."}
              texto={
                filtrando
                  ? "Tente outro termo, ou volte para “Todos”."
                  : "Quando alguém comprar, o pedido aparece aqui com os itens, o endereço e a etiqueta de envio."
              }
              acao={filtrando ? { rotulo: "Ver todos", onClick: () => { setBusca(""); irPara({ q: null, situacao: null, pagina: null }); } } : undefined}
            />
          )
        }
      />

      {dados && dados.total > 0 && (
        <Paginacao
          pagina={dados.pagina}
          paginas={dados.paginas}
          total={dados.total}
          porPagina={dados.porPagina}
          ocupado={carregando}
          aoMudar={(p) => irPara({ pagina: p > 1 ? String(p) : null })}
          substantivo="pedidos"
        />
      )}

      {dados && dados.total > 0 && (
        <BaixarPlanilha
          tipo="pedidos"
          rotulo="Baixar pedidos:"
          ajuda="Documento e telefone saem como texto, do jeito que foram digitados."
        />
      )}
    </Secao>
  );
}
