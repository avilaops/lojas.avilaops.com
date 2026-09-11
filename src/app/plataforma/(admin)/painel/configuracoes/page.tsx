import type { Metadata } from "next";
import ListaAgrupada from "@/components/aplicacao/ListaAgrupada";

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
            { href: "/painel/configuracoes/recebimento", titulo: "Recebimento", descricao: "Pix, cartão e boleto" },
          ],
        },
        {
          titulo: "Vender em outros lugares",
          itens: [
            { href: "/painel/configuracoes/canais", titulo: "Canais", descricao: "Mercado Livre e outros marketplaces" },
            { href: "/painel/configuracoes/descoberta", titulo: "Descoberta", descricao: "Google, Bing e assistentes de IA" },
            { href: "/painel/configuracoes/automacoes", titulo: "Automações", descricao: "Avisos por WhatsApp e e-mail: o que saiu e o que falhou" },
          ],
        },
        {
          titulo: "Conta",
          itens: [
            { href: "/painel/configuracoes/equipe", titulo: "Equipe", descricao: "Quem entra no painel e o que pode fazer" },
            { href: "/painel/configuracoes/assinatura", titulo: "Assinatura", descricao: "Plano e cobrança mensal" },
            { href: "/painel/configuracoes/conta", titulo: "Dados da empresa", descricao: "Razão social, CNPJ e senha" },
          ],
        },
      ]}
    />
  );
}
