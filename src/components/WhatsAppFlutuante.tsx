import { MessageCircle } from "lucide-react";

export function linkWhatsApp(numero: string, texto: string) {
  return `https://wa.me/${numero.replace(/\D/g, "")}?text=${encodeURIComponent(texto)}`;
}

export default function WhatsAppFlutuante({ numero, nome }: { numero: string; nome: string }) {
  return (
    <a
      href={linkWhatsApp(numero, `Olá, ${nome}! Vim pelo site.`)}
      target="_blank"
      rel="noopener"
      aria-label="Falar no WhatsApp"
      // A distância de baixo respeita a área segura do iPhone: com `bottom` fixo
      // o botão encosta na barra inicial do aparelho e fica difícil de acertar.
      style={{ bottom: "max(1.25rem, calc(env(safe-area-inset-bottom) + 0.75rem))" }}
      className="whatsapp-flutuante fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition hover:scale-105 sm:right-5"
    >
      <MessageCircle className="h-7 w-7" />
    </a>
  );
}
