import Link from "next/link";
import type { Tenant } from "@prisma/client";
import { enderecoCompleto, lojaVende } from "@/lib/tenant";
import { PreferenciasCookies } from "@/components/Consentimento";
import { pixelsDo, temRastreio } from "@/lib/pixels";
import { mascararDocumento } from "@avilaops/checkout";
import { AVISO_MEDICAMENTO, lerResponsavel, responsavelCompleto } from "@/lib/farmacia";
import { politicasPublicadas } from "@/lib/politicas";
import BandeirasPagamento from "@/components/BandeirasPagamento";

/**
 * Rodapé. O "Loja por Avila Ops" não é opcional nem negociável por desconto
 * (a C2TI dá R$ 20 de desconto para manter o logo; aqui é parte do produto):
 * cada loja no ar é um anúncio da plataforma.
 */
export default function Footer({ tenant, categorias }: { tenant: Tenant; categorias: Array<{ slug: string; nome: string }> }) {
  const avila = process.env.AVILAOPS_URL ?? "https://avilaops.com";
  // Loja só online não expõe onde fica o estoque no bloco de visita: endereço
  // é opt-in ali. Na linha de identificação abaixo ele aparece sempre, porque
  // o Decreto 7.962/2013 exige endereço físico de quem vende pela internet.
  const endereco = tenant.enderecoPublico ? enderecoCompleto(tenant) : "";
  const enderecoLegal = enderecoCompleto(tenant);
  const politicas = politicasPublicadas(tenant);
  /**
   * Farmácia virtual não é uma loja com produtos de farmácia: é um
   * estabelecimento regulado. A RDC 44/2009 (art. 55) exige que o site exiba o
   * farmacêutico responsável com o CRF e a licença sanitária, e a Lei 9.294/96
   * pede o aviso de medicamento em qualquer peça que os anuncie.
   *
   * Fica aqui, no rodapé que toda página monta, pelo mesmo motivo que o CNPJ
   * já fica: depender de o lojista escrever isso numa página "sobre" é depender
   * de ele lembrar, e quem descobre o esquecimento é a fiscalização.
   */
  const farmacia = tenant.segmento === "farmacia";
  const responsavel = lerResponsavel(tenant);

  const identificacao = [
    tenant.razaoSocial ?? tenant.nome,
    tenant.cnpj ? `CNPJ ${mascararDocumento(tenant.cnpj)}` : "",
    enderecoLegal,
    tenant.emailContato ?? "",
  ].filter(Boolean);
  return (
    <footer className="rodape-loja mt-20 border-t border-border bg-muted/50">
      <div className="container-loja grid gap-10 py-14 text-sm md:grid-cols-4">
        <div className="md:col-span-2">
          <p className="text-xl font-bold tracking-tight">{tenant.nome}</p>
          {tenant.slogan && <p className="mt-1 text-muted-foreground">{tenant.slogan}</p>}
          {endereco && <p className="mt-3 text-muted-foreground">{endereco}</p>}
          {tenant.horario && <p className="text-muted-foreground">{tenant.horario}</p>}
          {tenant.telefone && <p className="text-muted-foreground">{tenant.telefone}</p>}
        </div>
        <div>
          <p className="mb-2 font-semibold">Categorias</p>
          <ul className="space-y-1 text-muted-foreground">
            {categorias.slice(0, 8).map((c) => (
              <li key={c.slug}>
                <Link href={`/categoria/${c.slug}`}>{c.nome}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-2 font-semibold">A loja</p>
          <ul className="space-y-1 text-muted-foreground">
            <li><Link href="/sobre">Sobre</Link></li>
            <li><Link href="/contato">Contato</Link></li>
            <li><Link href="/blog">Blog</Link></li>
            {/* A lista de políticas é a que a loja realmente publica: link fixo
                aqui viraria 404 no aviso legal, que só existe quando escrito. */}
            {politicas.map((p) => (
              <li key={p.tipo}><Link href={`/politicas/${p.tipo}`}>{p.titulo}</Link></li>
            ))}
            {tenant.instagram && (
              <li>
                <a href={tenant.instagram} target="_blank" rel="noopener">Instagram</a>
              </li>
            )}
          </ul>
        </div>
      </div>
      {farmacia && (
        <div className="rodape-farmacia border-t border-border">
          <div className="container-loja py-5 text-xs text-muted-foreground">
            {responsavelCompleto(responsavel) ? (
              <p>
                Farmacêutico(a) responsável: <strong>{responsavel.nome}</strong> · {responsavel.crf}
                {responsavel.licencaSanitaria && <> · Licença sanitária {responsavel.licencaSanitaria}</>}
                {responsavel.autorizacaoAnvisa && <> · AFE {responsavel.autorizacaoAnvisa}</>}
              </p>
            ) : (
              // Sem responsável cadastrado o rodapé não inventa um nome nem
              // finge que está tudo certo: fica o aviso legal, que vale sempre,
              // e o painel cobra o resto de quem pode preencher.
              null
            )}
            <p className="rodape-farmacia-aviso">{AVISO_MEDICAMENTO}</p>
          </div>
        </div>
      )}
      {/* Só onde há checkout: numa vitrine do plano SITE a lista prometeria um
          pagamento que a loja não processa. */}
      {lojaVende(tenant) && <BandeirasPagamento meios={tenant.meiosPagamento} />}
      <div className="border-t border-border">
        <div className="container-loja flex flex-col items-center justify-between gap-2 py-4 text-xs text-muted-foreground sm:flex-row">
          <span>
            © {new Date().getFullYear()} {identificacao.join(" · ")}
            {temRastreio(pixelsDo(tenant)) && (
              <>
                {" · "}
                <PreferenciasCookies />
              </>
            )}
          </span>
          <a href={avila} target="_blank" rel="noopener" className="font-semibold hover:text-foreground">
            Loja por Avila Ops
          </a>
        </div>
      </div>
    </footer>
  );
}
