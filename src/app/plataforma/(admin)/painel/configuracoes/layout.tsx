import CabecalhoConfiguracoes from "@/components/painel/CabecalhoConfiguracoes";
import { lojistaAtual } from "@/lib/sessao";
import { meiosAceitos, rotuloDosMeios } from "@/lib/recursos";

/** O subtítulo de Recebimento diz os meios que a loja aceita de verdade (só Pix, no Pix na conta). */
export default async function ConfiguracoesLayout({ children }: { children: React.ReactNode }) {
  const loja = await lojistaAtual();
  return <CabecalhoConfiguracoes meiosRecebimento={loja ? rotuloDosMeios(meiosAceitos(loja)) : undefined}>{children}</CabecalhoConfiguracoes>;
}
