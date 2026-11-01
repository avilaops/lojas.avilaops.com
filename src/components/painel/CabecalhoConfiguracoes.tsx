"use client";

import { usePathname } from "next/navigation";
import CabecalhoSecao from "@/components/painel/CabecalhoSecao";
import NavConfiguracoes from "@/components/painel/NavConfiguracoes";
import styles from "./IndiceConfiguracoes.module.css";

/** O nome de cada seção, para o topo dizer onde a pessoa está. */
const NOME: Record<string, { titulo: string; descricao: string }> = {
  fiscal: { titulo: "Notas fiscais", descricao: "Certificado digital e documentos fiscais do CNPJ." },
  marca: { titulo: "Marca", descricao: "Direção, identidade visual, vitrine e contato." },
  dominio: { titulo: "Domínio", descricao: "O endereço próprio da sua loja." },
  entrega: { titulo: "Entrega", descricao: "Frete por CEP, prazo de envio e retirada." },
  recebimento: { titulo: "Pagamentos", descricao: "Pix, cartão e boleto." },
  canais: { titulo: "Marketplaces", descricao: "Vender também no Mercado Livre e em outros marketplaces." },
  descoberta: { titulo: "SEO e buscadores", descricao: "Como a loja aparece no Google, no Bing e nos assistentes de IA." },
  automacoes: { titulo: "Automações", descricao: "Os avisos que a loja dispara, e se cada um saiu." },
  equipe: { titulo: "Equipe", descricao: "Quem entra no painel e o que cada pessoa pode fazer." },
  assinatura: { titulo: "Assinatura", descricao: "Plano e cobrança mensal." },
  conta: { titulo: "Dados da empresa", descricao: "Razão social e CNPJ." },
};

/**
 * O topo diz a seção, não "Configurações" repetido.
 *
 * No celular a navegação é por aprofundamento, e o caminho de volta já informa
 * de onde a pessoa veio: manter "Configurações" no título fazia a palavra
 * aparecer três vezes na mesma tela (barra, título e botão de voltar), sem
 * ninguém dizer em que seção ela está.
 */
export default function CabecalhoConfiguracoes({ children, meiosRecebimento }: { children: React.ReactNode; meiosRecebimento?: string }) {
  const pathname = usePathname().replace(/^\/plataforma(?=\/|$)/, "");
  const slug = pathname.split("/")[3] ?? "";
  const secao = slug === "recebimento" && meiosRecebimento ? { ...NOME.recebimento, descricao: meiosRecebimento } : NOME[slug];

  return (
    <>
      {/* O voltar vem antes do título, como numa pilha de navegação: primeiro
          de onde se veio, depois onde se está. */}
      <NavConfiguracoes />
      <div className={slug ? undefined : styles.cabecalho}>
        <CabecalhoSecao
          titulo={secao?.titulo ?? "Configurações"}
          descricao={secao?.descricao ?? "Gerencie sua loja e suas integrações."}
        />
      </div>
      {children}
    </>
  );
}
