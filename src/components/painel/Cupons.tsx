"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Campo, Secao, brl, inputClasse } from "./campos";
import ListaDeRegistros from "@/components/aplicacao/ListaDeRegistros";
import Vazio from "@/components/aplicacao/Vazio";

/**
 * Os cupons da loja.
 *
 * A tela abria com o formulário de "Novo cupom" e só depois mostrava o que já
 * existe. Quem entra em Promoções quase sempre quer conferir uma campanha que
 * está no ar, não criar outra: agora a lista vem primeiro e a criação é uma
 * ação explícita.
 *
 * O formulário também deixou de mostrar tudo de uma vez. "Frete grátis" não
 * tem percentual nem valor, e pedir os dois campos obriga a pessoa a ignorar
 * metade da tela para entender qual metade vale.
 */
export interface CupomView {
  id: string; codigo: string; tipo: string; valor: number;
  minimoCentavos: number; usosMax: number | null; usos: number;
  validoAte: string | null; ativo: boolean;
}

const TIPO: Record<string, string> = { PERCENTUAL: "% de desconto", FIXO: "Valor fixo em reais", FRETE_GRATIS: "Frete grátis" };

const VAZIO = { codigo: "", tipo: "PERCENTUAL", valor: "", minimo: "", usosMax: "", validoAte: "" };

const dia = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

export default function Cupons({
  cupons,
  chamar,
  ocupado,
}: {
  cupons: CupomView[];
  chamar: (c: string, m: string, b?: unknown, s?: string) => Promise<unknown>;
  ocupado: boolean;
}) {
  const [criando, setCriando] = useState(false);
  const [f, setF] = useState(VAZIO);
  const centavos = (v: string) => Math.round(Number.parseFloat(v.replace(/[^\d,.-]/g, "").replace(",", ".")) * 100);

  function salvar() {
    const corpo = {
      codigo: f.codigo,
      tipo: f.tipo,
      valor: f.tipo === "PERCENTUAL" ? Number(f.valor) || 0 : f.tipo === "FIXO" ? centavos(f.valor || "0") : 0,
      minimoCentavos: f.minimo ? centavos(f.minimo) : 0,
      usosMax: f.usosMax ? Number(f.usosMax) : null,
      validoAte: f.validoAte ? new Date(`${f.validoAte}T23:59:59`).toISOString() : null,
    };
    chamar("/api/painel/cupons", "POST", corpo, "Cupom criado.").then(() => {
      setF(VAZIO);
      setCriando(false);
    });
  }

  const desconto = (c: CupomView) =>
    c.tipo === "PERCENTUAL" ? `${c.valor}% de desconto` : c.tipo === "FIXO" ? `${brl(c.valor)} de desconto` : "Frete grátis";

  /** O estado do cupom na língua de quem vende, não a coluna do banco. */
  const estado = (c: CupomView) => {
    if (!c.ativo) return <span className="text-muted-foreground">desativado</span>;
    if (c.validoAte && new Date(c.validoAte) < new Date()) return <span className="text-muted-foreground">venceu em {dia(c.validoAte)}</span>;
    if (c.usosMax && c.usos >= c.usosMax) return <span className="text-muted-foreground">limite atingido</span>;
    if (c.validoAte) return <span className="text-emerald-700">vale até {dia(c.validoAte)}</span>;
    return <span className="text-emerald-700">no ar</span>;
  };

  const ativos = cupons.filter((c) => c.ativo);

  return (
    <>
      <Secao
        titulo="Cupons"
        descricao="O cliente digita o código no carrinho. O desconto é calculado no servidor, então ninguém consegue inventar valor."
      >
        {!criando && (
          <div>
            <button className="btn-primario inline-flex h-11 items-center gap-2 px-4" onClick={() => setCriando(true)}>
              <Plus size={16} /> Novo cupom
            </button>
          </div>
        )}

        {/* A criação só aparece quando pedida, e mostra apenas o que o tipo
            escolhido usa. */}
        {criando && (
          <div className="grid gap-4 rounded-xl border border-border p-4">
            <div className="flex items-center justify-between">
              <b>Novo cupom</b>
              <button className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted" onClick={() => setCriando(false)} aria-label="Cancelar">
                <X size={16} />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Código" ajuda="É o que o cliente digita no carrinho.">
                <input className={`${inputClasse} uppercase`} value={f.codigo} onChange={(e) => setF({ ...f, codigo: e.target.value.toUpperCase() })} placeholder="BEMVINDO10" />
              </Campo>
              <Campo label="Tipo de desconto">
                <select className={inputClasse} value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
                  {Object.entries(TIPO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                </select>
              </Campo>

              {/* Frete grátis não tem percentual nem valor: o campo não existe. */}
              {f.tipo !== "FRETE_GRATIS" && (
                <Campo label={f.tipo === "PERCENTUAL" ? "Quantos por cento" : "Quantos reais"}>
                  <input className={inputClasse} value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} inputMode="decimal" placeholder={f.tipo === "PERCENTUAL" ? "10" : "25,00"} />
                </Campo>
              )}

              <Campo label="Compra mínima" ajuda="Deixe vazio para valer em qualquer compra.">
                <input className={inputClasse} value={f.minimo} onChange={(e) => setF({ ...f, minimo: e.target.value })} inputMode="decimal" placeholder="R$" />
              </Campo>
              <Campo label="Limite de usos" ajuda="Vazio = sem limite.">
                <input className={inputClasse} value={f.usosMax} onChange={(e) => setF({ ...f, usosMax: e.target.value })} inputMode="numeric" />
              </Campo>
              <Campo label="Válido até" ajuda="Vazio = sem prazo.">
                <input className={inputClasse} type="date" value={f.validoAte} onChange={(e) => setF({ ...f, validoAte: e.target.value })} />
              </Campo>
            </div>

            <div className="flex flex-wrap gap-2">
              <button className="btn-primario h-11" disabled={ocupado || f.codigo.trim().length < 2} onClick={salvar}>
                Criar cupom
              </button>
              <button className="btn-secundario h-11 px-4" disabled={ocupado} onClick={() => { setF(VAZIO); setCriando(false); }}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        <ListaDeRegistros
          itens={cupons}
          titulo={(c) => (
            <span className="font-mono font-semibold">
              {c.codigo}
              {!c.ativo && <span className="ml-2 font-sans text-xs font-normal text-muted-foreground">(desativado)</span>}
            </span>
          )}
          subtitulo={(c) => (
            <>
              {desconto(c)}
              {c.minimoCentavos > 0 && ` · a partir de ${brl(c.minimoCentavos)}`}
            </>
          )}
          selo={(c) => (
            <>
              {estado(c)}
              <span className="text-muted-foreground">
                {c.usos} uso{c.usos === 1 ? "" : "s"}{c.usosMax ? ` de ${c.usosMax}` : ""}
              </span>
            </>
          )}
          colunas={[
            { rotulo: "Código", celula: (c) => <span className="font-mono font-semibold">{c.codigo}</span> },
            { rotulo: "Desconto", celula: desconto, largura: "w-40" },
            { rotulo: "Mínimo", celula: (c) => (c.minimoCentavos ? brl(c.minimoCentavos) : "—"), largura: "w-28", numero: true },
            { rotulo: "Usos", celula: (c) => `${c.usos}${c.usosMax ? ` / ${c.usosMax}` : ""}`, largura: "w-24", numero: true },
            { rotulo: "Situação", celula: estado, largura: "w-44" },
          ]}
          // Desativar e destrutivo e nao se repete em cada linha do celular: la
          // a acao mora no cupom aberto. Na tabela do computador ela fica, porque
          // comparar e agir na mesma tela e o esperado com mouse.
          acoes={(c) =>
            c.ativo ? (
              <button
                className="inline-flex h-11 items-center px-2 text-muted-foreground underline"
                disabled={ocupado}
                onClick={() => {
                  if (confirm(`Desativar o cupom ${c.codigo}? Quem ja usou continua com o desconto do pedido.`)) {
                    chamar(`/api/painel/cupons?id=${c.id}`, "DELETE", undefined, "Cupom desativado.");
                  }
                }}
              >
                desativar
              </button>
            ) : null
          }
          vazio={
            <Vazio
              titulo="Nenhum cupom criado."
              texto="Cupom é um código que o cliente digita no carrinho para ganhar desconto ou frete grátis. Serve para primeira compra, campanha de data e recuperação de carrinho."
              acao={{ rotulo: "Criar o primeiro cupom", onClick: () => setCriando(true) }}
            />
          }
        />

        {cupons.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {ativos.length} de {cupons.length} no ar.
          </p>
        )}
      </Secao>
    </>
  );
}
