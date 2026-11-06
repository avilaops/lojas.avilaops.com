import { MessageCircle } from "lucide-react";
import { numeroDeContato } from "@/lib/canais-publicos";

export function linkWhatsApp(numero: string, texto: string) {
  const destino = numeroDeContato(numero);
  return destino ? `https://wa.me/${destino.replace(/^\+/, "")}?text=${encodeURIComponent(texto)}` : "/contato";
}

export default function WhatsAppFlutuante({ numero, nome }: { numero: string; nome: string }) {
  if (!numeroDeContato(numero)) return null;
  return (
    <a
      href={linkWhatsApp(numero, `Olá, ${nome}! Vim pelo site.`)}
      target="_blank"
      rel="noopener"
      aria-label="Falar no WhatsApp"
      // A distância de baixo mora no CSS (`.whatsapp-flutuante`), não aqui: ela
      // respeita a área segura do iPhone, precisa subir acima da barra inferior
      // no celular e sair de cena onde o card já oferece orçamento — e `style`
      // inline ganharia das duas regras de @media.
      className="whatsapp-flutuante fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition hover:scale-105 sm:right-5"
    >
      <MessageCircle className="h-7 w-7" />
    </a>
  );
}
