import type { Metadata } from "next";
import { enderecoCompleto, exigirTenant, temaDo } from "@/lib/tenant";
import { linkWhatsApp } from "@/components/WhatsAppFlutuante";
import { ArrowUpRight, Clock3, MapPin, MessageCircle, Phone, Mail } from "lucide-react";

export const metadata: Metadata = { title: "Contato" , alternates: { canonical: "/contato" } };

export default async function Contato() {
  const t = await exigirTenant();
  const endereco = t.enderecoPublico ? enderecoCompleto(t) : "";
  if (temaDo(t).layout === "automotivo-premium") return (
    <section className="container-loja ap-contato">
      <div className="ap-contato-intro">
        <p className="ap-selo">Converse com a gente</p>
        <h1>Seu próximo cuidado começa com uma boa conversa.</h1>
        <p>Dúvidas sobre um produto, uma aplicação ou seu pedido? Escolha como prefere falar com a equipe {t.nome}.</p>
        {t.whatsapp && <a className="btn-primario" href={linkWhatsApp(t.whatsapp, "Olá! Vim pelo site e gostaria de uma orientação.")} target="_blank" rel="noopener noreferrer"><MessageCircle size={20}/> Conversar no WhatsApp <ArrowUpRight size={18}/></a>}
      </div>
      <dl className="ap-contato-dados">
        {endereco && <div><MapPin aria-hidden="true"/><dt>Visite a loja</dt><dd><address>{endereco}</address><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${t.nome} ${endereco}`)}`} target="_blank" rel="noopener noreferrer">Ver como chegar <ArrowUpRight size={15}/></a></dd></div>}
        {t.horario && <div><Clock3 aria-hidden="true"/><dt>Horário de atendimento</dt><dd>{t.horario}</dd></div>}
        {t.telefone && <div><Phone aria-hidden="true"/><dt>Telefone</dt><dd><a href={`tel:${t.telefone.replace(/[^+\d]/g, "")}`}>{t.telefone}</a></dd></div>}
        {t.emailContato && <div><Mail aria-hidden="true"/><dt>E-mail</dt><dd><a href={`mailto:${t.emailContato}`}>{t.emailContato}</a></dd></div>}
      </dl>
    </section>
  );
  return (
    <div className="container-loja max-w-2xl py-10">
      <h1 className="text-2xl font-bold">Contato</h1>
      <dl className="mt-6 space-y-3 text-sm">
        {t.whatsapp && (
          <div>
            <dt className="font-semibold">WhatsApp</dt>
            <dd>
              <a className="underline" href={linkWhatsApp(t.whatsapp, "Olá! Vim pelo site.")} target="_blank" rel="noopener">
                Iniciar conversa
              </a>
            </dd>
          </div>
        )}
        {t.telefone && (<div><dt className="font-semibold">Telefone</dt><dd>{t.telefone}</dd></div>)}
        {t.emailContato && (<div><dt className="font-semibold">E-mail</dt><dd><a className="underline" href={`mailto:${t.emailContato}`}>{t.emailContato}</a></dd></div>)}
        {endereco && (<div><dt className="font-semibold">Endereço</dt><dd>{endereco}</dd></div>)}
        {t.horario && (<div><dt className="font-semibold">Horário</dt><dd>{t.horario}</dd></div>)}
      </dl>
    </div>
  );
}
