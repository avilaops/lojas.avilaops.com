# VedaShow — entrega da vitrine e busca técnica

## Origem e publicação

- Repositório: avilaops/lojas.avilaops.com. Base remota: PR 28, branch codex/vedashow-campaigns (6e57b24).
- Domínio: https://vedashow.com.br. SSH: applications. Container lojas-avilaops, porta 127.0.0.1:3080, código em /opt/lojas/app/lojas.avilaops.com.
- Build anterior em execução: 92RTppYHRALFeiWUPGZGL. Sem manifesto de revisão; não é possível atribuir um único commit com confiança. ProductCard e Distribuidora correspondiam ao estado de 94543c0, com alterações adicionais de produção em 29 arquivos existentes e MenuMobile. A cópia local main estava em 8118d22.
- Modo somenteImagem era passado pelo layout Distribuidora e removia nome, preço e ação; os atalhos também suprimiam o nome. 50e0a61 já restaurava parte disso, mas não estava publicado. Esta entrega incorpora a correção e preserva os ajustes do servidor (incluindo as vitrines automotivas de outras lojas).
- O 404 inicial não se reproduziu em nova aba do navegador. A origem respondeu 200 e depois o domínio também abriu na mesma sessão. Não há evidência para atribuir aquele 404 a uma falha persistente do servidor.

## Comportamento

Categorias com rótulos, seções nomeadas, oito produtos em grade completa, acesso ao catálogo e ajuda de busca. Os cards preservam proporção das imagens e mostram nome completo, SKU, referência, dimensões existentes, preço e disponibilidade. Sem preço: consulta. Sem estoque: ver disponibilidade. Nenhum preço, estoque ou atributo foi alterado.

Busca por nome, marca, SKU e referência usa o índice existente; a ordenação de relevância prioriza identificador exato (inclusive MPN de variante). Consulta de três medidas em mm aplica DI × DE × altura a atributos estruturados, preservando ordem e decimais. Frações e unidades imperiais não são convertidas. A API de sugestões usa a mesma busca da listagem. Filtros GET preservam estado e paginação; contagem e página derivam do mesmo conjunto filtrado. Facetas são isoladas por tenant e categoria.

O cadastro da VedaShow estava SUSPENSA/LOJA_PRO. A entrega preserva a situação comercial e o atendimento por WhatsApp, sem habilitar pagamento. Sugestões públicas também atendem esse catálogo, tal como a listagem já fazia.

## Lacunas reais do cadastro

Retentores: 1.792 itens com DI/altura, 1.765 com DE. Rolamentos: 1.290 ativos, apenas 50–55 com dimensões estruturadas. Correias: 95 ativos, 73 referências e apenas dois perfis cadastrados. O-rings: 741 ativos; uma seção de cordão explícita, enquanto os demais usam alturaMm do legado. Não se reinterpretou altura como espessura nem se calculou espessura por suposição. Os filtros mostram apenas atributos cadastrados; parte da família ficará de fora ao selecionar medida/perfil.

## Deploy e reversão

Build local standalone; scripts/empacotar.sh reúne static/public/prisma, binário ONNX Linux e manifesto public/versao.json (commit + BUILD_ID). Arquivos .env, temporários e evidências ficam fora do pacote. Envio por SCP e execução SSH de /opt/lojas/deploy.sh. A pasta app.anterior é o rollback automático do script. Antes da publicação, a pasta em execução também é copiada para rollback/vedashow-20260927.

Reversão manual: parar o container lojas pelo docker compose de /opt/lojas, mover app para um nome de falha ainda inexistente, restaurar app.anterior (ou a cópia nomeada), iniciar o compose e reconectar à rede odoo-avilaops_default. Conferir health, CSS e conteúdo da home.

GitHub Actions não iniciou a execução do PR por falha de faturamento/limite da conta (anotação do check image / build); não é resultado de teste. Verificações locais são registradas junto à entrega. O deploy autorizado segue SSH.

## Publicação concorrente preservada

Durante a validação, a entrega da Brilhax substituiu o build inicial por 91ONMw6C_SUm0nR5_GQHV. As alterações publicadas em Header, Automotivo, ProductCard, AddToCartButton e globals.css foram incorporadas antes de publicar a VedaShow. O backup rollback/vedashow-20260927 corresponde a essa versão mais recente.

Consultas sem texto usam paginação e contagem no banco. Buscas dimensionais pré-filtram candidatos pelo índice existente antes da comparação exata. Pares de medidas só correspondem a pares explícitos no nome e na mesma ordem; não se atribui significado técnico a cada número.
