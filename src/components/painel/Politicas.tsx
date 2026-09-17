"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Campo, Secao, inputClasse } from "./campos";
import {
  AJUDA_POLITICA,
  PRAZO_LEGAL_DIAS,
  ROTULO_POLITICA,
  TIPOS_POLITICA,
  type RegrasDevolucao,
  type TipoPolitica,
} from "@/lib/politicas";

/**
 * Políticas da loja: regras de devolução e os textos que vão ao rodapé.
 *
 * A tela é lista → detalhe → voltar, como o resto de Configurações no celular.
 * O que ela deliberadamente NÃO tem é o estado "nenhuma política definida":
 * loja no ar sem política de devolução é infração, não é uma pendência para o
 * lojista resolver quando puder. Por isso a coluna da direita diz de quem é o
 * texto que está no ar — "modelo" ou "seu texto" —, nunca "vazio".
 */

export interface PoliticaNoPainel {
  tipo: TipoPolitica;
  /** O que está publicado hoje, já resolvido: texto próprio ou modelo. */
  publicado: string;
  /** O modelo da plataforma, para o botão de inserir. Vazio no aviso legal. */
  modelo: string;
  propria: boolean;
}

export default function Politicas({
  politicas,
  regras: regrasIniciais,
  categorias,
}: {
  politicas: PoliticaNoPainel[];
  regras: RegrasDevolucao;
  categorias: Array<{ slug: string; nome: string }>;
}) {
  const [aberta, setAberta] = useState<TipoPolitica | null>(null);
  const [lista, setLista] = useState(politicas);

  const atual = aberta ? lista.find((p) => p.tipo === aberta) : null;
  if (atual) {
    return (
      <Editor
        politica={atual}
        aoVoltar={() => setAberta(null)}
        aoSalvar={(atualizada) => {
          setLista((l) => l.map((p) => (p.tipo === atualizada.tipo ? atualizada : p)));
          setAberta(null);
        }}
      />
    );
  }

  return (
    <div className="grid gap-6">
      <RegrasDevolucaoForm regras={regrasIniciais} categorias={categorias} />

      <Secao
        titulo="Políticas escritas"
        descricao="As políticas aparecem no rodapé da loja e na finalização da compra."
      >
        <ul className="-mx-4 overflow-hidden border-y border-border sm:-mx-6">
          {TIPOS_POLITICA.map((tipo) => {
            const p = lista.find((x) => x.tipo === tipo)!;
            return (
              <li key={tipo} className="border-t border-border first:border-t-0">
                <button
                  type="button"
                  onClick={() => setAberta(tipo)}
                  className="flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left transition active:bg-muted sm:px-6"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{ROTULO_POLITICA[tipo]}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{AJUDA_POLITICA[tipo]}</span>
                  </span>
                  <Estado politica={p} />
                  <ChevronRight size={16} className="flex-none text-muted-foreground" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      </Secao>
    </div>
  );
}

/**
 * O selo à direita. "Modelo da plataforma" é um estado bom, não uma pendência:
 * ele significa que a loja está coberta pelo texto que a plataforma mantém
 * atualizado. Quem precisa de destaque é o único caso sem nada publicado — o
 * aviso legal em branco, que nem link no rodapé tem.
 */
function Estado({ politica }: { politica: PoliticaNoPainel }) {
  if (politica.propria) return <span className="flex-none text-xs font-medium text-foreground">Seu texto</span>;
  if (!politica.publicado) return <span className="flex-none text-xs text-muted-foreground">Não publicado</span>;
  return <span className="flex-none text-xs text-muted-foreground">Modelo da plataforma</span>;
}

function Editor({
  politica,
  aoVoltar,
  aoSalvar,
}: {
  politica: PoliticaNoPainel;
  aoVoltar: () => void;
  aoSalvar: (p: PoliticaNoPainel) => void;
}) {
  const [texto, setTexto] = useState(politica.propria ? politica.publicado : "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(acao: "salvar" | "restaurar") {
    setSalvando(true);
    setErro(null);
    const r = await fetch("/api/painel/politicas", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ acao, tipo: politica.tipo, corpo: texto }),
    });
    const dados = await r.json().catch(() => ({}));
    setSalvando(false);
    if (!r.ok) return setErro(dados.erro ?? "Não deu para salvar agora. Tente de novo.");
    if (acao === "restaurar") {
      setTexto("");
      return aoSalvar({ ...politica, propria: false, publicado: politica.modelo });
    }
    const propria = Boolean(dados.propria);
    aoSalvar({ ...politica, propria, publicado: propria ? texto.trim() : politica.modelo });
  }

  return (
    <div className="grid gap-4">
      <button
        type="button"
        onClick={aoVoltar}
        className="-mt-1 inline-flex h-11 items-center gap-1 self-start pr-3 text-sm text-muted-foreground"
      >
        <ChevronLeft size={16} aria-hidden="true" /> Políticas
      </button>

      <Secao titulo={ROTULO_POLITICA[politica.tipo]} descricao={AJUDA_POLITICA[politica.tipo]}>
        <Campo
          label="Seu texto"
          ajuda="Linha em branco separa parágrafo. O texto é publicado como texto: HTML colado de outro site não vira formatação."
          erro={erro ?? undefined}
          acao={
            politica.modelo ? (
              <button
                type="button"
                onClick={() => setTexto(politica.modelo)}
                className="text-xs font-medium underline underline-offset-2"
              >
                Inserir modelo
              </button>
            ) : undefined
          }
        >
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={16}
            placeholder={
              politica.modelo
                ? "Deixe em branco para publicar o modelo da plataforma."
                : "Esta política só vai ao ar quando você escrever. Sem texto, ela não aparece na loja."
            }
            className={`${inputClasse} h-auto py-3 leading-relaxed`}
          />
        </Campo>

        {!politica.propria && politica.modelo && (
          <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
            Hoje a sua loja publica o <strong className="text-foreground">modelo da plataforma</strong>, preenchido com os
            seus dados. Ele cumpre o Código de Defesa do Consumidor e a LGPD, e é atualizado por nós quando a regra muda.
            Escrever o seu texto aqui substitui esse modelo — e a manutenção passa a ser sua.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={salvando} onClick={() => enviar("salvar")} className="btn-primario h-11 px-5">
            {salvando ? "Salvando…" : "Salvar"}
          </button>
          {politica.propria && (
            <button
              type="button"
              disabled={salvando}
              onClick={() => enviar("restaurar")}
              className="h-11 text-sm text-muted-foreground underline underline-offset-2"
            >
              Voltar ao modelo da plataforma
            </button>
          )}
        </div>
      </Secao>

      {politica.modelo && (
        <Secao titulo="O que está no ar hoje" descricao="É isto que o seu cliente lê ao abrir esta política na loja.">
          <div className="grid gap-3 text-sm leading-relaxed text-muted-foreground">
            {(politica.propria ? politica.publicado : politica.modelo).split(/\n{2,}/).map((p, i) => (
              <p key={i} className="whitespace-pre-line">{p}</p>
            ))}
          </div>
        </Secao>
      )}
    </div>
  );
}

function RegrasDevolucaoForm({
  regras: iniciais,
  categorias,
}: {
  regras: RegrasDevolucao;
  categorias: Array<{ slug: string; nome: string }>;
}) {
  const [regras, setRegras] = useState(iniciais);
  const [estado, setEstado] = useState<"parado" | "salvando" | "salvo">("parado");
  const muda = <K extends keyof RegrasDevolucao>(campo: K, valor: RegrasDevolucao[K]) => {
    setRegras((r) => ({ ...r, [campo]: valor }));
    setEstado("parado");
  };

  async function salvar() {
    setEstado("salvando");
    const r = await fetch("/api/painel/politicas", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ acao: "regras", regras }),
    });
    const dados = await r.json().catch(() => ({}));
    // A API devolve as regras já corrigidas: é assim que a tela mostra o piso
    // legal em vez de fingir que aceitou um prazo de 3 dias.
    if (r.ok && dados.regras) setRegras(dados.regras);
    setEstado(r.ok ? "salvo" : "parado");
  }

  const temCortesia = regras.prazoDias > PRAZO_LEGAL_DIAS;

  return (
    <Secao
      titulo="Regras de devolução e cancelamento"
      descricao="Definem condições e prazos, e entram sozinhas no texto da política de devolução."
    >
      <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
        Os <strong className="text-foreground">{PRAZO_LEGAL_DIAS} primeiros dias</strong> são direito do consumidor (art. 49 do
        Código de Defesa do Consumidor): devolução sem justificativa, estorno integral e frete de retorno por conta da loja.
        Isso não é configurável, e nenhuma regra abaixo alcança esse período. O que você define aqui é a
        <strong className="text-foreground"> cortesia</strong> que a sua loja oferece depois dele.
      </div>

      <Campo
        label="Prazo total de devolução"
        ajuda={temCortesia
          ? `Do 1º ao ${PRAZO_LEGAL_DIAS}º dia vale a lei; do 8º ao ${regras.prazoDias}º valem as condições abaixo.`
          : "No mínimo legal. Aumente para oferecer uma janela de cortesia depois dos 7 dias."}
      >
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={PRAZO_LEGAL_DIAS}
            max={365}
            value={regras.prazoDias}
            onChange={(e) => muda("prazoDias", Number(e.target.value))}
            className={`${inputClasse} max-w-28`}
          />
          <span className="text-sm text-muted-foreground">dias corridos após o recebimento</span>
        </div>
      </Campo>

      {temCortesia && (
        <>
          <Campo label="Frete de retorno na cortesia" ajuda="Na janela legal o frete é sempre da loja.">
            <select
              value={regras.freteRetornoCortesia}
              onChange={(e) => muda("freteRetornoCortesia", e.target.value as RegrasDevolucao["freteRetornoCortesia"])}
              className={inputClasse}
            >
              <option value="cliente">Por conta do cliente</option>
              <option value="loja">Por conta da loja</option>
            </select>
          </Campo>

          <Campo
            label="Taxa de reposição na cortesia"
            ajuda="Percentual descontado do valor do item. Zero desliga. Não se aplica a defeito nem à janela legal."
          >
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={50}
                value={regras.taxaReposicaoPct}
                onChange={(e) => muda("taxaReposicaoPct", Number(e.target.value))}
                className={`${inputClasse} max-w-28`}
              />
              <span className="text-sm text-muted-foreground">% do valor do item</span>
            </div>
          </Campo>
        </>
      )}

      <Campo
        label="Cancelamento de pedido não separado"
        ajuda="Janela em que o cliente cancela sozinho, com estorno integral. Zero desliga a promessa."
      >
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={720}
            value={regras.cancelamentoHoras}
            onChange={(e) => muda("cancelamentoHoras", Number(e.target.value))}
            className={`${inputClasse} max-w-28`}
          />
          <span className="text-sm text-muted-foreground">horas após a compra</span>
        </div>
      </Campo>

      <Campo
        label="Categorias em venda final"
        ajuda="Sem cortesia depois dos 7 dias. O direito de arrependimento continua valendo em qualquer categoria."
      >
        {categorias.length === 0 ? (
          <p className="text-sm text-muted-foreground">Cadastre categorias no catálogo para marcar venda final.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {categorias.map((c) => {
              const marcada = regras.categoriasVendaFinal.includes(c.slug);
              return (
                <label key={c.slug} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={marcada}
                    onChange={() =>
                      muda(
                        "categoriasVendaFinal",
                        marcada
                          ? regras.categoriasVendaFinal.filter((s) => s !== c.slug)
                          : [...regras.categoriasVendaFinal, c.slug],
                      )
                    }
                  />
                  <span className="min-w-0 truncate">{c.nome}</span>
                </label>
              );
            })}
          </div>
        )}
      </Campo>

      <div className="flex items-center gap-3">
        <button type="button" disabled={estado === "salvando"} onClick={salvar} className="btn-primario h-11 px-5">
          {estado === "salvando" ? "Salvando…" : "Salvar regras"}
        </button>
        {estado === "salvo" && <span className="text-sm text-muted-foreground">Salvo. A política de devolução já reflete isto.</span>}
      </div>
    </Secao>
  );
}
