"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Secao } from "./campos";
import type { EstadoDescoberta } from "@/lib/descoberta";

/**
 * Configurações → Descoberta: como a loja aparece para o Google, o Bing e o
 * ChatGPT, em linguagem de quem vende.
 *
 * Quase tudo aqui é leitura. A plataforma já liga busca em toda loja ativa e
 * o lojista não precisa saber o que é Googlebot. A única decisão dele é a de
 * treinamento de IA, que não muda nada na busca e por isso é uma linha só,
 * desligada por padrão, com o preço dito na frente.
 */
export default function Descoberta({ estado }: { estado: EstadoDescoberta }) {
  const router = useRouter();
  const [treino, setTreino] = useState(estado.treinamentoIa);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function alternar(valor: boolean) {
    setSalvando(true);
    setErro(null);
    const r = await fetch("/api/painel/loja", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ permiteTreinamentoIa: valor }),
    });
    setSalvando(false);
    if (!r.ok) {
      setErro("Não foi possível salvar. Tente de novo.");
      return;
    }
    setTreino(valor);
    router.refresh();
  }

  const sim = <span className="text-emerald-700">Ativo</span>;
  const nao = <span className="text-muted-foreground">Desligado</span>;

  return (
    <Secao titulo="Descoberta e buscadores" descricao="O que os mecanismos de busca e os assistentes de IA podem ver da sua loja. A plataforma cuida disto; você não precisa configurar nada para aparecer.">
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <Linha rotulo="Endereço oficial">{estado.dominioCanonico}</Linha>
        <Linha rotulo="Site indexável">{estado.indexavel ? sim : nao}</Linha>
        <Linha rotulo="Google e Bing">{estado.busca.google ? "Permitidos" : "Bloqueados"}</Linha>
        <Linha rotulo="ChatGPT (busca)">{estado.busca.chatgpt ? "Permitido" : "Bloqueado"}</Linha>
        <Linha rotulo="Mapa do site">
          <a className="underline underline-offset-4" href={estado.sitemap} target="_blank" rel="noopener">sitemap.xml</a>
        </Linha>
        <Linha rotulo="Resumo para assistentes de IA">
          <a className="underline underline-offset-4" href={estado.llms} target="_blank" rel="noopener">llms.txt</a>
        </Linha>
      </dl>

      {!estado.noEnderecoOficial && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Você está vendo o painel por um endereço que não é o oficial. A loja continua servida aqui, mas o Google é orientado a indexar só {estado.dominioCanonico}.
        </p>
      )}

      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4 text-sm">
        <input type="checkbox" className="mt-0.5 size-5 accent-primary" checked={treino} disabled={salvando} onChange={(e) => alternar(e.target.checked)} />
        <span>
          <span className="font-medium">Permitir que empresas de IA usem o conteúdo da loja para treinar modelos</span>
          <span className="mt-1 block text-xs text-muted-foreground">
            Não muda nada em aparecer no Google, no Bing ou na busca do ChatGPT: isso já está ligado. Esta opção só libera os robôs de treinamento (GPTBot, Google-Extended e similares). Desligada por padrão.
          </span>
        </span>
      </label>
      {erro && <p className="text-sm text-red-700">{erro}</p>}
    </Secao>
  );
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{rotulo}</dt>
      <dd className="mt-0.5 break-all">{children}</dd>
    </div>
  );
}
