"use client";

import { useState } from "react";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { Campo, Secao, inputClasse } from "./campos";
import {
  AJUDA_TIPO,
  ROTULO_TIPO,
  TIPOS_CAMPO,
  type CampoPersonalizado,
  type TipoCampo,
} from "@/lib/campos-personalizados";

/**
 * Definição dos campos que esta loja acrescenta ao produto.
 *
 * O que a tela deixa claro, e que é a parte fácil de errar: **rascunho é o
 * estado normal de um campo novo**. O lojista desenha o campo, preenche cem
 * produtos e só então ativa — senão o cliente vê meia ficha preenchida
 * enquanto o cadastro anda.
 *
 * A ordem da lista é a ordem da ficha na loja, então ela é editável aqui e é
 * salva junto. Subir e descer por botão, e não por arrastar: arrastar não
 * funciona com teclado nem com leitor de tela, e o painel é usado no celular.
 */
export default function CamposPersonalizados({ iniciais }: { iniciais: CampoPersonalizado[] }) {
  const [campos, setCampos] = useState<CampoPersonalizado[]>(iniciais);
  const [estado, setEstado] = useState<"parado" | "salvando" | "salvo">("parado");
  const [erro, setErro] = useState<string | null>(null);

  function mudar(i: number, troca: Partial<CampoPersonalizado>) {
    setCampos((lista) => lista.map((c, j) => (j === i ? { ...c, ...troca } : c)));
    setEstado("parado");
  }

  function mover(i: number, direcao: -1 | 1) {
    setCampos((lista) => {
      const destino = i + direcao;
      if (destino < 0 || destino >= lista.length) return lista;
      const copia = [...lista];
      [copia[i], copia[destino]] = [copia[destino], copia[i]];
      return copia;
    });
    setEstado("parado");
  }

  async function salvar() {
    setEstado("salvando");
    setErro(null);
    const r = await fetch("/api/painel/campos", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ campos }),
    });
    const dados = await r.json().catch(() => ({}));
    if (!r.ok) {
      setEstado("parado");
      return setErro(dados.erro ?? "Não deu para salvar agora.");
    }
    // A API devolve as definições já normalizadas, com as chaves que ela
    // decidiu: é por elas que os valores dos produtos são gravados.
    setCampos(dados.campos ?? campos);
    setEstado("salvo");
  }

  return (
    <div className="grid gap-6">
      <Secao
        titulo="Campos do produto"
        descricao="O que a sua loja pergunta além do que toda loja pergunta. Aparece no cadastro do produto e na ficha, na loja."
      >
        {campos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum campo ainda. Uma loja de vinho acrescentaria <em>Safra</em> e <em>Uva</em>; uma de tinta,{" "}
            <em>Rendimento por litro</em>. O que você cadastrar aqui passa a ser perguntado em todo produto.
          </p>
        ) : (
          <ul className="grid gap-4">
            {campos.map((c, i) => (
              <li key={c.chave || i} className="rounded-xl border border-border p-3 sm:p-4">
                <div className="mb-3 flex items-center gap-2">
                  <GripVertical size={16} className="flex-none text-muted-foreground" aria-hidden="true" />
                  <strong className="min-w-0 flex-1 truncate text-sm">{c.rotulo || "Campo sem nome"}</strong>
                  <button
                    type="button"
                    onClick={() => mover(i, -1)}
                    disabled={i === 0}
                    aria-label={`Subir ${c.rotulo}`}
                    className="h-9 w-9 rounded-lg border border-border text-sm disabled:opacity-40"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => mover(i, 1)}
                    disabled={i === campos.length - 1}
                    aria-label={`Descer ${c.rotulo}`}
                    className="h-9 w-9 rounded-lg border border-border text-sm disabled:opacity-40"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCampos((l) => l.filter((_, j) => j !== i));
                      setEstado("parado");
                    }}
                    aria-label={`Remover ${c.rotulo}`}
                    className="h-9 w-9 rounded-lg border border-border text-muted-foreground"
                  >
                    <Trash2 size={15} className="mx-auto" aria-hidden="true" />
                  </button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Campo label="Rótulo do campo" ajuda="É o que aparece na ficha do produto.">
                    <input
                      value={c.rotulo}
                      onChange={(e) => mudar(i, { rotulo: e.target.value })}
                      placeholder="Safra"
                      className={inputClasse}
                    />
                  </Campo>

                  <Campo label="Tipo do campo" ajuda={AJUDA_TIPO[c.tipo]}>
                    <select
                      value={c.tipo}
                      onChange={(e) => mudar(i, { tipo: e.target.value as TipoCampo })}
                      className={inputClasse}
                    >
                      {TIPOS_CAMPO.map((t) => (
                        <option key={t} value={t}>{ROTULO_TIPO[t]}</option>
                      ))}
                    </select>
                  </Campo>

                  {c.tipo === "numero" && (
                    <Campo label="Unidade" ajuda="Opcional. Aparece depois do número: “12,5 m²/L”.">
                      <input
                        value={c.unidade ?? ""}
                        onChange={(e) => mudar(i, { unidade: e.target.value })}
                        placeholder="m²/L"
                        className={inputClasse}
                      />
                    </Campo>
                  )}

                  {c.tipo === "escolha" && (
                    <Campo label="Opções" ajuda="Uma por linha. O cadastro do produto só aceita uma delas.">
                      <textarea
                        value={(c.opcoes ?? []).join("\n")}
                        onChange={(e) => mudar(i, { opcoes: e.target.value.split("\n") })}
                        rows={4}
                        placeholder={"Seco\nMeio seco\nSuave"}
                        className={`${inputClasse} h-auto py-2`}
                      />
                    </Campo>
                  )}

                  <Campo label="Texto de apoio" ajuda="Opcional. Explica a quem cadastra o que preencher.">
                    <input
                      value={c.ajuda ?? ""}
                      onChange={(e) => mudar(i, { ajuda: e.target.value })}
                      placeholder="Ano da colheita, com quatro dígitos"
                      className={inputClasse}
                    />
                  </Campo>

                  <Campo
                    label="Estado"
                    ajuda={
                      c.estado === "ativo"
                        ? "Visível na loja em todo produto que tiver este campo preenchido."
                        : "Só no painel. Preencha os produtos antes de ativar, para o cliente não ver meia ficha."
                    }
                  >
                    <select
                      value={c.estado}
                      onChange={(e) => mudar(i, { estado: e.target.value as CampoPersonalizado["estado"] })}
                      className={inputClasse}
                    >
                      <option value="rascunho">Rascunho — só no painel</option>
                      <option value="ativo">Ativo — aparece na loja</option>
                    </select>
                  </Campo>
                </div>

                {c.chave && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Identificador: <code className="rounded bg-muted px-1">{c.chave}</code> — não muda quando você
                    renomeia o rótulo, porque é ele que liga este campo ao que já está gravado nos produtos.
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={() => {
            setCampos((l) => [...l, { chave: "", rotulo: "", tipo: "texto", estado: "rascunho" }]);
            setEstado("parado");
          }}
          className="btn-secundario inline-flex h-11 items-center gap-2 px-4"
        >
          <Plus size={16} aria-hidden="true" /> Adicionar campo
        </button>

        {erro && <p className="campo-erro" role="alert">{erro}</p>}

        <div className="flex items-center gap-3">
          <button type="button" disabled={estado === "salvando"} onClick={salvar} className="btn-primario h-11 px-5">
            {estado === "salvando" ? "Salvando…" : "Salvar campos"}
          </button>
          {estado === "salvo" && <span className="text-sm text-muted-foreground">Salvo.</span>}
          {campos.some((c) => c.rotulo && !c.chave) && (
            <span className="text-xs text-muted-foreground">
              O identificador do campo novo é gerado ao salvar, a partir do rótulo.
            </span>
          )}
        </div>
      </Secao>

      <Secao titulo="Como preencher" descricao="Definir o campo é o primeiro passo; o valor é de cada produto.">
        <ol className="grid list-decimal gap-2 pl-5 text-sm text-muted-foreground">
          <li>Crie o campo aqui e deixe em <strong className="text-foreground">rascunho</strong>.</li>
          <li>Abra os produtos e preencha o valor — o campo aparece no cadastro assim que existe.</li>
          <li>Volte aqui e mude para <strong className="text-foreground">ativo</strong>: aí o cliente passa a ver.</li>
        </ol>
        <p className="text-xs text-muted-foreground">
          Apagar um campo aqui apaga a pergunta, não os valores já gravados: recriar o campo com o mesmo rótulo traz de
          volta o que estava preenchido.
        </p>
      </Secao>
    </div>
  );
}
