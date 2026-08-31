import CabecalhoSecao from "@/components/painel/CabecalhoSecao";
import NavConfiguracoes from "@/components/painel/NavConfiguracoes";

export default function ConfiguracoesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CabecalhoSecao titulo="Configurações" descricao="Marca, entrega, recebimento, plano e dados da empresa." />
      <NavConfiguracoes />
      {children}
    </>
  );
}
