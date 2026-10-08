"use client";

import Link from "@/components/LinkLoja";
import { ATRIBUTO_RESPONDIDO, CHAVE, VERSAO, reabrirConsentimento, salvarConsentimento, useConsentimento } from "@/lib/consentimento";

/**
 * Aviso de cookies. Só aparece quando a loja tem algum pixel configurado —
 * loja que não anuncia não usa cookie de terceiro e não tem o que perguntar.
 *
 * O texto é da plataforma, igual em toda loja: é assim que a conformidade
 * escala sem ninguém revisar loja por loja.
 */
export default function Consentimento({ ativo, plataforma = false }: { ativo: boolean; plataforma?: boolean }) {
  // `undefined` é o estado do servidor, e o aviso já sai no HTML: desenhado só
  // depois da hidratação, ele era o maior texto da tela no celular e virava o
  // LCP da página (4,7 s no PageSpeed, com 2,2 s só de espera pelo JavaScript).
  // Para não piscar na tela de quem já respondeu, o script abaixo roda antes
  // da pintura, marca o `<html>` e o CSS esconde o aviso por essa marca.
  const escolha = useConsentimento();
  if (!ativo || (escolha !== null && escolha !== undefined)) return null;

  return (
    <>
    <script dangerouslySetInnerHTML={{ __html: `try{var c=JSON.parse(localStorage.getItem(${JSON.stringify(CHAVE)})||"null");if(c&&c.versao===${VERSAO}&&(c.escolha==="aceito"||c.escolha==="essencial"))document.documentElement.setAttribute(${JSON.stringify(ATRIBUTO_RESPONDIDO)},"")}catch(e){}` }} />
    <div role="dialog" aria-label="Aviso de cookies" className="aviso-cookies">
      {plataforma ? (
        // O site da plataforma não tem carrinho nem `/politicas`: a política é a
        // da Avila Ops, que é quem trata o dado de quem visita esta página.
        <p>
          Usamos cookies para manter sua sessão e, com sua permissão, medir a audiência deste site.
          Você escolhe.{" "}
          <a href="https://avilaops.com/politica-de-privacidade/">Como tratamos seus dados</a>.
        </p>
      ) : (
        <p>
          Usamos cookies para lembrar seu carrinho e, com sua permissão, medir a audiência e a
          eficiência dos nossos anúncios. Você escolhe.{" "}
          <Link href="/politicas/privacidade">Como tratamos seus dados</Link>.
        </p>
      )}
      <div className="aviso-cookies-acoes">
        <button type="button" className="btn-secundario" onClick={() => salvarConsentimento("essencial")}>
          Só o necessário
        </button>
        <button type="button" className="btn-primario" onClick={() => salvarConsentimento("aceito")}>
          Aceitar
        </button>
      </div>
    </div>
    </>
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
