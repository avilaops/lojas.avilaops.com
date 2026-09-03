"use client";

import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";

/** Campos do painel — uma aparência só para wizard e painel. */

export function Campo({ label, ajuda, erro, obrigatorio, acao, children }: { label: string; ajuda?: string; erro?: string; obrigatorio?: boolean; acao?: ReactNode; children: ReactNode }) {
  const id = useId();
  const rotuloId = `${id}-rotulo`;
  const ajudaId = `${id}-ajuda`;
  const controleDireto = isValidElement(children) && typeof children.type === "string" && ["input", "select", "textarea"].includes(children.type);
  const propsAtuais = controleDireto ? (children as ReactElement<{ id?: string; "aria-describedby"?: string }>).props : null;
  const controleId = propsAtuais?.id ?? id;
  const conteudo = controleDireto
    ? cloneElement(children as ReactElement<{ id?: string; "aria-describedby"?: string }>, { id: controleId, "aria-describedby": erro || ajuda ? ajudaId : propsAtuais?.["aria-describedby"] })
    : children;
  return (
    <div className={`block ${erro ? "campo-invalido" : ""}`} {...(!controleDireto ? { role: "group", "aria-labelledby": rotuloId } : {})}>
      <span className="flex flex-wrap items-center justify-between gap-2">
        {controleDireto
          ? <label htmlFor={controleId} id={rotuloId} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}{obrigatorio && <b aria-hidden="true"> *</b>}</label>
          : <span id={rotuloId} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}{obrigatorio && <b aria-hidden="true"> *</b>}</span>}
        {acao}
      </span>
      <div className="mt-1">{conteudo}</div>
      {erro ? <span id={ajudaId} className="campo-erro" role="alert">{erro}</span> : ajuda && <span id={ajudaId} className="mt-1 block text-xs text-muted-foreground">{ajuda}</span>}
    </div>
  );
}

export const inputClasse = "h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-foreground";

export function Secao({ titulo, descricao, children }: { titulo: string; descricao?: string; children: ReactNode }) {
  return (
    // `min-w-0` no bloco e na grade interna: item de grid tem largura mínima
    // automática, então um nome técnico longo ("02400 JOGO C/8 PÇS
    // (8x14,1x8,9x13) - Retentor…") estica a seção inteira e a página passa a
    // rolar de lado no celular. Medido em 03/09/2026: 679px numa tela de 393.
    <section className="min-w-0 rounded-2xl border border-border bg-card p-4 sm:p-6">
      <h2 className="text-base font-semibold">{titulo}</h2>
      {descricao && <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>}
      <div className="mt-4 grid min-w-0 gap-4">{children}</div>
    </section>
  );
}

export const FONTES = [
  { valor: "sistema", rotulo: "Padrão do sistema" },
  { valor: "inter", rotulo: "Inter (moderna)" },
  { valor: "poppins", rotulo: "Poppins (amigável)" },
  { valor: "montserrat", rotulo: "Montserrat (forte)" },
  { valor: "playfair", rotulo: "Playfair (elegante)" },
] as const;

/**
 * CSV → produtos. Cabeçalhos aceitos (qualquer ordem, com ou sem acento):
 * nome, categoria, marca, sku, preco, preco_de, descricao_curta, descricao, imagem, destaque, peso_kg
 * Preço em reais ("59,90" ou "59.90") vira centavos.
 */
export function lerCsvProdutos(texto: string) {
  const linhas = texto.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  if (linhas.length < 2) return { produtos: [] as Array<Record<string, unknown>>, erros: ["Planilha vazia."] };
  const sep = linhas[0].includes(";") ? ";" : ",";
  const dividir = (l: string) => {
    const out: string[] = [];
    let atual = "";
    let aspas = false;
    for (const ch of l) {
      if (ch === '"') aspas = !aspas;
      else if (ch === sep && !aspas) {
        out.push(atual);
        atual = "";
      } else atual += ch;
    }
    out.push(atual);
    return out.map((c) => c.trim());
  };
  const norm = (s: string) => s.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const cab = dividir(linhas[0]).map(norm);
  const idx = (n: string) => cab.indexOf(n);
  const centavos = (v: string) => Math.round(Number.parseFloat(v.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3})/g, "").replace(",", ".")) * 100);

  const produtos: Array<Record<string, unknown>> = [];
  const erros: string[] = [];
  linhas.slice(1).forEach((l, i) => {
    const c = dividir(l);
    const nome = c[idx("nome")] ?? "";
    const preco = centavos(c[idx("preco")] ?? "");
    if (!nome || !Number.isFinite(preco)) {
      erros.push(`Linha ${i + 2}: nome ou preço ausente.`);
      return;
    }
    const pega = (n: string) => (idx(n) >= 0 ? c[idx(n)] || undefined : undefined);
    const precoDe = pega("preco_de") ? centavos(pega("preco_de")!) : undefined;
    const peso = pega("peso_kg") ? Number.parseFloat(pega("peso_kg")!.replace(",", ".")) : undefined;
    produtos.push({
      nome,
      precoCentavos: preco,
      ...(precoDe !== undefined && Number.isFinite(precoDe) ? { precoDeCentavos: precoDe } : {}),
      categoria: pega("categoria"),
      marca: pega("marca"),
      sku: pega("sku"),
      descricaoCurta: pega("descricao_curta"),
      descricao: pega("descricao"),
      imagens: pega("imagem") ? [pega("imagem")!] : undefined,
      destaque: /^(1|sim|s|true|x)$/i.test(pega("destaque") ?? ""),
      ...(peso && Number.isFinite(peso) ? { pesoKg: peso } : {}),
    });
  });
  return { produtos, erros };
}

export const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
