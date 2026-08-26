"use client";

import { useEffect, useState } from "react";
import { Campo, Secao, inputClasse } from "./campos";

interface Situacao {
  base: string;
  paginas: number;
  indexadoEm: string | null;
  chaveIndexNow: string;
  verificacaoGoogle: string | null;
  verificacaoBing: string | null;
  recursos: Record<string, string>;
}

const NOMES: Record<string, string> = {
  sitemap: "Sitemap (Google, Bing, todos)",
  robots: "Robots",
  feedMerchant: "Feed do Google Shopping",
  llms: "Guia para assistentes de IA (llms.txt)",
  chave: "Chave IndexNow",
};

/**
 * Aba "Buscadores": mostra que a loja já nasce indexável e dá o que o lojista
 * precisa colar no Search Console / Bing Webmaster. Nada aqui é obrigatório —
 * a indexação automática já roda sozinha.
 */
export default function Buscadores({ chamar, ocupado }: { chamar: (c: string, m: string, b?: unknown, s?: string) => Promise<unknown>; ocupado: boolean }) {
  const [s, setS] = useState<Situacao | null>(null);
  const [google, setGoogle] = useState("");
  const [bing, setBing] = useState("");

  useEffect(() => {
    fetch("/api/painel/buscadores").then((r) => r.json()).then((d) => {
      if (d?.erro) return;
      setS(d);
      setGoogle(d.verificacaoGoogle ?? "");
      setBing(d.verificacaoBing ?? "");
    }).catch(() => undefined);
  }, []);

  if (!s) return <Secao titulo="Buscadores"><p className="text-sm text-muted-foreground">Carregando…</p></Secao>;

  return (
    <>
      <Secao titulo="Sua loja é avisada aos buscadores automaticamente" descricao="A cada produto criado ou alterado, avisamos Bing, Yandex e o sitemap. O Google encontra pelo sitemap e pelos dados estruturados de cada página.">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{s.paginas} páginas publicadas</span>
          <span className="text-muted-foreground">{s.indexadoEm ? `Último aviso: ${new Date(s.indexadoEm).toLocaleString("pt-BR")}` : "Aviso automático a cada mudança no catálogo"}</span>
          <button className="btn-secundario ml-auto h-9 px-3 text-xs" disabled={ocupado} onClick={() => chamar("/api/painel/buscadores", "POST", undefined, "Buscadores avisados.")}>Avisar buscadores agora</button>
        </div>
        <ul className="grid gap-1 text-sm">
          {Object.entries(s.recursos).map(([chave, url]) => (
            <li key={chave} className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground">{NOMES[chave] ?? chave}:</span>
              <a href={url} target="_blank" rel="noopener" className="underline">{url.replace(s.base, "")}</a>
            </li>
          ))}
        </ul>
      </Secao>

      <Secao titulo="Conectar ao Google e ao Bing (opcional)" descricao="Serve para você ver os relatórios de busca. Cole o código que o painel do buscador pedir — aceitamos a tag inteira.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Google Search Console" ajuda="Verificação por tag HTML."><input className={inputClasse} value={google} onChange={(e) => setGoogle(e.target.value)} placeholder='<meta name="google-site-verification" content="…">' /></Campo>
          <Campo label="Bing Webmaster Tools" ajuda="Verificação por tag HTML."><input className={inputClasse} value={bing} onChange={(e) => setBing(e.target.value)} placeholder='<meta name="msvalidate.01" content="…">' /></Campo>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primario" disabled={ocupado} onClick={() => chamar("/api/painel/buscadores", "PATCH", { verificacaoGoogle: google || null, verificacaoBing: bing || null }, "Códigos salvos.")}>Salvar códigos</button>
          <a className="btn-secundario" href="https://search.google.com/search-console/welcome" target="_blank" rel="noopener">Abrir Search Console</a>
          <a className="btn-secundario" href="https://www.bing.com/webmasters" target="_blank" rel="noopener">Abrir Bing Webmaster</a>
        </div>
        <p className="text-xs text-muted-foreground">Depois de verificar, envie o sitemap <code>{s.recursos.sitemap}</code> no painel do buscador — é o passo que acelera a primeira indexação.</p>
      </Secao>
    </>
  );
}
