"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Campo, FONTES, Secao, inputClasse, lerCsvProdutos } from "./campos";

/**
 * Wizard de criação da loja em 4 passos. Tudo que o cliente responde vira
 * coluna do tenant; nada vira código. No fim, cria a senha e já entra no painel.
 */
const PASSOS = ["Sua loja", "Visual", "Endereço e entrega", "Produtos e acesso"] as const;

export default function CriarLoja({ planoInicial }: { planoInicial: "SITE" | "LOJA" | "LOJA_PRO" }) {
  const router = useRouter();
  const [passo, setPasso] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const [f, setF] = useState({
    nome: "",
    slogan: "",
    whatsapp: "",
    instagram: "",
    emailContato: "",
    plano: planoInicial,
    corPrimaria: "#2563eb",
    modo: "claro" as "claro" | "escuro",
    fonte: "sistema" as (typeof FONTES)[number]["valor"],
    raio: "suave" as "reto" | "suave" | "redondo",
    logoUrl: "",
    cep: "",
    logradouro: "",
    numero: "",
    bairro: "",
    cidade: "",
    uf: "",
    horario: "",
    retiradaNaLoja: true,
    despachoDiasUteis: 1,
    dominioPrincipal: "",
    senha: "",
    senha2: "",
  });
  const [csv, setCsv] = useState<{ nome: string; produtos: Array<Record<string, unknown>>; erros: string[] } | null>(null);
  const set = (k: keyof typeof f, v: unknown) => setF((a) => ({ ...a, [k]: v }));

  async function buscarCep(cep: string) {
    const limpo = cep.replace(/\D/g, "");
    if (limpo.length !== 8) return;
    const r = await fetch(`/api/cep?cep=${limpo}`).then((x) => (x.ok ? x.json() : null)).catch(() => null);
    if (r) setF((a) => ({ ...a, logradouro: r.logradouro || a.logradouro, bairro: r.bairro || a.bairro, cidade: r.cidade || a.cidade, uf: r.uf || a.uf }));
  }

  async function criar() {
    setErro(null);
    if (f.senha.length < 8) return setErro("A senha precisa ter pelo menos 8 caracteres.");
    if (f.senha !== f.senha2) return setErro("As senhas não conferem.");
    setOcupado(true);
    try {
      const r = await fetch("/api/painel/criar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nome: f.nome,
          slogan: f.slogan || undefined,
          whatsapp: f.whatsapp || undefined,
          instagram: f.instagram || undefined,
          emailContato: f.emailContato,
          senha: f.senha,
          plano: f.plano,
          logoUrl: f.logoUrl || undefined,
          tema: { corPrimaria: f.corPrimaria, modo: f.modo, fonte: f.fonte, raio: f.raio },
          endereco: { cep: f.cep || undefined, logradouro: f.logradouro || undefined, numero: f.numero || undefined, bairro: f.bairro || undefined, cidade: f.cidade || undefined, uf: f.uf || undefined },
          cepOrigem: f.cep || undefined,
          horario: f.horario || undefined,
          retiradaNaLoja: f.retiradaNaLoja,
          despachoDiasUteis: Number(f.despachoDiasUteis),
          dominioPrincipal: f.dominioPrincipal || undefined,
          produtos: csv?.produtos ?? [],
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.erro ?? "Não foi possível criar a loja.");
      router.push("/painel?nova=1");
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha inesperada.");
    } finally {
      setOcupado(false);
    }
  }

  const podeAvancar = passo === 0 ? f.nome.trim().length >= 2 && /\S+@\S+\.\S+/.test(f.emailContato) : true;

  return (
    <div className="grid gap-6">
      <ol className="flex flex-wrap gap-2 text-xs">
        {PASSOS.map((p, i) => (
          <li key={p} className={`rounded-full px-3 py-1 ${i === passo ? "bg-foreground text-background" : i < passo ? "bg-primary/10 text-primary" : "border border-border text-muted-foreground"}`}>
            {i + 1}. {p}
          </li>
        ))}
      </ol>

      {passo === 0 && (
        <Secao titulo="Sua loja" descricao="O nome vira o endereço provisório: nome-da-loja.lojas.avilaops.com">
          <Campo label="Nome da loja"><input className={inputClasse} value={f.nome} onChange={(e) => set("nome", e.target.value)} /></Campo>
          <Campo label="Slogan" ajuda="Uma frase curta. Aparece no topo e no Google."><input className={inputClasse} value={f.slogan} onChange={(e) => set("slogan", e.target.value)} placeholder="Tudo para o seu carro, com entrega no mesmo dia" /></Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="WhatsApp" ajuda="DDD + número"><input className={inputClasse} value={f.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="16 99999-0000" /></Campo>
            <Campo label="Seu e-mail" ajuda="É o seu login no painel."><input className={inputClasse} type="email" value={f.emailContato} onChange={(e) => set("emailContato", e.target.value)} /></Campo>
          </div>
          <Campo label="Instagram" ajuda="Link completo, opcional"><input className={inputClasse} value={f.instagram} onChange={(e) => set("instagram", e.target.value)} placeholder="https://instagram.com/sualoja" /></Campo>
          <Campo label="Plano">
            <div className="grid gap-2 sm:grid-cols-3">
              {([["SITE", "Site", "R$ 79/mês — vitrine + WhatsApp"], ["LOJA", "Loja", "R$ 119/mês — carrinho, PIX, cartão, boleto, frete"], ["LOJA_PRO", "Loja Pro", "R$ 349/mês — + automações, relatórios, NF-e"]] as const).map(([v, t, d]) => (
                <button key={v} type="button" onClick={() => set("plano", v)} className={`rounded-xl border p-3 text-left text-sm ${f.plano === v ? "border-primary" : "border-border"}`}>
                  <span className="block font-semibold">{t}</span>
                  <span className="text-xs text-muted-foreground">{d}</span>
                </button>
              ))}
            </div>
          </Campo>
        </Secao>
      )}

      {passo === 1 && (
        <Secao titulo="Visual" descricao="Só o que muda entre lojas: cor, fonte, cantos e modo. O layout é o mesmo para todas — é o que mantém o preço.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Cor principal">
              <div className="flex items-center gap-2">
                <input type="color" value={f.corPrimaria} onChange={(e) => set("corPrimaria", e.target.value)} className="h-11 w-14 rounded-lg border border-border" />
                <input className={inputClasse} value={f.corPrimaria} onChange={(e) => set("corPrimaria", e.target.value)} />
              </div>
            </Campo>
            <Campo label="Modo">
              <select className={inputClasse} value={f.modo} onChange={(e) => set("modo", e.target.value)}><option value="claro">Claro</option><option value="escuro">Escuro</option></select>
            </Campo>
            <Campo label="Fonte">
              <select className={inputClasse} value={f.fonte} onChange={(e) => set("fonte", e.target.value)}>{FONTES.map((x) => <option key={x.valor} value={x.valor}>{x.rotulo}</option>)}</select>
            </Campo>
            <Campo label="Cantos">
              <select className={inputClasse} value={f.raio} onChange={(e) => set("raio", e.target.value)}><option value="reto">Retos</option><option value="suave">Suaves</option><option value="redondo">Redondos</option></select>
            </Campo>
          </div>
          <Campo label="Logo (URL)" ajuda="Link de uma imagem PNG/SVG. Sem logo, usamos o nome da loja. Dá para enviar arquivo depois, no painel."><input className={inputClasse} value={f.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} placeholder="https://…/logo.png" /></Campo>
          <div className="rounded-xl border border-border p-4" style={{ background: f.modo === "escuro" ? "#0b0b0c" : "#fff", color: f.modo === "escuro" ? "#fafafa" : "#18181b", borderRadius: f.raio === "reto" ? 0 : f.raio === "redondo" ? 20 : 10 }}>
            <p className="text-sm font-bold">{f.nome || "Sua loja"}</p>
            <button type="button" className="mt-2 px-4 py-2 text-sm font-semibold" style={{ background: f.corPrimaria, color: "#fff", borderRadius: f.raio === "reto" ? 0 : f.raio === "redondo" ? 20 : 8 }}>Adicionar ao carrinho</button>
          </div>
        </Secao>
      )}

      {passo === 2 && (
        <Secao titulo="Endereço e entrega" descricao="O CEP daqui é a origem do cálculo de frete.">
          <div className="grid gap-4 sm:grid-cols-3">
            <Campo label="CEP"><input className={inputClasse} value={f.cep} onChange={(e) => set("cep", e.target.value)} onBlur={(e) => buscarCep(e.target.value)} inputMode="numeric" /></Campo>
            <Campo label="Cidade"><input className={inputClasse} value={f.cidade} onChange={(e) => set("cidade", e.target.value)} /></Campo>
            <Campo label="UF"><input className={inputClasse} value={f.uf} maxLength={2} onChange={(e) => set("uf", e.target.value.toUpperCase())} /></Campo>
          </div>
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
            <Campo label="Rua"><input className={inputClasse} value={f.logradouro} onChange={(e) => set("logradouro", e.target.value)} /></Campo>
            <Campo label="Número"><input className={inputClasse} value={f.numero} onChange={(e) => set("numero", e.target.value)} /></Campo>
            <Campo label="Bairro"><input className={inputClasse} value={f.bairro} onChange={(e) => set("bairro", e.target.value)} /></Campo>
          </div>
          <Campo label="Horário de atendimento"><input className={inputClasse} value={f.horario} onChange={(e) => set("horario", e.target.value)} placeholder="Seg a Sex 8h–18h, Sáb 8h–13h" /></Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.retiradaNaLoja} onChange={(e) => set("retiradaNaLoja", e.target.checked)} /> Cliente pode retirar na loja</label>
            <Campo label="Despacho em (dias úteis)"><input className={inputClasse} type="number" min={0} max={30} value={f.despachoDiasUteis} onChange={(e) => set("despachoDiasUteis", e.target.value)} /></Campo>
          </div>
          <Campo label="Domínio próprio" ajuda="Opcional agora. Se já tem (ex.: sualoja.com.br), configuramos DNS e e-mail automaticamente."><input className={inputClasse} value={f.dominioPrincipal} onChange={(e) => set("dominioPrincipal", e.target.value)} placeholder="sualoja.com.br" /></Campo>
        </Secao>
      )}

      {passo === 3 && (
        <>
          <Secao titulo="Produtos" descricao="Envie uma planilha CSV ou pule e cadastre depois no painel (um a um ou por planilha).">
            <p className="text-xs text-muted-foreground">Colunas: <code>nome, preco, categoria, marca, sku, preco_de, descricao_curta, descricao, imagem, destaque, peso_kg</code>. Só <code>nome</code> e <code>preco</code> são obrigatórios. Preço em reais (59,90).</p>
            <input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0]?.text().then((t) => setCsv({ nome: e.target.files![0].name, ...lerCsvProdutos(t) }))} className="text-sm" />
            {csv && (
              <div className="rounded-lg border border-border p-3 text-sm">
                <p><strong>{csv.nome}</strong>: {csv.produtos.length} produto(s) prontos.</p>
                {csv.erros.length > 0 && <ul className="mt-1 list-disc pl-5 text-xs text-amber-700">{csv.erros.slice(0, 5).map((x) => <li key={x}>{x}</li>)}</ul>}
              </div>
            )}
          </Secao>
          <Secao titulo="Acesso ao painel" descricao={`Login: ${f.emailContato || "seu e-mail"}`}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Senha" ajuda="Mínimo 8 caracteres"><input className={inputClasse} type="password" value={f.senha} onChange={(e) => set("senha", e.target.value)} /></Campo>
              <Campo label="Repita a senha"><input className={inputClasse} type="password" value={f.senha2} onChange={(e) => set("senha2", e.target.value)} /></Campo>
            </div>
          </Secao>
        </>
      )}

      {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}

      <div className="flex justify-between">
        <button type="button" className="btn-secundario" disabled={passo === 0 || ocupado} onClick={() => setPasso((p) => p - 1)}>Voltar</button>
        {passo < PASSOS.length - 1 ? (
          <button type="button" className="btn-primario" disabled={!podeAvancar} onClick={() => setPasso((p) => p + 1)}>Continuar</button>
        ) : (
          <button type="button" className="btn-primario" disabled={ocupado} onClick={criar}>{ocupado ? "Criando…" : "Criar minha loja"}</button>
        )}
      </div>
    </div>
  );
}
