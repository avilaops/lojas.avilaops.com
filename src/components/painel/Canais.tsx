"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Check, ExternalLink, Info, Link2, ListChecks, RefreshCw, Send, Tags, Unlink } from "lucide-react";
import { Campo, Secao, inputClasse } from "./campos";
import CategoriaMl from "./CategoriaMl";
import {
  CANAIS,
  acrescimoQueCobreComissao,
  estoqueDoCanal,
  fichaDoCanal,
  precoDoCanal,
  type RegrasDoCanal,
} from "@/lib/canais";
import type { PendenciasDoCatalogo } from "@/lib/mercadolivre-preparo";

export type CanalMl = {
  conectado: boolean;
  nickname: string | null;
  userId: string | null;
  conectadoEm: string | null;
  expiraEm: string | null;
  /** Anúncios por estado, para o lojista saber o que está de pé. */
  anuncios: { aprovado: number; publicado: number; rascunho: number; recusado: number; pausado: number };
};

export type CandidatoMl = {
  produtoId: string;
  nome: string;
  preco: string;
  precoCentavos: number;
  estoque: number;
  imagem: string | null;
};

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

const brl = (centavos: number) => (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** O que o retorno do Mercado Livre diz, na língua do lojista. */
const RETORNO: Record<string, { tom: "ok" | "erro"; texto: string }> = {
  conectado: { tom: "ok", texto: "Conta do Mercado Livre conectada." },
  recusado: { tom: "erro", texto: "Você não autorizou a conexão. Nada foi salvo." },
  incompleto: { tom: "erro", texto: "O Mercado Livre não devolveu os dados da autorização. Tente de novo." },
  falhou: { tom: "erro", texto: "Não consegui completar a conexão. Tente de novo; se insistir, me chame." },
};

/**
 * Canais de venda do lojista.
 *
 * Existe porque o retorno da autorização do Mercado Livre precisa cair em
 * algum lugar: o `/ml/callback` redireciona para cá com `?ml=<resultado>`, e
 * sem esta tela o lojista autorizava no ML e voltava para um 404.
 *
 * A conta do ML é a mesma do Mercado Pago, mas a autorização é outra: o token
 * de pagamento não carrega permissão de venda. Por isso são dois botões em
 * telas diferentes, e não um só.
 *
 * A tela é a trilha inteira, na ordem em que o lojista a percorre — conectar,
 * definir o preço do canal, preencher o que falta, autorizar, acompanhar —, e
 * não uma lista de botões. Antes ela só mostrava quem já estava PRONTO: quem
 * tinha 180 de 200 produtos travados lia "nenhum produto anunciado ainda" e
 * não tinha como descobrir por quê nem o que digitar.
 */
export default function Canais({ loja, ml, regras, pendencias, candidatos, integracaoDisponivel, retorno }: {
  loja: { slug: string; nome: string };
  ml: CanalMl;
  regras: RegrasDoCanal;
  pendencias: PendenciasDoCatalogo;
  candidatos: CandidatoMl[];
  /** `false` quando a plataforma não tem o aplicativo do ML configurado. */
  integracaoDisponivel: boolean;
  retorno?: string;
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const aviso = retorno ? RETORNO[retorno] : undefined;

  async function chamar(chave: string, url: string, init: RequestInit, aoTerminar?: (dados: Record<string, unknown>) => void) {
    setErro(null);
    setRecado(null);
    setOcupado(chave);
    try {
      const r = await fetch(url, init);
      const dados = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      if (!r.ok) throw new Error(typeof dados.erro === "string" ? dados.erro : "Falha.");
      aoTerminar?.(dados);
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha inesperada.");
    } finally {
      setOcupado(null);
    }
  }

  const desconectar = () => {
    if (!confirm("Desconectar o Mercado Livre? Os anúncios continuam lá, mas a loja para de sincronizar preço e estoque.")) return;
    void chamar("desconectar", "/api/painel/canais/mercadolivre", { method: "DELETE" });
  };

  const aprovar = () => {
    if (selecionados.length === 0) return;
    void chamar(
      "aprovar",
      "/api/painel/canais/mercadolivre/anuncios",
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ produtoIds: selecionados }) },
      () => setSelecionados([]),
    );
  };

  const conferir = () =>
    void chamar(
      "preparo",
      "/api/painel/canais/mercadolivre/preparo",
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ limite: 40, somenteSemAnuncio: pendencias.semPreparo > 0 }) },
      (d) =>
        setRecado(
          `Conferi ${d.total ?? 0} produto(s): ${d.pronto ?? 0} pronto(s), ${d.revisao ?? 0} em revisão, ${d.bloqueado ?? 0} bloqueado(s).`,
        ),
    );

  const noAr = ml.anuncios.publicado + ml.anuncios.pausado;
  const bloqueia = pendencias.pendencias.filter((p) => p.gravidade === "bloqueia");

  return (
    <>
      {aviso && (
        <p className={`rounded-lg p-3 text-sm ${aviso.tom === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
          {aviso.texto}
        </p>
      )}
      {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
      {recado && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{recado}</p>}

      <Trilha
        conectado={ml.conectado}
        definiuPreco={regras.acrescimoPercentual > 0}
        travados={bloqueia.reduce((s, p) => s + p.total, 0)}
        prontos={pendencias.pronto}
        noAr={noAr}
      />

      <Secao
        titulo="Mercado Livre"
        descricao="Anuncie o mesmo catálogo da sua loja no Mercado Livre, com preço e estoque sincronizados. É a mesma conta do Mercado Pago, mas precisa de uma autorização própria para vender."
      >
        {ml.conectado ? (
          <>
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
              <Check size={18} className="flex-none text-emerald-600" />
              <span className="flex-1 text-sm">
                <b className="block">{ml.nickname ?? "Conta conectada"}</b>
                <span className="text-xs text-muted-foreground">
                  {ml.userId && `código ${ml.userId}`}
                  {ml.conectadoEm && ` · conectada em ${dataHora(ml.conectadoEm)}`}
                </span>
              </span>
              <button className="btn-secundario inline-flex h-9 items-center gap-1.5 px-3 text-xs" disabled={Boolean(ocupado)} onClick={desconectar}>
                <Unlink size={14} /> Desconectar
              </button>
            </div>

            {noAr + ml.anuncios.aprovado + ml.anuncios.rascunho + ml.anuncios.recusado === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum produto anunciado ainda. O próximo passo é definir o preço do canal e resolver o que falta no cadastro.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-5">
                {([
                  ["Na fila", ml.anuncios.aprovado],
                  ["Publicados", ml.anuncios.publicado],
                  ["Rascunhos", ml.anuncios.rascunho],
                  ["Recusados", ml.anuncios.recusado],
                  ["Pausados", ml.anuncios.pausado],
                ] as const).map(([rotulo, n]) => (
                  <div key={rotulo} className="rounded-lg border border-border p-3">
                    <small className="text-xs uppercase text-muted-foreground">{rotulo}</small>
                    <strong className="block text-xl">{n}</strong>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Ao conectar, você autoriza a loja a criar e atualizar anúncios em seu nome. O dinheiro continua caindo na sua
              conta e o anúncio continua sendo seu: se desconectar, ele permanece no ar, só para de sincronizar.
            </p>
            {integracaoDisponivel ? (
              <div>
                <a className="btn-primario inline-flex items-center gap-2" href={`/api/painel/canais/mercadolivre?loja=${loja.slug}`}>
                  <Link2 size={15} /> Conectar Mercado Livre
                </a>
              </div>
            ) : (
              // Sem o aplicativo do ML configurado na plataforma, o botão levaria
              // a uma tela de erro do próprio Mercado Livre, que não explica nada
              // ao lojista e parece defeito da loja dele.
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                A conexão com o Mercado Livre ainda não está liberada nesta instalação da plataforma. Fale com a Avila Ops:
                nada que você preencher abaixo se perde, e vale para quando ela abrir.
              </p>
            )}
          </>
        )}
      </Secao>

      <RegrasDoCanalForm regras={regras} ocupado={ocupado === "regras"} aoSalvar={(novas) =>
        void chamar("regras", "/api/painel/canais/mercadolivre/regras", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(novas),
        }, () => setRecado("Regras salvas. O próximo ciclo ajusta os anúncios que já estão no ar."))
      } />

      <Pendencias
        dados={pendencias}
        ocupado={ocupado === "preparo"}
        aoConferir={conferir}
        aoMudarCategoria={() => router.refresh()}
      />

      {candidatos.length > 0 && (
        <Secao
          titulo={`Prontos para anunciar (${candidatos.length})`}
          descricao="Selecione o que você autoriza publicar. Nada sobe sem esta autorização — nem produto que passou em tudo."
        >
          <div className="grid max-h-96 gap-1 overflow-auto">
            {candidatos.map((produto) => {
              const marcado = selecionados.includes(produto.produtoId);
              const noCanal = precoDoCanal(produto.precoCentavos, regras);
              return (
                <label key={produto.produtoId} className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-2.5 hover:bg-muted/40">
                  <input
                    type="checkbox"
                    checked={marcado}
                    onChange={() => setSelecionados((atuais) => marcado ? atuais.filter((id) => id !== produto.produtoId) : [...atuais, produto.produtoId])}
                  />
                  {produto.imagem ? <img src={produto.imagem} alt="" className="h-10 w-10 rounded-md object-cover" /> : <span className="h-10 w-10 rounded-md bg-muted" />}
                  <span className="min-w-0 flex-1 text-sm">
                    <b className="block truncate">{produto.nome}</b>
                    <span className="text-xs text-muted-foreground">
                      {produto.preco} na loja
                      {noCanal !== produto.precoCentavos && ` · ${brl(noCanal)} no canal`}
                      {" · "}
                      {estoqueDoCanal(produto.estoque, regras)} un. para o canal
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn-primario inline-flex items-center gap-2" disabled={Boolean(ocupado) || selecionados.length === 0} onClick={aprovar}>
              {ocupado === "aprovar" ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />}
              Autorizar {selecionados.length || ""} a publicar
            </button>
            <button
              type="button"
              className="text-xs text-muted-foreground underline"
              onClick={() => setSelecionados(selecionados.length === candidatos.length ? [] : candidatos.map((c) => c.produtoId))}
            >
              {selecionados.length === candidatos.length ? "limpar seleção" : "selecionar todos"}
            </button>
          </div>
        </Secao>
      )}

      <OutrosCanais />
    </>
  );
}

/** Onde o lojista está na trilha, e qual é o próximo passo. */
function Trilha({ conectado, definiuPreco, travados, prontos, noAr }: {
  conectado: boolean;
  definiuPreco: boolean;
  travados: number;
  prontos: number;
  noAr: number;
}) {
  const passos = [
    { titulo: "Conectar a conta", feito: conectado, agora: !conectado },
    { titulo: "Definir o preço do canal", feito: definiuPreco, agora: conectado && !definiuPreco },
    { titulo: "Preencher o que falta", feito: travados === 0, agora: conectado && definiuPreco && travados > 0, nota: travados > 0 ? `${travados} parado(s)` : undefined },
    { titulo: "Autorizar e publicar", feito: noAr > 0, agora: conectado && definiuPreco && travados === 0 && prontos > 0, nota: noAr > 0 ? `${noAr} no ar` : undefined },
  ];
  return (
    <ol className="grid gap-2 rounded-2xl border border-border bg-card p-4 sm:grid-cols-4 sm:gap-3 sm:p-6">
      {passos.map((p, i) => (
        <li key={p.titulo} className={`flex items-start gap-2 rounded-lg p-2 text-sm ${p.agora ? "bg-muted/60" : ""}`}>
          <span
            aria-hidden="true"
            className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full text-[11px] font-semibold ${
              p.feito ? "bg-emerald-600 text-white" : p.agora ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
            }`}
          >
            {p.feito ? "✓" : i + 1}
          </span>
          <span className="min-w-0">
            <b className={`block font-medium ${p.feito ? "text-muted-foreground" : ""}`}>{p.titulo}</b>
            {p.nota && <small className="text-xs text-muted-foreground">{p.nota}</small>}
          </span>
        </li>
      ))}
    </ol>
  );
}

const ARREDONDAMENTOS = [
  { valor: "nenhum", rotulo: "Não arredondar" },
  { valor: "noventa", rotulo: "Terminar em ,90" },
  { valor: "inteiro", rotulo: "Real inteiro" },
] as const;

const GARANTIAS = [
  { valor: "sem", rotulo: "Não informar" },
  { valor: "vendedor", rotulo: "Garantia do vendedor" },
  { valor: "fabrica", rotulo: "Garantia de fábrica" },
] as const;

/**
 * As decisões comerciais do canal.
 *
 * O acréscimo é o primeiro campo porque é o mais caro de errar: o Mercado Livre
 * cobra de 11% a 19% sobre a venda, e a integração nascia mandando o preço da
 * loja sem acréscimo nenhum — quem não mexesse aqui estaria pagando para vender
 * e só descobriria no extrato. A tela faz a conta e mostra o que sobra.
 */
function RegrasDoCanalForm({ regras, ocupado, aoSalvar }: {
  regras: RegrasDoCanal;
  ocupado: boolean;
  aoSalvar: (r: RegrasDoCanal) => void;
}) {
  const [f, setF] = useState<RegrasDoCanal>(regras);
  const ficha = fichaDoCanal("mercadolivre")!;
  const set = <K extends keyof RegrasDoCanal>(k: K, v: RegrasDoCanal[K]) => setF((a) => ({ ...a, [k]: v }));

  const sugerido = useMemo(() => acrescimoQueCobreComissao((ficha.comissaoTipica.de + ficha.comissaoTipica.ate) / 2), [ficha]);
  // Cem reais é a régua: qualquer lojista lê a conta de cabeça e confere.
  const exemplo = precoDoCanal(10_000, f);
  const comissaoMedia = (ficha.comissaoTipica.de + ficha.comissaoTipica.ate) / 200;
  const liquido = Math.round(exemplo * (1 - comissaoMedia));

  return (
    <Secao
      titulo="Regras de venda no canal"
      descricao="Valem para todo produto que subir daqui. Mudar aqui não republica nada na hora: o ciclo seguinte encontra a diferença e corrige."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          label="Acréscimo sobre o preço da loja"
          ajuda={`O Mercado Livre cobra de ${ficha.comissaoTipica.de}% a ${ficha.comissaoTipica.ate}% sobre a venda. Para não tirar da sua margem, o acréscimo precisa ser maior que a comissão — ela incide sobre o preço já acrescido.`}
          acao={
            <button type="button" className="text-xs underline" onClick={() => set("acrescimoPercentual", sugerido)}>
              usar {sugerido.toLocaleString("pt-BR")}%
            </button>
          }
        >
          <input
            id="canal-acrescimo"
            className={inputClasse}
            type="number"
            min={0}
            max={300}
            step={0.1}
            inputMode="decimal"
            value={f.acrescimoPercentual}
            onChange={(e) => set("acrescimoPercentual", Number(e.target.value))}
          />
        </Campo>

        <Campo label="Arredondamento" ajuda="Sempre para cima: arredondar para baixo venderia abaixo do que você definiu.">
          <select id="canal-arredondamento" className={inputClasse} value={f.arredondamento} onChange={(e) => set("arredondamento", e.target.value as RegrasDoCanal["arredondamento"])}>
            {ARREDONDAMENTOS.map((a) => <option key={a.valor} value={a.valor}>{a.rotulo}</option>)}
          </select>
        </Campo>
      </div>

      <p className="flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-sm">
        <Info size={15} className="mt-0.5 flex-none text-muted-foreground" />
        <span>
          Um produto de <b>{brl(10_000)}</b> na sua loja é anunciado por <b>{brl(exemplo)}</b>. Descontada uma comissão de{" "}
          {(comissaoMedia * 100).toLocaleString("pt-BR")}%, sobram cerca de <b>{brl(liquido)}</b>
          {liquido < 10_000 && <> — <b className="text-amber-700">menos do que você recebe vendendo na sua loja</b></>}.
          {" "}Frete grátis e cupom do canal, quando você aderir, saem depois disso.
        </span>
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        <Campo label="Estoque reservado para a loja" ajuda="Unidades que nunca vão para o canal. Com 1, a última peça não é vendida duas vezes enquanto o estoque sincroniza.">
          <input id="canal-reservado" className={inputClasse} type="number" min={0} max={9999} value={f.estoqueReservado} onChange={(e) => set("estoqueReservado", Number(e.target.value))} />
        </Campo>
        <Campo label="Máximo por anúncio" ajuda="Teto de unidades anunciadas. Zero = sem teto.">
          <input id="canal-maximo" className={inputClasse} type="number" min={0} max={99999} value={f.estoqueMaximo} onChange={(e) => set("estoqueMaximo", Number(e.target.value))} />
        </Campo>
        <Campo label="Preço mínimo para anunciar" ajuda="Em reais. Produto abaixo disso não sobe: a comissão come a margem inteira. Zero desliga.">
          <input
            id="canal-minimo"
            className={inputClasse}
            type="number"
            min={0}
            step={0.01}
            inputMode="decimal"
            value={f.precoMinimoCentavos ? f.precoMinimoCentavos / 100 : 0}
            onChange={(e) => set("precoMinimoCentavos", Math.round(Number(e.target.value) * 100))}
          />
        </Campo>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Campo label="Tipo de anúncio" ajuda="Premium aparece mais e parcela sem juros para o comprador, e custa mais comissão. Clássico é o padrão.">
          <select id="canal-tipo" className={inputClasse} value={f.tipoAnuncio} onChange={(e) => set("tipoAnuncio", e.target.value as RegrasDoCanal["tipoAnuncio"])}>
            <option value="classico">Clássico</option>
            <option value="premium">Premium</option>
          </select>
        </Campo>
        <Campo label="Condição" ajuda="Vale para todo o catálogo que subir daqui.">
          <select id="canal-condicao" className={inputClasse} value={f.condicao} onChange={(e) => set("condicao", e.target.value as RegrasDoCanal["condicao"])}>
            <option value="novo">Novo</option>
            <option value="usado">Usado</option>
          </select>
        </Campo>
        <Campo label="Garantia" ajuda="O Mercado Livre recusa o anúncio sem garantia em boa parte das categorias.">
          <div className="flex gap-2">
            <select id="canal-garantia" className={inputClasse} value={f.garantia} onChange={(e) => set("garantia", e.target.value as RegrasDoCanal["garantia"])}>
              {GARANTIAS.map((g) => <option key={g.valor} value={g.valor}>{g.rotulo}</option>)}
            </select>
            {f.garantia !== "sem" && (
              <input
                aria-label="Meses de garantia"
                className={`${inputClasse} w-24`}
                type="number"
                min={1}
                max={120}
                value={f.garantiaMeses}
                onChange={(e) => set("garantiaMeses", Number(e.target.value))}
              />
            )}
          </div>
        </Campo>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={f.ativo} onChange={(e) => set("ativo", e.target.checked)} />
        <span>
          Publicar novos produtos neste canal
          <small className="block text-xs text-muted-foreground">
            Desligado, nada novo sobe. O que já está no ar continua com preço e estoque sincronizados — parar isso venderia peça que acabou.
          </small>
        </span>
      </label>

      <div>
        <button className="btn-primario inline-flex items-center gap-2" disabled={ocupado} onClick={() => aoSalvar(f)}>
          {ocupado && <RefreshCw size={15} className="animate-spin" />} Salvar regras
        </button>
      </div>
    </Secao>
  );
}

/**
 * O que trava o catálogo, agrupado pelo que falta digitar.
 *
 * É a tela que faltava: o painel só mostrava quem já estava pronto, e o que
 * estava parado não aparecia em lugar nenhum. Agrupado pelo motivo, porque
 * "informe a marca" em trezentos produtos é uma tarefa, não trezentas.
 */
function Pendencias({ dados, ocupado, aoConferir, aoMudarCategoria }: {
  dados: PendenciasDoCatalogo;
  ocupado: boolean;
  aoConferir: () => void;
  aoMudarCategoria: () => void;
}) {
  const [aberta, setAberta] = useState<string | null>(null);
  /** Produto cuja categoria está sendo escolhida na gaveta. */
  const [escolhendo, setEscolhendo] = useState<string | null>(null);
  const conferidos = dados.pronto + dados.revisao + dados.bloqueado;

  return (
    <Secao
      titulo="O que falta para o catálogo subir"
      descricao="Conferimos cada produto contra as exigências da categoria no Mercado Livre. Nada é chutado: marca, código de barras e modelo ou estão no cadastro, ou o produto não sobe."
    >
      <div className="grid gap-3 sm:grid-cols-4">
        {([
          ["Prontos", dados.pronto],
          ["Em revisão", dados.revisao],
          ["Bloqueados", dados.bloqueado],
          ["Ainda não conferidos", dados.semPreparo],
        ] as const).map(([rotulo, n]) => (
          <div key={rotulo} className="rounded-lg border border-border p-3">
            <small className="text-xs uppercase text-muted-foreground">{rotulo}</small>
            <strong className="block text-xl">{n}</strong>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-secundario inline-flex h-10 items-center gap-2 px-4 text-sm" disabled={ocupado} onClick={aoConferir}>
          {ocupado ? <RefreshCw size={15} className="animate-spin" /> : <ListChecks size={15} />}
          Conferir catálogo agora
        </button>
        <small className="text-xs text-muted-foreground">
          Até 40 produtos por vez, e não precisa da conta conectada — a consulta de categoria é pública.
        </small>
      </div>

      {conferidos === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum produto conferido ainda. Comece por aqui: dá para arrumar o catálogo inteiro antes de autorizar qualquer anúncio.
        </p>
      ) : dados.pendencias.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-emerald-700">
          <Check size={15} /> Nada parado. Todo produto conferido passou nas exigências da categoria dele.
        </p>
      ) : (
        <ul className="grid gap-2">
          {dados.pendencias.map((p) => (
            <li key={p.chave} className="rounded-lg border border-border">
              <button
                type="button"
                className="flex w-full items-center gap-3 p-3 text-left"
                onClick={() => setAberta(aberta === p.chave ? null : p.chave)}
                aria-expanded={aberta === p.chave}
              >
                <AlertTriangle size={15} className={`flex-none ${p.gravidade === "bloqueia" ? "text-red-600" : "text-amber-500"}`} />
                <span className="min-w-0 flex-1 text-sm">
                  <b className="block">{p.titulo}</b>
                  <span className="text-xs text-muted-foreground">{p.comoResolver}</span>
                </span>
                <span className="flex-none text-right text-xs">
                  <b className="block text-base">{p.total}</b>
                  <span className="text-muted-foreground">{p.gravidade === "bloqueia" ? "não sobem" : "sobem piores"}</span>
                </span>
              </button>
              {aberta === p.chave && (
                <ul className="grid gap-1 border-t border-border p-3">
                  {p.exemplos.map((e) => (
                    <li key={e.produtoId}>
                      {/* Pendência de categoria se resolve aqui mesmo: mandar o
                          lojista para o cadastro do produto não resolveria, porque
                          categoria do Mercado Livre não é campo do produto dele. */}
                      {p.onde === "categoria" ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 text-sm underline"
                          onClick={() => setEscolhendo(e.produtoId)}
                        >
                          {e.nome} <Tags size={12} />
                        </button>
                      ) : (
                        <Link href={`/painel/produtos/${e.produtoId}`} className="inline-flex items-center gap-1.5 text-sm underline">
                          {e.nome} <ArrowRight size={12} />
                        </Link>
                      )}
                    </li>
                  ))}
                  {p.total > p.exemplos.length && (
                    <li className="text-xs text-muted-foreground">e mais {p.total - p.exemplos.length} produto(s) com a mesma pendência.</li>
                  )}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      {escolhendo && (
        <CategoriaMl
          produtoId={escolhendo}
          aoFechar={() => setEscolhendo(null)}
          aoSalvar={aoMudarCategoria}
        />
      )}
    </Secao>
  );
}

/**
 * Os outros marketplaces.
 *
 * Fica escrito o que cada um vai exigir do lojista, porque boa parte disso é
 * trabalho de catálogo que ele já pode adiantar hoje — GTIN, peso e dimensão
 * servem aos quatro. Nenhum botão de conectar: botão que não conecta é promessa
 * quebrada na primeira tentativa.
 */
function OutrosCanais() {
  const [aberto, setAberto] = useState<string | null>(null);
  return (
    <Secao titulo="Outros canais" descricao="Na ordem em que aparecerem clientes pedindo. O que cada um vai exigir já está escrito: quase tudo é cadastro que dá para adiantar.">
      <ul className="grid gap-2">
        {CANAIS.filter((c) => c.estado === "roadmap").map((c) => (
          <li key={c.id} className="rounded-lg border border-border">
            <button type="button" className="flex w-full items-center gap-3 p-3 text-left" onClick={() => setAberto(aberto === c.id ? null : c.id)} aria-expanded={aberto === c.id}>
              <span className="min-w-0 flex-1 text-sm">
                <b className="block">{c.nome}</b>
                <span className="text-xs text-muted-foreground">{c.porQue}</span>
              </span>
              <span className="flex-none text-right text-xs text-muted-foreground">
                comissão {c.comissaoTipica.de}–{c.comissaoTipica.ate}%
                <span className="block">ainda não</span>
              </span>
            </button>
            {aberto === c.id && (
              <ul className="grid list-disc gap-1 border-t border-border p-3 pl-8 text-sm text-muted-foreground">
                {c.exigencias.map((e) => <li key={e}>{e}</li>)}
              </ul>
            )}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        O Google Shopping já funciona sem conectar nada: o feed da sua loja está em{" "}
        <a className="inline-flex items-center gap-1 underline" href="/feed/merchant.xml" target="_blank" rel="noopener">
          /feed/merchant.xml <ExternalLink size={11} />
        </a>
        .
      </p>
    </Secao>
  );
}

export { RefreshCw };
