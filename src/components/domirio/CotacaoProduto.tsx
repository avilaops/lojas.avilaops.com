"use client";

import { useId, useState, type FormEvent } from "react";
import { MessageCircle } from "lucide-react";
import Link from "@/components/LinkLoja";
import { numeroDeContato } from "@/lib/canais-publicos";
import { registrarEventoFunil } from "@/lib/eventos-loja";
import { mensagemCotacaoDomiRio, type ProdutoCotacaoDomiRio } from "@/lib/domirio-comercial";
import { linkWhatsApp } from "@/components/WhatsAppFlutuante";
import styles from "./comercial.module.css";

type Apresentacao = { id: string; nome: string; sku: string | null };

export default function CotacaoProduto({ produto, baseUrl, whatsapp, apresentacoes, varianteInicial }: {
  produto: ProdutoCotacaoDomiRio; baseUrl: string; whatsapp: string | null;
  apresentacoes: Apresentacao[]; varianteInicial?: string;
}) {
  const id = useId();
  const [erro, setErro] = useState("");
  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    const variante = apresentacoes.find(a => a.id === dados.get("apresentacao"));
    if (apresentacoes.length && !variante) { setErro("Escolha uma apresentação para cotar."); return; }
    try {
      const mensagem = mensagemCotacaoDomiRio({ ...produto, ...(variante ? { sku: variante.sku, apresentacao: variante.nome, varianteId: variante.id } : {}) }, baseUrl, Number(dados.get("quantidade")));
      setErro("");
      registrarEventoFunil("technical_contact");
      // Navegação direta preserva o gesto do usuário e evita bloqueadores de pop-up.
      window.location.assign(linkWhatsApp(whatsapp!, mensagem));
    } catch { setErro("Informe uma quantidade inteira entre 1 e 99999."); }
  }
  return <section className={styles.cotacao} aria-labelledby={`${id}-titulo`}>
    <h2 id={`${id}-titulo`}>Precisa de mais unidades ou compra para sua empresa?</h2>
    <p>Peça uma cotação com o produto e a quantidade. O comercial confirma disponibilidade, pagamento e frete.</p>
    {numeroDeContato(whatsapp) ? <form onSubmit={enviar}>
      {apresentacoes.length > 0 && <label>Apresentação<select name="apresentacao" required defaultValue={varianteInicial ?? ""}><option value="" disabled>Escolha a apresentação</option>{apresentacoes.map(a => <option key={a.id} value={a.id}>{a.nome}{a.sku ? ` · ${a.sku}` : ""}</option>)}</select></label>}
      <label>Quantidade de unidades<input type="number" name="quantidade" min={1} max={99999} step={1} defaultValue={1} required inputMode="numeric" aria-describedby={erro ? `${id}-erro` : undefined} /></label>
      {erro && <p id={`${id}-erro`} className={styles.erro} role="alert">{erro}</p>}
      <button type="submit" className="btn-secundario"><MessageCircle size={18} aria-hidden="true" />Preparar cotação no WhatsApp</button>
      <p>Você revisa e envia a mensagem no WhatsApp. Cotar não reserva estoque nem conclui uma compra.</p>
    </form> : <Link href="/contato" className={styles.link}>Ver canais de atendimento</Link>}
    <Link href={`/cotacao?produto=${encodeURIComponent(produto.slug)}${varianteInicial ? `&variante=${encodeURIComponent(varianteInicial)}` : ""}`} className={styles.link}>Cotar vários produtos em uma lista</Link>
  </section>;
}
