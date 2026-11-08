import { ArrowUpRight, FileText } from "lucide-react";
import { fonteOficialDomiRio } from "@/lib/domirio-comercial";
import { codigoPublico } from "@/lib/codigo-publico";
import styles from "./comercial.module.css";

export default function ResumoProduto({ marca, sku, atributos, apresentacao }: { marca: string | null; sku: string | null; atributos: unknown; apresentacao?: string }) {
  const a = atributos as Record<string, unknown> | null;
  const volume = apresentacao || (typeof a?.apresentacaoComercial === "string" ? a.apresentacaoComercial : null);
  const fonte = fonteOficialDomiRio(atributos);
  return <>
    <dl className={styles.resumo}>{marca && <div><dt>Marca</dt><dd>{marca}</dd></div>}{volume && <div><dt>Apresentação</dt><dd>{volume}</dd></div>}{codigoPublico(sku) && <div><dt>Código do produto</dt><dd>{codigoPublico(sku)}</dd></div>}</dl>
    {fonte && <div className={styles.documentacao}><a href={fonte} target="_blank" rel="noopener noreferrer"><FileText size={16} aria-hidden="true" />Informações oficiais do fabricante <ArrowUpRight size={14} aria-hidden="true" /></a></div>}
  </>;
}
