# Auditoria SEO do catálogo Brilhax

Data: 24/10/2026.

## Escopo

O pedido mencionava 79 produtos. O sitemap público atual contém 87 URLs de
produto; a auditoria incluiu as 87 para não deixar produtos novos de fora.

## Verificação técnica das 87 URLs

- HTTP 200: 87 de 87.
- Canonical apontando para a própria URL oficial: 87 de 87.
- Imagem de produto: 87 de 87.
- Preço: 87 de 87.
- marcação `Product`: 87 de 87.
- política de devolução na oferta: 87 de 87.
- avaliações reais: 0 de 87; não foram fabricadas avaliações.
- `shippingDetails`: 0 de 87; o frete depende do CEP e não foi inventado.
- ficha com campo interno de integração exposto: 1 de 87, corrigido na regra
  compartilhada para impedir o problema no catálogo inteiro.

## Search Console

Período finalizado consultado: 24/07/2026 a 23/10/2026. A propriedade usada
foi `sc-domain:brilhax.com`.

As oportunidades mais próximas da primeira página estão concentradas em:

- Alumax 5 L: consultas por nome, marca e diluição.
- Glazy Anti-Fog: consultas por nome, marca e modo de uso.
- V-Mol 1,5 L: consultas por modo de uso.
- Removex Vintex: consultas por nome e marca.
- Rejuvex 400 g: consultas por nome, finalidade e modo de uso.
- Revelax: consultas por nome e "revelador de hologramas".
- Blend Spray: consultas por nome e modo de uso.
- Hidracouro: consultas por nome e modo de uso.
- Sintra Fast: consultas por nome e volume.

O histórico do Search Console ainda separa URLs com e sem barra final. As URLs
atuais declaram canonical sem barra e as variantes antigas redirecionam; a
consolidação depende de novo rastreio do Google.

## Correção aplicada

`VEHICLE_TYPE`, `UNITS_PER_PACK` e `categoriaGoogle` são dados auxiliares de
integração. A regra única da ficha agora os remove tanto da interface quanto do
`additionalProperty` do JSON-LD. NCM, modo de uso, aplicação, volume e demais
características reais permanecem públicos.

A renderização local foi conferida em
`brilhax-ficha-seo-2026-10-24.png`: a ficha mantém NCM, modo de uso e volume,
sem expor os três campos auxiliares.

## Limites factuais

- Nenhum código garante primeiro lugar orgânico.
- Avaliação só deve ser marcada depois de cliente real avaliar o produto.
- Prazo e custo de frete só devem entrar no schema quando houver regra
  declarada que produza valores verdadeiros para o destino consultado.
- Preço não foi alterado: isso exige decisão comercial da Brilhax.
