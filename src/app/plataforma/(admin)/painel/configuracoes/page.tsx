import type { Metadata } from "next";
import ListaAgrupada from "@/components/painel/IndiceConfiguracoes";

export const metadata: Metadata = { title: "Configurações | Painel", robots: { index: false } };

/**
 * O índice de Configurações.
 *
 * Antes esta rota redirecionava direto para Marca, e a navegação entre seções
 * era uma barra horizontal de sete abas que terminava cortada em 393px: para
 * chegar em "Recebimento" a pessoa arrastava uma navegação sem sinal de que
 * continua, e arrastava de volta para trocar.
 *
 * Agora existe uma tela de entrada, com o que cada seção resolve escrito na
 * língua do lojista. No computador a barra vira coluna lateral e esta página
 * segue valendo como visão geral.
 */
export default function Pagina() {
  return (
    <ListaAgrupada
      grupos={[
        {
          titulo: "A loja",
          itens: [
            { href: "/painel/configuracoes/marca", titulo: "Marca", descricao: "Nome, logo, cores e texto de apresentação" },
            { href: "/painel/configuracoes/dominio", titulo: "Domínio", descricao: "Endereço próprio da sua loja" },
            { href: "/painel/configuracoes/entrega", titulo: "Entrega", descricao: "Frete por CEP, prazo e retirada" },
            { href: "/painel/configuracoes/recebimento", titulo: "Pagamentos", descricao: "Pix, cartão e boleto" },
            { href: "/painel/configuracoes/fiscal", titulo: "Notas fiscais", descricao: "Certificado A1 e consulta de NF-e do CNPJ" },
          ],
        },
        {
          titulo: "Conteúdo da loja",
          itens: [
            { href: "/painel/configuracoes/politicas", titulo: "Políticas", descricao: "Trocas, privacidade e termos" },
            { href: "/painel/configuracoes/campos", titulo: "Campos do produto", descricao: "Informações adicionais dos produtos" },
            { href: "/painel/marketing/blog", titulo: "Blog", descricao: "Artigos e publicações da loja" },
          ],
        },
        {
          titulo: "Integrações e divulgação",
          itens: [
            { href: "/painel/configuracoes/canais", titulo: "Marketplaces", descricao: "Mercado Livre e outros marketplaces" },
            { href: "/painel/configuracoes/descoberta", titulo: "SEO e buscadores", descricao: "Google, Bing e assistentes de IA" },
            { href: "/painel/configuracoes/automacoes", titulo: "Automações", descricao: "Avisos por WhatsApp e e-mail" },
          ],
        },
        {
          titulo: "Conta",
          itens: [
            { href: "/painel/configuracoes/equipe", titulo: "Equipe", descricao: "Quem entra no painel e o que pode fazer" },
            { href: "/painel/configuracoes/assinatura", titulo: "Assinatura", descricao: "Plano e cobrança mensal" },
            { href: "/painel/configuracoes/conta", titulo: "Dados da empresa", descricao: "Razão social e CNPJ" },
          ],
        },
      ]}
    />
  );
}
