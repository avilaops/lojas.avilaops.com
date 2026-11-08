"use client";

import { useId, useState } from "react";
import Image from "next/image";
import { ArrowUpRight, Search, X } from "lucide-react";
import Link from "@/components/LinkLoja";
import { filtrarArtigosDomiRio, temasDomiRio, type ArtigoDomiRio } from "@/lib/artigos-domirio";
import styles from "./editorial.module.css";

export default function IndiceArtigos({ artigos }: { artigos: ArtigoDomiRio[] }) {
  const [busca, setBusca] = useState("");
  const [serie, setSerie] = useState<number>();
  const campoId = useId();
  const listaId = useId();
  const resultados = filtrarArtigosDomiRio(artigos, busca, serie);

  return <section id="defensivos" className={styles.indice} aria-labelledby="titulo-defensivos">
    <div className={styles.tituloSecao}>
      <div><p className={styles.sobreTitulo}>Defensivos na prática</p><h2 id="titulo-defensivos">Encontre o seu próximo assunto.</h2></div>
      <div className={styles.campoBusca}>
        <label htmlFor={campoId}>Buscar nos 50 artigos</label>
        <div><Search size={19} aria-hidden="true" /><input id={campoId} type="search" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Ex.: deriva, receituário, resistência" aria-controls={listaId} />{busca && <button type="button" onClick={() => setBusca("")} aria-label="Limpar busca"><X size={18} aria-hidden="true" /></button>}</div>
      </div>
    </div>
    <div className={styles.temas} role="group" aria-label="Filtrar artigos por assunto">
      <button type="button" aria-pressed={serie === undefined} onClick={() => setSerie(undefined)} aria-controls={listaId}>Todos os assuntos</button>
      {temasDomiRio.map(t => <button type="button" key={t.id} aria-pressed={serie === t.id} onClick={() => setSerie(t.id)} aria-controls={listaId}>{t.nome}</button>)}
    </div>
    <p className={styles.resultados} aria-live="polite" aria-atomic="true">{resultados.length} {resultados.length === 1 ? "artigo encontrado" : "artigos encontrados"}</p>
    <div id={listaId}>
      {resultados.length ? <ul className={styles.grade}>
        {resultados.map(p => <li key={p.slug}><article className={styles.card}>
          <Link href={`/blog/${p.slug}`} prefetch={false}>
            <Image src={p.cover} alt="" width={640} height={400} sizes="(max-width: 700px) calc(100vw - 36px), (max-width: 1000px) 50vw, 380px" loading="lazy" />
            <div className={styles.cardConteudo}>
              <span className={styles.categoria}>{p.category}</span>
              <h3>{p.title}</h3>
              <p>{p.description}</p>
              <span className={styles.cardRodape}>{p.readingMinutes} min de leitura <span>Ler artigo <ArrowUpRight size={16} aria-hidden="true" /></span></span>
            </div>
          </Link>
        </article></li>)}
      </ul> : <div className={styles.vazio}><h3>Nenhum artigo com esses filtros.</h3><p>Tente outro termo ou volte a todos os assuntos.</p><button type="button" onClick={() => { setBusca(""); setSerie(undefined); }}>Limpar filtros</button></div>}
    </div>
  </section>;
}
