"use client";

import { usePathname } from "next/navigation";
import CabecalhoSecao from "@/components/painel/CabecalhoSecao";
import NavConfiguracoes from "@/components/painel/NavConfiguracoes";

/** O nome de cada seção, para o topo dizer onde a pessoa está. */
const NOME: Record<string, { titulo: string; descricao: string }> = {
  marca: { titulo: "Marca", descricao: "Direção, identidade visual, vitrine e contato." },
  dominio: { titulo: "Domínio", descricao: "O endereço próprio da sua loja." },
  entrega: { titulo: "Entrega", descricao: "Frete por CEP, prazo de envio e retirada." },
  recebimento: { titulo: "Recebimento", descricao: "Pix, cartão e boleto." },
  canais: { titulo: "Canais", descricao: "Vender também no Mercado Livre e em outros marketplaces." },
  equipe: { titulo: "Equipe", descricao: "Quem entra no painel e o que cada pessoa pode fazer." },
  assinatura: { titulo: "Assinatura", descricao: "Plano e cobrança mensal." },
  conta: { titulo: "Dados da empresa", descricao: "Razão social, CNPJ e senha de acesso." },
};

/**
 * O topo diz a seção, não "Configurações" repetido.
 *
 * No celular a navegação é por aprofundamento, e o caminho de volta já informa
 * de onde a pessoa veio: manter "Configurações" no título fazia a palavra
 * aparecer três vezes na mesma tela (barra, título e botão de voltar), sem
 * ninguém dizer em que seção ela está.
 */
export default function ConfiguracoesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const slug = pathname.split("/")[3] ?? "";
  const secao = NOME[slug];

  return (
    <>
      {/* O voltar vem antes do título, como numa pilha de navegação: primeiro
          de onde se veio, depois onde se está. */}
      <NavConfiguracoes />
      <CabecalhoSecao
        titulo={secao?.titulo ?? "Configurações"}
        descricao={secao?.descricao ?? "Marca, entrega, recebimento, plano e dados da empresa."}
      />
      {children}
    </>
  );
}
