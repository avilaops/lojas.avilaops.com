import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-loja py-20 text-center">
      <h1 className="text-2xl font-bold">Página não encontrada</h1>
      <Link href="/" className="btn-primario mt-6">Voltar ao início</Link>
    </div>
  );
}
