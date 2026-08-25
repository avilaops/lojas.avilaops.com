"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ShoppingBag } from "lucide-react";
import { useCart } from "@/components/cart/CartProvider";
import { formatarBRL } from "@/lib/catalogo";

export interface VarianteView { id: string; nome: string; valores: Record<string, string>; precoCentavos: number | null; estoque: number | null; imagem: string | null }

/**
 * Seleção de variação na página do produto: um grupo de botões por opção
 * (Tamanho, Cor…). Combinação sem estoque fica desabilitada; o preço e a
 * foto seguem a variação escolhida. O carrinho recebe `<produtoId>:<varianteId>`.
 */
export default function SeletorVariante({ produto, opcoes, variantes, vende }: { produto: { id: string; slug: string; nome: string; precoCentavos: number; imagem?: string }; opcoes: string[]; variantes: VarianteView[]; vende: boolean }) {
  const { adicionar } = useCart();
  const router = useRouter();
  const [escolha, setEscolha] = useState<Record<string, string>>({});
  const [ok, setOk] = useState(false);

  const valoresPorOpcao = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const o of opcoes) m[o] = Array.from(new Set(variantes.map((v) => v.valores[o]).filter(Boolean)));
    return m;
  }, [opcoes, variantes]);

  const selecionada = variantes.find((v) => opcoes.every((o) => v.valores[o] === escolha[o]));
  const completa = opcoes.every((o) => escolha[o]);
  const disponivel = (v: VarianteView) => v.estoque == null || v.estoque > 0;
  const preco = selecionada?.precoCentavos ?? produto.precoCentavos;

  function valorDisponivel(opcao: string, valor: string) {
    // Existe alguma variação com estoque que combine com o já escolhido + este valor?
    return variantes.some((v) => v.valores[opcao] === valor && disponivel(v) && opcoes.every((o) => o === opcao || !escolha[o] || v.valores[o] === escolha[o]));
  }

  return (
    <div className="grid gap-4">
      {opcoes.map((o) => (
        <div key={o}>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{o}{escolha[o] ? `: ${escolha[o]}` : ""}</p>
          <div className="flex flex-wrap gap-2">
            {valoresPorOpcao[o]?.map((valor) => {
              const ativo = escolha[o] === valor;
              const pode = valorDisponivel(o, valor);
              return (
                <button key={valor} type="button" disabled={!pode} onClick={() => setEscolha((e) => ({ ...e, [o]: valor }))}
                  className={`h-10 min-w-10 rounded-lg border px-3 text-sm ${ativo ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"} ${pode ? "" : "opacity-40 line-through"}`}>
                  {valor}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <p className="text-3xl font-bold">{formatarBRL(preco)}</p>
      {vende && (
        <button className="btn-primario w-full max-w-sm" disabled={!completa || !selecionada || !disponivel(selecionada)} onClick={() => {
          if (!selecionada) return;
          adicionar({ id: `${produto.id}:${selecionada.id}`, slug: produto.slug, nome: `${produto.nome} — ${selecionada.nome}`, precoCentavos: preco, imagem: selecionada.imagem ?? produto.imagem });
          setOk(true); setTimeout(() => setOk(false), 1500); router.push("/carrinho");
        }}>
          {ok ? <Check className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
          {!completa ? "Escolha as opções" : selecionada && !disponivel(selecionada) ? "Esgotado" : "Adicionar ao carrinho"}
        </button>
      )}
    </div>
  );
}
