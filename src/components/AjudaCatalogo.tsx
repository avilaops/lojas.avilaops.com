import { linkWhatsApp } from "@/components/WhatsAppFlutuante";

/** Leva a consulta já feita ao atendimento da própria loja. */
export default function AjudaCatalogo({ whatsapp, categoria, valores, tecnico }: {
  whatsapp: string | null;
  categoria?: string;
  valores: Record<string, string | undefined>;
  tecnico: boolean;
}) {
  if (!whatsapp) return null;
  const contexto = [
    categoria && `Categoria: ${categoria}`,
    valores.q?.trim() && `Busca: ${valores.q.trim()}`,
    valores.fabricante && `Marca: ${valores.fabricante}`,
    valores.perfil && `Perfil: ${valores.perfil}`,
    valores.material && `Material: ${valores.material}`,
    valores.dureza && `Dureza: ${valores.dureza}`,
    valores.vedacao && `Vedação: ${valores.vedacao}`,
  ].filter(Boolean);
  const medidas = [
    ["di", "Diâmetro interno"], ["de", "Diâmetro externo"],
    ["alt", "Altura"], ["esp", "Espessura"], ["sec", "Seção"],
    ["larg", "Largura"], ["comp", "Comprimento"],
  ].flatMap(([campo, rotulo]) => [
    valores[`${campo}_de`] && `${rotulo} mínimo: ${valores[`${campo}_de`]} mm`,
    valores[`${campo}_ate`] && `${rotulo} máximo: ${valores[`${campo}_ate`]} mm`,
  ]).filter(Boolean);
  const mensagem = [
    tecnico ? "Olá! Preciso de ajuda para identificar uma peça." : "Olá! Preciso de ajuda para escolher um produto.",
    ...contexto, ...medidas,
  ].join("\n");
  return (
    <a className="ajuda-catalogo" href={linkWhatsApp(whatsapp, mensagem)} target="_blank" rel="noopener noreferrer">
      {tecnico ? "Precisa de ajuda para identificar a peça?" : "Precisa de ajuda para escolher?"}
      <span>Fale com a loja pelo WhatsApp</span>
    </a>
  );
}
