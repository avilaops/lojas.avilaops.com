import type { Metadata } from "next";
import Conteudo, { capitulos } from "@/content/developers.mdx";
import PaginaDocumentacao from "@/components/plataforma/PaginaDocumentacao";

export const metadata: Metadata = {
  title: "Desenvolvedores & IA",
  description: "Documentação do conector MCP e da API para integrar a loja a um assistente de IA, a um ERP ou a um site próprio.",
  alternates: { canonical: "https://lojas.avilaops.com/developers" },
};

export default function DevelopersPage() {
  return <PaginaDocumentacao tipo="tecnica" titulo="Integre sua loja com IA e API."
    descricao="Conecte um assistente de IA ou integre seu sistema pela API. Endereços, permissões e formatos para começar."
    capitulos={capitulos}><Conteudo /></PaginaDocumentacao>;
}
