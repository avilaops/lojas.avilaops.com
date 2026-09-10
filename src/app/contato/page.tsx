import type { Metadata } from "next";
import { enderecoCompleto, exigirTenant } from "@/lib/tenant";
import { linkWhatsApp } from "@/components/WhatsAppFlutuante";

export const metadata: Metadata = { title: "Contato" , alternates: { canonical: "/contato" } };

export default async function Contato() {
  const t = await exigirTenant();
  const endereco = t.enderecoPublico ? enderecoCompleto(t) : "";
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
