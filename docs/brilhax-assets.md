# Imagens da Brilhax

Imagens geradas para a loja Brilhax, publicada como tenant da plataforma Lojas. Os arquivos em `public/media/brilhax/` ficam disponíveis sob `/media/brilhax/` depois do deploy.

## Arquivos

- `campanha-hero-desktop.webp` e `campanha-hero-mobile.webp`: campanha principal refeita, com a chamada incorporada à arte e enquadramentos próprios para desktop e celular.
- `banner-home-desktop.png` e `banner-home-mobile.png`: opções anteriores para o banner principal.
- `categoria-*.png`: imagens para as sete categorias da loja.
- `etapa-*.png`: imagens para conteúdo sobre lavagem, correção e proteção.
- `promocao-*.png`: fundos promocionais sem texto ou preço, para manter as ofertas editáveis.

## Integração com o tenant

- As campanhas da home são definidas em `Tenant.tema.campanhasHome`. Cada arte pode ter uma versão desktop e outra móvel, destino e texto alternativo. A primeira arte ocupa a abertura; as demais aparecem como cartões de campanha.
- O layout Automotivo entra no modo promocional quando há uma campanha configurada. A home prioriza banner, atalhos fotográficos e produtos, sem repetir a chamada da arte em texto separado.
- As imagens das categorias são definidas por `Categoria.imagemUrl`.
- O layout Automotivo Premium também aceita `tema.premium.editorialImagem` e `tema.premium.editorialImagemSecundaria`.

Fotos geradas não substituem as fotos reais das embalagens nos cards de produto.
