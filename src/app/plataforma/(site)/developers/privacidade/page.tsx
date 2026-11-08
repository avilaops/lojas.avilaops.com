import type { Metadata } from "next";
import Conteudo, { capitulos } from "@/content/privacidade-conector.mdx";
import PaginaDocumentacao from "@/components/plataforma/PaginaDocumentacao";

export const metadata: Metadata = {
  title: "Privacidade do conector de IA",
  description: "Que dados o conector MCP da loja lê, guarda e por quanto tempo, quando um assistente de IA como o Claude opera a loja.",
  alternates: { canonical: "https://lojas.avilaops.com/developers/privacidade" },
};

export default function PrivacidadeDoConectorPage() {
  return <PaginaDocumentacao tipo="privacidade" titulo="Como o conector trata seus dados."
    descricao="Entenda o que o assistente pode consultar, como o acesso é autorizado e quais informações ficam guardadas pelo conector."
    capitulos={capitulos}><Conteudo /></PaginaDocumentacao>;
}
