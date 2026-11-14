"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "@/components/LinkLoja";
import { EVENTO_PREFERENCIAS, lerConsentimentoAtual, reabrirConsentimento, salvarConsentimento } from "@/lib/consentimento";
import { escolhaDasPermissoes, permissoesDaEscolha, type Escolha } from "@/lib/consentimento-config";

/** O painel só abre pelo rodapé; editar e fechar não altera a escolha salva. */
export default function Consentimento({ ativo, plataforma = false }: { ativo: boolean; plataforma?: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [medicao, setMedicao] = useState(false);
  const [publicidade, setPublicidade] = useState(false);
  const titulo = useId();
  const fecharBotao = useRef<HTMLButtonElement>(null);
  const origem = useRef<HTMLElement | null>(null);

  useEffect(() => {
    function abrir() {
      const permissoes = permissoesDaEscolha(lerConsentimentoAtual());
      setMedicao(permissoes.medicao);
      setPublicidade(permissoes.publicidade);
      origem.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setAberto(true);
    }
    window.addEventListener(EVENTO_PREFERENCIAS, abrir);
    return () => window.removeEventListener(EVENTO_PREFERENCIAS, abrir);
  }, []);
  useEffect(() => { if (aberto) fecharBotao.current?.focus(); }, [aberto]);

  function fechar() {
    setAberto(false);
    origem.current?.focus();
  }
  function salvar(escolha: Escolha) {
    salvarConsentimento(escolha);
    fechar();
  }
  if (!ativo || !aberto) return null;

  return (
    <div role="dialog" aria-labelledby={titulo} className="aviso-cookies" onKeyDown={(evento) => { if (evento.key === "Escape") fechar(); }}>
      <div>
        <div className="flex items-center justify-between gap-4">
          <h2 id={titulo} className="font-semibold">Preferências de cookies</h2>
          <button ref={fecharBotao} type="button" className="underline" onClick={fechar}>Fechar</button>
        </div>
        <p>
          Cookies necessários mantêm {plataforma ? "sua sessão" : "sua sessão e seu carrinho"}. Você pode escolher separadamente medição e publicidade.{" "}
          {plataforma ? <a href="https://avilaops.com/politica-de-privacidade/">Como tratamos seus dados</a> : <Link href="/politicas/privacidade">Como tratamos seus dados</Link>}.
        </p>
        <fieldset className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
          <legend className="sr-only">Cookies opcionais</legend>
          <label className="flex items-center gap-2"><input type="checkbox" checked={medicao} onChange={(evento) => setMedicao(evento.target.checked)} />Medição de audiência</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={publicidade} onChange={(evento) => setPublicidade(evento.target.checked)} />Publicidade</label>
        </fieldset>
      </div>
      <div className="aviso-cookies-acoes">
        <button type="button" className="btn-secundario" onClick={() => salvar("essencial")}>Recusar opcionais</button>
        <button type="button" className="btn-secundario" onClick={() => salvar("aceito")}>Aceitar todos</button>
        <button type="button" className="btn-primario" onClick={() => salvar(escolhaDasPermissoes(medicao, publicidade))}>Salvar preferências</button>
      </div>
    </div>
  );
}

export function PreferenciasCookies() {
  return <button type="button" className="underline hover:text-foreground" onClick={reabrirConsentimento}>Preferências de cookies</button>;
}
