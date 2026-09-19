# Imagens da Brilhax

Imagens geradas para a loja Brilhax, publicada como tenant da plataforma Lojas. Os arquivos em `public/media/brilhax/` ficam disponíveis sob `/media/brilhax/` depois do deploy.

## Arquivos

- `banner-home-desktop.png` e `banner-home-mobile.png`: opções para o banner principal.
- `categoria-*.png`: imagens para as sete categorias da loja.
- `etapa-*.png`: imagens para conteúdo sobre lavagem, correção e proteção.
- `promocao-*.png`: fundos promocionais sem texto ou preço, para manter as ofertas editáveis.

## Integração com o tenant

- O banner ativo é definido por `Tenant.bannerUrl`. Hoje esse campo aceita uma imagem por loja.
- As imagens das categorias são definidas por `Categoria.imagemUrl`.
- O layout Automotivo Premium também aceita `tema.premium.editorialImagem` e `tema.premium.editorialImagemSecundaria`.
- Não há campos dedicados para banner mobile ou cards promocionais. Esses arquivos ficam disponíveis para configuração compatível ou suporte futuro no layout.

Fotos geradas não substituem as fotos reais das embalagens nos cards de produto.
