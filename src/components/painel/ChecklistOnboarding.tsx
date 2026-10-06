import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import type { PassoChecklist, ResumoChecklist } from "@/lib/checklist-onboarding";

/**
 * Checklist de onboarding da visão geral. Só desenha: o estado vem pronto de
 * `checklistDeOnboarding`, derivado do que a loja já tem gravado. Por isso não
 * há botão de dispensar nem estado salvo — o passo some quando é resolvido.
 */
export default function ChecklistOnboarding({ passos, resumo }: { passos: PassoChecklist[]; resumo: ResumoChecklist }) {
  return (
    <section className="painel-checklist" aria-labelledby="painel-checklist-titulo">
      <header className="painel-checklist-topo">
        <div>
          <small>Primeiros passos da loja</small>
          <h3 id="painel-checklist-titulo">Para a loja vender</h3>
        </div>
        <p className="painel-checklist-conta">
          <b>{resumo.feitos}</b> de {resumo.total}
        </p>
      </header>
      <ol className="painel-checklist-lista">
        {passos.map((passo) => (
          <li
            key={passo.id}
            className={`painel-checklist-passo${passo.feito ? " painel-checklist-feito" : ""}`}
            aria-current={resumo.proximo?.id === passo.id ? "step" : undefined}
          >
            <span className="painel-checklist-marca">
              {passo.feito ? <CheckCircle2 size={20} aria-hidden="true" /> : <Circle size={20} aria-hidden="true" />}
              <span className="sr-only">{passo.feito ? "Feito:" : "Pendente:"}</span>
            </span>
            <div className="painel-checklist-texto">
              <strong>
                {passo.titulo}{" "}
                {passo.opcional && <em className="painel-checklist-opcional">opcional</em>}
              </strong>
              <p>{passo.detalhe}</p>
            </div>
            {!passo.feito && (
              <Link href={passo.href} className="painel-checklist-acao">
                {passo.acao}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
