import { FERRAMENTAS } from "@/lib/mcp-permissoes";

/** A lista acompanha as permissões declaradas pelo conector. */
export default function FerramentasComDadosPessoais() {
  const ferramentas = Object.entries(FERRAMENTAS)
    .filter(([, ferramenta]) => ferramenta.escopo === "clientes:ler" || ferramenta.escopo === "pedidos:ler")
    .map(([nome]) => nome);
  return <>{ferramentas.map((nome, indice) => <span key={nome}>
    {indice > 0 ? (indice === ferramentas.length - 1 ? " e " : ", ") : ""}<code>{nome}</code>
  </span>)}</>;
}
