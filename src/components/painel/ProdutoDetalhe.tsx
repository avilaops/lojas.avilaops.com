"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import EditarProduto from "./EditarProduto";
import GradeVariantes from "./GradeVariantes";
import QualidadeProduto from "./QualidadeProduto";

/**
 * O produto numa página, e não numa camada por cima da lista.
 *
 * O formulário é o mesmo de antes: o que muda é ter endereço. Editar um
 * produto deixa de exigir rolar a tabela até achar a linha, e o link abre
 * direto no que o lojista quer mexer.
 *
 * A grade de variações continua aparecendo por cima, porque ali o lojista está
 * no meio de uma edição e voltar para a lista perderia o contexto.
 */
export default function ProdutoDetalhe({ id, nome, urlNaLoja, temVariacoes, segmento }: {
  id: string;
  nome: string;
  urlNaLoja: string | null;
  temVariacoes: boolean;
  /** Ramo da loja: decide se o formulário mostra os campos do medicamento. */
  segmento: string;
}) {
  const router = useRouter();
  const [grade, setGrade] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [revisao, setRevisao] = useState(0);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/painel/produtos" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:underline">
          <ArrowLeft size={15} /> Produtos
        </Link>
        {urlNaLoja && (
          <a href={urlNaLoja} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:underline">
            Ver na loja <ExternalLink size={13} />
          </a>
        )}
        <button className="btn-secundario ml-auto h-9 px-3 text-xs" onClick={() => setGrade(true)}>
          {temVariacoes ? "Grade de variações" : "Criar variações"}
        </button>
      </div>

      {ok && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{ok}</p>}
      <QualidadeProduto produtoId={id} revisao={revisao} aoAbrirVariantes={()=>setGrade(true)} />

      {grade && (
        <GradeVariantes
          produtoId={id}
          produtoNome={nome}
          aoFechar={() => setGrade(false)}
          aoSalvar={(m) => { setOk(m); setGrade(false); setRevisao(r=>r+1); router.refresh(); }}
        />
      )}

      <EditarProduto
        key={revisao}
        produtoId={id}
        segmento={segmento}
        aoFechar={() => router.push("/painel/produtos")}
        aoSalvar={(m) => { setOk(m); setRevisao(r=>r+1); router.refresh(); }}
      />
    </div>
  );
}
