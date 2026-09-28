import { notFound } from "next/navigation";
import { exigirTenant, enderecoCompleto } from "@/lib/tenant";
import { mascararDocumento } from "@avilaops/checkout";
import { ROTULO_POLITICA, TIPOS_POLITICA, politicaPublicada, type TipoPolitica } from "@/lib/politicas";

/**
 * Página de política.
 *
 * O texto não mora mais aqui: quem decide o que vai ao ar é
 * `src/lib/politicas.ts`, porque a mesma resposta é dada em três lugares — esta
 * página, o rodapé (que só lista o que existe) e o painel (que mostra ao
 * lojista o que o cliente está lendo hoje). Com o texto no JSX, editar no
 * painel significaria ter duas verdades.
 */

export function generateStaticParams() {
  return TIPOS_POLITICA.map((tipo) => ({ tipo }));
}

export async function generateMetadata({ params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params;
  return {
    title: ROTULO_POLITICA[tipo as TipoPolitica] ?? "Políticas",
    // Sem canonical, o Google trata a mesma política em domínio próprio e em
    // <loja>.lojas.avilaops.com como duas páginas, e divide o sinal entre elas.
    alternates: { canonical: `/politicas/${tipo}` },
  };
}

export default async function Politica({ params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params;
  if (!TIPOS_POLITICA.includes(tipo as TipoPolitica)) notFound();
  const t = await exigirTenant();

  // Só o aviso legal pode não existir: é o único tipo sem modelo. Loja que não
  // escreveu o dela responde 404, em vez de publicar uma página vazia.
  const politica = politicaPublicada(t, tipo as TipoPolitica);
  if (!politica) notFound();

  const empresa = t.razaoSocial ?? t.nome;
  return (
    <div className="container-loja max-w-2xl py-10">
      <h1 className="text-2xl font-bold">{politica.titulo}</h1>
      <div className="prosa mt-4 text-sm leading-relaxed">
        {politica.paragrafos.map((p, i) => (
          <p key={i} className="whitespace-pre-line">{p}</p>
        ))}
      </div>
      {/* Identificação do fornecedor, Decreto 7.962/2013, art. 2º, I a III.
          Fica fora do texto editável de propósito: é obrigação legal e sai do
          cadastro, então nem some quando o lojista reescreve a política. */}
      <div className="mt-8 rounded-xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground">Quem vende</p>
        <p className="mt-1">
          {empresa}
          {t.cnpj && ` · CNPJ ${mascararDocumento(t.cnpj)}`}
        </p>
        {enderecoCompleto(t) && <p>{enderecoCompleto(t)}</p>}
        {t.emailContato && <p>{t.emailContato}</p>}
        {t.telefone && <p>{t.telefone}</p>}
      </div>
    </div>
  );
}
