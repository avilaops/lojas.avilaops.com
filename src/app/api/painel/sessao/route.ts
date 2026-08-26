import { lojistaAtual } from "@/lib/sessao";
import { urlDaLoja } from "@/lib/tenant";

/**
 * "Eu tenho loja e estou logado?"
 *
 * Existe para o wizard não mentir: se a criação deu certo mas a navegação
 * falhou (deploy no meio, rede oscilando), o cliente pergunta aqui antes de
 * mostrar erro — e vai para o painel em vez de tentar criar de novo.
 */
export async function GET() {
  const loja = await lojistaAtual();
  if (!loja) return Response.json({ logado: false });
  return Response.json({ logado: true, slug: loja.slug, url: urlDaLoja(loja) });
}
