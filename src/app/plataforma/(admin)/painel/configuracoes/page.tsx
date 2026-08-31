import { redirect } from "next/navigation";

/** Configurações não tem tela própria: abre na primeira sub-seção. */
export default function Pagina() {
  redirect("/painel/configuracoes/marca");
}
