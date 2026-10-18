"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import type { PassoChecklist, ResumoChecklist } from "@/lib/checklist-onboarding";

/**
 * Checklist de onboarding da visão geral. O estado vem pronto de
 * `checklistDeOnboarding`, derivado do que a loja já tem gravado. Por isso não
 * há botão de dispensar nem estado salvo — o passo some quando é resolvido.
 *
 * Os passos são fichas numa linha e só um fica aberto, com o detalhe e a ação.
 * Empilhados, os seis ocupavam mais de mil pixels no celular, e a Visão geral
 * precisa caber numa tela: o lojista vê o que falta sem rolar e abre o passo
 * que quiser. Começa aberto no próximo passo a fazer.
 */
export default function ChecklistOnboarding({ passos, resumo }: { passos: PassoChecklist[]; resumo: ResumoChecklist }) {
  const [abertoId, setAbertoId] = useState(resumo.proximo?.id ?? passos[0]?.id);
  const aberto = passos.find((p) => p.id === abertoId) ?? passos[0];

  return (
    <section className="painel-checklist" aria-labelledby="painel-checklist-titulo">
      <header className="painel-checklist-topo">
        <h3 id="painel-checklist-titulo">Para a loja vender</h3>
        <p className="painel-checklist-conta">
          <b>{resumo.feitos}</b> de {resumo.total}
        </p>
      </header>
      <div className="painel-checklist-barra" aria-hidden="true">
        <span style={{ width: `${Math.round((resumo.feitos / Math.max(resumo.total, 1)) * 100)}%` }} />
      </div>
      <ol className="painel-checklist-passos">
        {passos.map((passo) => (
          <li key={passo.id}>
            <button
              type="button"
              className={`painel-checklist-ficha${passo.feito ? " painel-checklist-feito" : ""}`}
              aria-pressed={aberto?.id === passo.id}
              aria-controls="painel-checklist-detalhe"
              onClick={() => setAbertoId(passo.id)}
            >
              {passo.feito ? <CheckCircle2 size={15} aria-hidden="true" /> : <Circle size={15} aria-hidden="true" />}
              <span className="sr-only">{passo.feito ? "Feito:" : "Pendente:"}</span>
              {passo.titulo}
            </button>
          </li>
        ))}
      </ol>
      {aberto && (
        <div className="painel-checklist-detalhe" id="painel-checklist-detalhe" aria-live="polite">
          <p>
            <strong>
              {aberto.titulo}
              {aberto.opcional && <em className="painel-checklist-opcional">opcional</em>}
            </strong>
            {aberto.detalhe}
          </p>
          {!aberto.feito && (
            <Link href={aberto.href} className="painel-checklist-acao">
              {aberto.acao}
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
