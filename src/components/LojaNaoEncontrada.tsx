export default function LojaNaoEncontrada() {
  const avila = process.env.AVILAOPS_URL ?? "https://avilaops.com";
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">lojas.avilaops.com</p>
      <h1 className="text-2xl font-bold">Nenhuma loja responde por este endereço.</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Se você é o dono deste domínio, o DNS ainda não terminou de apontar ou a loja foi encerrada.
      </p>
      <a className="btn-secundario" href={avila}>
        Quero uma loja assim
      </a>
    </div>
  );
}
