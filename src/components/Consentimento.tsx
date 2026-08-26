"use client";

import Link from "next/link";
import { reabrirConsentimento, salvarConsentimento, useConsentimento } from "@/lib/consentimento";

/**
 * Aviso de cookies. Só aparece quando a loja tem algum pixel configurado —
 * loja que não anuncia não usa cookie de terceiro e não tem o que perguntar.
 *
 * O texto é da plataforma, igual em toda loja: é assim que a conformidade
 * escala sem ninguém revisar loja por loja.
 */
export default function Consentimento({ ativo }: { ativo: boolean }) {
  // `undefined` é o estado do servidor: até hidratar não desenhamos nada, senão
  // o banner pisca na tela de quem já respondeu.
  const escolha = useConsentimento();
  if (!ativo || escolha !== null) return null;

  return (
    <div role="dialog" aria-label="Aviso de cookies" className="aviso-cookies">
      <p>
        Usamos cookies para lembrar seu carrinho e, com sua permissão, medir a audiência e a
        eficiência dos nossos anúncios. Você escolhe.{" "}
        <Link href="/politicas/privacidade">Como tratamos seus dados</Link>.
      </p>
      <div className="aviso-cookies-acoes">
        <button type="button" className="btn-secundario" onClick={() => salvarConsentimento("essencial")}>
          Só o necessário
        </button>
        <button type="button" className="btn-primario" onClick={() => salvarConsentimento("aceito")}>
          Aceitar
        </button>
      </div>
    </div>
  );
}

/** Link do rodapé para quem quer mudar de ideia depois — exigência prática do art. 8º, §5º da LGPD. */
export function PreferenciasCookies() {
  return (
    <button type="button" className="underline hover:text-foreground" onClick={reabrirConsentimento}>
      Cookies
    </button>
  );
}
