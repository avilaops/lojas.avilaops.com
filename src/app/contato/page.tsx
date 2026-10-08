import type { Metadata } from "next";
import { contatoConfigurado, enderecoCompleto, exigirTenant, temaDo } from "@/lib/tenant";
import { mascararDocumento } from "@avilaops/checkout";
import { linkWhatsApp } from "@/components/WhatsAppFlutuante";
import { ArrowUpRight, Clock3, MapPin, MessageCircle, Phone, Mail } from "lucide-react";
import { contratoDo } from "@/lib/templates";
import { descricaoDaPagina } from "@/lib/textos-loja";

// Descrição própria: sem ela a página herdava a da loja, igual à da home.
export async function generateMetadata(): Promise<Metadata> {
  const t = await exigirTenant();
  return { title: "Contato", description: descricaoDaPagina(t, "contato"), alternates: { canonical: "/contato" } };
}

export default async function Contato() {
  const t = await exigirTenant();
  const endereco = t.enderecoPublico ? enderecoCompleto(t) : "";

  // Cada campo é opcional, e com todos vazios esta página servia um <h1> e uma
  // lista sem itens: nove caracteres de conteúdo. É o pior estado possível,
  // porque parece que a loja respondeu e não respondeu nada — e as políticas
  // mandam o comprador para cá justamente quando ele precisa de alguém.
  // Enquanto o lojista não preenche, a página diz o que sabe (quem é a
  // empresa) e admite o que falta, em vez de fingir uma resposta.
  if (!contatoConfigurado(t)) return (
    <div className="container-loja max-w-2xl py-10">
      <h1 className="text-2xl font-bold">Contato</h1>
      <p className="mt-4 text-sm text-muted-foreground">
        {t.razaoSocial ?? t.nome}
        {t.cnpj ? ` · CNPJ ${mascararDocumento(t.cnpj)}` : ""}
      </p>
      <p className="mt-4 text-sm">
        Os canais de atendimento desta loja ainda não foram publicados. Se você
        já fez um pedido, responda o e-mail de confirmação da compra — ele chega
        pelo endereço cadastrado no checkout e é o caminho mais rápido até nós.
      </p>
    </div>
  );

  if (contratoDo(temaDo(t)).escopo === "loja") return (
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
