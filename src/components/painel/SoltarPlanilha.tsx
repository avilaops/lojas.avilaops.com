"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";

/**
 * A caixa de escolher a planilha.
 *
 * Era o `<input type="file">` cru do navegador: um botão cinza escrito
 * "Escolher Arquivo · Nenhum arquivo escolhido", que muda de cara em cada
 * sistema e não parece parte do painel. Aqui vira uma área para arrastar o
 * arquivo ou clicar, que é o gesto que o lojista já conhece de outros lugares.
 *
 * O `<input>` continua existindo, escondido: é ele que abre o seletor do
 * sistema e é ele que o leitor de tela anuncia. Trocar por um `<div>` com
 * `onClick` deixaria a tela inacessível pelo teclado.
 */
export default function SoltarPlanilha({
  onArquivo,
  desabilitado,
}: {
  onArquivo: (arquivo: File) => void;
  desabilitado?: boolean;
}) {
  const campo = useRef<HTMLInputElement>(null);
  const [sobre, setSobre] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function receber(arquivo: File | undefined) {
    if (!arquivo) return;
    // O nome é o que dá para conferir sem abrir: o tipo MIME de CSV varia entre
    // Excel, LibreOffice e Google Planilhas, e barrar por ele recusa arquivo bom.
    if (!/\.csv$/i.test(arquivo.name)) {
      setErro("Envie um arquivo .csv. No Excel ou no Google Planilhas: Arquivo → Baixar → CSV.");
      return;
    }
    setErro(null);
    onArquivo(arquivo);
  }

  return (
    <div className="grid gap-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!desabilitado) setSobre(true);
        }}
        onDragLeave={() => setSobre(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSobre(false);
          if (!desabilitado) receber(e.dataTransfer.files?.[0]);
        }}
        className={`rounded-xl border-2 border-dashed p-6 text-center transition ${
          sobre ? "border-primary bg-primary/5" : "border-border bg-muted/20"
        } ${desabilitado ? "opacity-50" : ""}`}
      >
        <FileSpreadsheet size={26} className="mx-auto text-muted-foreground" aria-hidden="true" />
        <p className="mt-2 text-sm">
          <button
            type="button"
            className="font-semibold text-primary underline underline-offset-2"
            disabled={desabilitado}
            onClick={() => campo.current?.click()}
          >
            Escolher a planilha
          </button>{" "}
          <span className="text-muted-foreground">ou arraste o arquivo até aqui</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Arquivo .csv</p>

        <input
          ref={campo}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          disabled={desabilitado}
          onChange={(e) => {
            receber(e.target.files?.[0]);
            // Zera o valor: sem isso, escolher o mesmo arquivo duas vezes
            // seguidas (depois de corrigir a planilha) não dispara nada.
            e.target.value = "";
          }}
        />
      </div>

      {erro && <p className="text-sm text-amber-800">{erro}</p>}
    </div>
  );
}
