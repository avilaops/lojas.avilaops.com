"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, RefreshCw } from "lucide-react";
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

/**
 * "Aparecer no Google": o que o lojista precisa saber, e só isso.
 *
 * A tela antiga listava `/robots.txt`, `/llms.txt`, a chave do IndexNow e o
 * feed do Merchant, e pedia que ele colasse uma meta tag. Quem vende vedação
 * não sabe o que é nada disso, e não deveria precisar saber: indexação é
 * trabalho nosso, e a loja já faz sozinha.
 *
 * Ficam à vista duas coisas: **está funcionando** e **quantas páginas**. O
 * resto, que é ferramenta de quem cuida do site, vai para um bloco fechado no
 * fim — não some, porque uma agência contratada pelo lojista vai pedir por ele.
 */
export default function Buscadores({ chamar, ocupado }: { chamar: (c: string, m: string, b?: unknown, s?: string) => Promise<unknown>; ocupado: boolean }) {
  const [s, setS] = useState<Situacao | null>(null);
  const [google, setGoogle] = useState("");
  const [bing, setBing] = useState("");
  const [tecnico, setTecnico] = useState(false);

  useEffect(() => {
    fetch("/api/painel/buscadores").then((r) => r.json()).then((d) => {
      if (d?.erro) return;
      setS(d);
      setGoogle(d.verificacaoGoogle ?? "");
      setBing(d.verificacaoBing ?? "");
    }).catch(() => undefined);
  }, []);

  if (!s) return <Secao titulo="Aparecer no Google"><p className="text-sm text-muted-foreground">Carregando…</p></Secao>;

  const quando = s.indexadoEm
    ? new Date(s.indexadoEm).toLocaleString("pt-BR", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <>
      <Secao
        titulo="Sua loja aparece no Google e no Bing"
        descricao="Cada produto que você cadastra ou altera é avisado aos buscadores automaticamente. Você não precisa fazer nada."
      >
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/30 p-4">
          <Check size={20} className="flex-none text-emerald-600" />
          <span className="flex-1 text-sm">
            <b className="block">{s.paginas.toLocaleString("pt-BR")} páginas da sua loja publicadas</b>
            <span className="text-xs text-muted-foreground">
              {quando ? `Buscadores avisados em ${quando}` : "Avisamos os buscadores a cada mudança no catálogo"}
            </span>
          </span>
          <button
            className="btn-secundario inline-flex h-11 items-center gap-1.5 px-3 text-xs"
            disabled={ocupado}
            onClick={() => chamar("/api/painel/buscadores", "POST", undefined, "Pronto, avisamos os buscadores.")}
            title="Normalmente não é preciso: o aviso é automático."
          >
            <RefreshCw size={13} /> Avisar agora
          </button>
        </div>

        {/* O prazo é a pergunta que todo lojista faz na primeira semana, e a
            resposta honesta evita a impressão de que a loja está quebrada. */}
        <p className="text-sm text-muted-foreground">
          Aparecer na busca leva de alguns dias a algumas semanas: quem decide é o Google, não a loja. Produto novo
          costuma entrar antes que página nova, e quanto mais completo o cadastro (foto, descrição, medida), mais
          rápido.
        </p>
      </Secao>

      {/* Fechado por padrão: é ferramenta de quem cuida do site, e a maioria dos
          lojistas nunca vai precisar abrir. */}
      <details className="rounded-lg border border-border" onToggle={(e) => setTecnico((e.target as HTMLDetailsElement).open)}>
        <summary className="flex cursor-pointer list-none items-center gap-2 p-4 text-sm font-medium">
          <ChevronDown size={16} className={`transition-transform ${tecnico ? "rotate-180" : ""}`} />
          Para quem cuida do seu site
          <span className="ml-auto text-xs font-normal text-muted-foreground">agência, TI ou consultor</span>
        </summary>

        <div className="grid gap-6 border-t border-border p-4">
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">
              Se você contratou alguém para cuidar da sua presença no Google, é isto que essa pessoa vai pedir.
            </p>
            <ul className="grid gap-1 text-sm">
              {Object.entries(s.recursos).map(([chave, url]) => (
                <li key={chave} className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground">{chave}:</span>
                  <a href={url} target="_blank" rel="noopener" className="inline-flex h-11 items-center underline">{url.replace(s.base, "")}</a>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-3">
            <p className="text-sm">
              <b className="block">Ver os relatórios do Google e do Bing</b>
              <span className="text-xs text-muted-foreground">
                Opcional. Serve para acompanhar quantas pessoas encontram a loja pela busca.
              </span>
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Google Search Console" ajuda="Cole o código que o Google pedir, ou a tag inteira.">
                <input className={inputClasse} value={google} onChange={(e) => setGoogle(e.target.value)} placeholder='<meta name="google-site-verification" content="…">' />
              </Campo>
              <Campo label="Bing Webmaster Tools" ajuda="Cole o código que o Bing pedir, ou a tag inteira.">
                <input className={inputClasse} value={bing} onChange={(e) => setBing(e.target.value)} placeholder='<meta name="msvalidate.01" content="…">' />
              </Campo>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-primario" disabled={ocupado} onClick={() => chamar("/api/painel/buscadores", "PATCH", { verificacaoGoogle: google || null, verificacaoBing: bing || null }, "Códigos salvos.")}>
                Salvar códigos
              </button>
              <a className="btn-secundario" href="https://search.google.com/search-console/welcome" target="_blank" rel="noopener">Abrir Search Console</a>
              <a className="btn-secundario" href="https://www.bing.com/webmasters" target="_blank" rel="noopener">Abrir Bing Webmaster</a>
            </div>
          </div>
        </div>
      </details>
    </>
  );
}
