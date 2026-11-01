"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Search, ChevronRight, Palette, Globe, Truck, CreditCard, FileText, ShieldCheck, ListFilter, BookOpen, Store, Radar, Zap, Users, Receipt, Building2, Settings } from "lucide-react";
import type { ItemAgrupado } from "@/components/aplicacao/ListaAgrupada";
import styles from "./IndiceConfiguracoes.module.css";

const icones = { marca: Palette, dominio: Globe, entrega: Truck, recebimento: CreditCard, fiscal: FileText, politicas: ShieldCheck, campos: ListFilter, blog: BookOpen, canais: Store, descoberta: Radar, automacoes: Zap, equipe: Users, assinatura: Receipt, conta: Building2 };
const termos: Record<string, string> = { recebimento: "pix cartão boleto pagamento", descoberta: "seo google bing ia", fiscal: "nfe nf-e certificado a1 xml", marca: "logo aparência cores", dominio: "endereço site dns" };
const normalizar = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function IndiceConfiguracoes({ grupos }: { grupos: Array<{ titulo: string; itens: ItemAgrupado[] }> }) {
  const [busca, setBusca] = useState("");
  const id = useId();
  const consulta = normalizar(busca.trim());
  const filtrados = grupos.map(grupo => ({ ...grupo, itens: grupo.itens.filter(item => {
    const slug = item.href.split("/").pop() ?? "";
    return normalizar([grupo.titulo, item.titulo, item.descricao, termos[slug]].join(" ")).includes(consulta);
  }) })).filter(grupo => grupo.itens.length);
  return (
    <div className={styles.indice}>
      <div className={styles.busca}>
        <Search size={18} aria-hidden="true" />
        <label className="sr-only" htmlFor={id}>Buscar configuração</label>
        <input id={id} type="search" placeholder="Buscar configuração…" value={busca} onChange={e => setBusca(e.target.value)} />
      </div>
      <div className={styles.grupos}>
        {filtrados.map(grupo => (
          <section key={grupo.titulo} className={styles.grupo} aria-label={grupo.titulo}>
            <h2>{grupo.titulo}</h2>
            <ul>
              {grupo.itens.map(item => {
                const slug = item.href.split("/").pop() ?? "";
                const Icone = icones[slug as keyof typeof icones] ?? Settings;
                return <li key={item.href}><Link href={item.href}>
                  <span className={styles.icone}><Icone size={19} aria-hidden="true" /></span>
                  <span className={styles.texto}><strong>{item.titulo}</strong><span>{item.descricao}</span></span>
                  <ChevronRight size={16} aria-hidden="true" />
                </Link></li>;
              })}
            </ul>
          </section>
        ))}
      </div>
      <p className={styles.resultado} role="status">{consulta && (filtrados.length ? `${filtrados.reduce((total, grupo) => total + grupo.itens.length, 0)} configurações encontradas` : "Nenhuma configuração encontrada. Tente Pix, domínio ou certificado.")}</p>
    </div>
  );
}
