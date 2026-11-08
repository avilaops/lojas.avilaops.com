import Image from "next/image";

/** Fotos próprias por família; nenhuma dimensão ou referência é inferida da imagem. */
export default function FotosPk() {
  return <section className="container-loja py-10" aria-labelledby="fotos-pk">
    <h2 id="fotos-pk" className="text-2xl font-bold">Perfis e detalhes dos produtos</h2>
    <p className="mt-3 max-w-3xl text-muted-foreground">Fotos do acervo PK para observar formatos e detalhes. A ficha de cada referência informa as medidas e o material para a sua seleção.</p>
    <div className="mt-6 grid gap-6 sm:grid-cols-2">
      {[
        { arquivo: "perfis-azuis.jpg", legenda: "Detalhes de perfis de vedação" },
        { arquivo: "perfis-coloridos.jpg", legenda: "Diversidade de formatos de vedação" },
      ].map(foto => <figure key={foto.arquivo} className="overflow-hidden rounded-xl border border-border">
        <Image src={`/media/pkvedacoes/${foto.arquivo}`} alt={foto.legenda} width={800} height={600} className="aspect-[4/3] w-full object-contain" sizes="(max-width: 640px) 100vw, 50vw" />
        <figcaption className="p-4 text-sm">{foto.legenda}. Imagem representativa de família; cor e formato não identificam material ou medida.</figcaption>
      </figure>)}
    </div>
  </section>;
}
