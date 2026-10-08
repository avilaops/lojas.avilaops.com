import type { Metadata } from "next";
import { exigirTenant, temaDo } from "@/lib/tenant";
import Image from "next/image";
import Link from "next/link";
import { contratoDo } from "@/lib/templates";
import { descricaoDaPagina } from "@/lib/textos-loja";

// Descrição própria: sem ela a página herdava a da loja, igual à da home.
export async function generateMetadata(): Promise<Metadata> {
  const t = await exigirTenant();
  return { title: "Sobre", description: descricaoDaPagina(t, "sobre"), alternates: { canonical: "/sobre" } };
}

export default async function Sobre() {
  const t = await exigirTenant();
  const tema = temaDo(t);
  if(contratoDo(tema).escopo === "loja") return <section className="container-loja ap-secao"><div className="ap-secao-titulo"><div><p className="ap-sobretitulo">Nossa loja</p><h1 className="text-3xl font-bold">Sobre {t.nome}</h1></div></div><div className="ap-editorial">{tema.premium?.editorialImagem && <div className="ap-editorial-foto"><Image src={tema.premium.editorialImagem} alt="Cuidado editorial com a pintura automotiva" fill sizes="(max-width:768px) 100vw,600px" unoptimized/><span>Imagem editorial</span></div>}<div className="ap-editorial-texto"><div className="prosa text-sm">{(t.sobre ?? t.slogan ?? t.nome).split(/\n{2,}/).map((p,i)=><p key={i}>{p}</p>)}</div><Link href="/contato" className="btn-primario mt-6">Fale com a equipe</Link></div></div></section>;
  return (
    <div className="container-loja max-w-2xl py-10">
      <h1 className="text-2xl font-bold">Sobre a {t.nome}</h1>
      <div className="prosa mt-4 text-sm leading-relaxed">
        {(t.sobre ?? `A ${t.nome} atende pela internet e, quando disponível, no balcão.`).split(/\n{2,}/).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </div>
  );
}
