"use client";

import { useState } from "react";
import { Campo, Secao, inputClasse } from "./campos";
import EnviarImagem from "./EnviarImagem";

export interface CategoriaView { id: string; nome: string; slug: string; descricao: string | null; imagemUrl: string | null; ordem: number; produtos: number }

export default function Categorias({ categorias, chamar, ocupado }: { categorias: CategoriaView[]; chamar: (c: string, m: string, b?: unknown, s?: string) => Promise<unknown>; ocupado: boolean }) {
  const [f, setF] = useState({ id: "", nome: "", descricao: "", imagemUrl: "" });
  const editar = (c: CategoriaView) => setF({ id: c.id, nome: c.nome, descricao: c.descricao ?? "", imagemUrl: c.imagemUrl ?? "" });
  const limpar = () => setF({ id: "", nome: "", descricao: "", imagemUrl: "" });

  return (
    <Secao titulo={`Categorias (${categorias.length})`} descricao="Aparecem no menu e na página inicial, na ordem abaixo.">
      <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto_auto]">
        <input className={inputClasse} placeholder="Nome" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
        <input className={inputClasse} placeholder="Descrição (opcional)" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} />
        <EnviarImagem aoEnviar={(url) => setF({ ...f, imagemUrl: url })} rotulo={f.imagemUrl ? "Trocar imagem" : "Imagem"} />
        <button className="btn-primario" disabled={ocupado || !f.nome.trim()} onClick={() => chamar("/api/painel/categorias", "POST", { id: f.id || undefined, nome: f.nome, descricao: f.descricao || null, imagemUrl: f.imagemUrl || null }, "Categoria salva.").then(limpar)}>{f.id ? "Salvar" : "Adicionar"}</button>
      </div>
      {f.id && <button className="text-xs underline" onClick={limpar}>cancelar edição</button>}
      {categorias.length > 0 && (
        <ul className="divide-y divide-border text-sm">
          {categorias.map((c, i) => (
            <li key={c.id} className="flex items-center gap-3 py-2">
              {c.imagemUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- URL dinâmica enviada pelo lojista
                <img src={c.imagemUrl} alt="" className="h-8 w-8 rounded object-cover" />
              )}
              <span className="font-medium">{c.nome}</span>
              <span className="text-xs text-muted-foreground">{c.produtos} produto(s)</span>
              <span className="ml-auto flex gap-2 text-xs">
                {i > 0 && <button className="underline" disabled={ocupado} onClick={() => chamar("/api/painel/categorias", "POST", { id: c.id, nome: c.nome, ordem: categorias[i - 1].ordem - 1 < 0 ? 0 : categorias[i - 1].ordem }, "Ordem atualizada.").then(() => chamar("/api/painel/categorias", "POST", { id: categorias[i - 1].id, nome: categorias[i - 1].nome, ordem: c.ordem + 1 }, "Ordem atualizada."))}>↑</button>}
                <button className="underline" onClick={() => editar(c)}>editar</button>
                <button className="text-muted-foreground underline" disabled={ocupado} onClick={() => confirm(`Apagar a categoria ${c.nome}? Os produtos ficam sem categoria.`) && chamar(`/api/painel/categorias?id=${c.id}`, "DELETE", undefined, "Categoria apagada.")}>apagar</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <Campo label="" ajuda="Dica: a categoria também é criada automaticamente quando você cadastra um produto com um nome de categoria novo."><span /></Campo>
    </Secao>
  );
}
