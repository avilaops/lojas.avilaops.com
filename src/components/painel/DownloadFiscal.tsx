"use client";

import { useState, type ReactNode } from "react";

function nomeDoArquivo(resposta: Response, fallback: string): string {
  const disposicao = resposta.headers.get("content-disposition") ?? "";
  const encontrado = /filename="([^"]+)"/i.exec(disposicao)?.[1];
  return (encontrado ?? fallback).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 160);
}

async function mensagemDeErro(resposta: Response): Promise<string> {
  try {
    const corpo = await resposta.json() as { erro?: unknown };
    if (typeof corpo.erro === "string" && corpo.erro.trim()) return corpo.erro;
  } catch {
    // O status HTTP ainda produz uma mensagem útil quando o corpo não é JSON.
  }
  return `Não foi possível baixar o arquivo fiscal (HTTP ${resposta.status}).`;
}

export default function DownloadFiscal({ href, fallback, className, title, children }: {
  href: string;
  fallback: string;
  className: string;
  title?: string;
  children: ReactNode;
}) {
  const [baixando, setBaixando] = useState(false);
  const [erro, setErro] = useState("");

  async function baixar() {
    setBaixando(true);
    setErro("");
    try {
      const resposta = await fetch(href, { credentials: "same-origin", cache: "no-store" });
      if (!resposta.ok) throw new Error(await mensagemDeErro(resposta));
      const tipo = resposta.headers.get("content-type")?.toLowerCase() ?? "";
      if (!tipo.startsWith("application/xml") && !tipo.startsWith("text/xml") && !tipo.startsWith("application/pdf")) {
        throw new Error("O servidor não devolveu um XML ou PDF fiscal válido.");
      }
      const url = URL.createObjectURL(await resposta.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = nomeDoArquivo(resposta, fallback);
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível baixar o arquivo fiscal.");
    } finally {
      setBaixando(false);
    }
  }

  return (
    <span className="inline-flex min-w-0 flex-col gap-1">
      <button type="button" className={className} title={title} disabled={baixando} onClick={() => void baixar()}>
        {children}
      </button>
      {erro && <span role="alert" className="max-w-64 text-xs leading-tight text-red-700">{erro}</span>}
    </span>
  );
}
