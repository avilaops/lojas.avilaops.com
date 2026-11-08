# Fotos de rodas e pneus da Bereta

Em 08/11/2026 o proprietário solicitou pesquisa de imagens dos fabricantes e de
revendedores e autorizou commit/push direto na main, sem abrir PR.

## Inventário e critérios

O inventário identificou 7.806 rodas e pneus sem foto, dos quais 6.939 ativos.
Inclui cadastros antigos e sem identificação suficiente, além de usados e
serviços. O dossiê da pesquisa contém 791 associações revisadas visualmente.
Na primeira etapa, 362 associações foram aplicadas; as demais aguardam a versão
com os formatos de imagem adicionais habilitados. O resultado final de cada
execução permanece nos arquivos privados de operação, sem sobrescrever o
histórico quando a importação é retomada.

- Só marca, modelo completo e acabamento explícito permitem associar rodas.
- Medida sozinha, offset ou aplicação em determinado carro não identificam modelo.
- Pneus de gerações distintas não recebem a mesma imagem por nome parcial.
- Fotos de série são `representativa`, com família e origem registradas; não
  confirmam medidas, índices, furação ou quantidade de unidades por fotografia.
- Usados exigem imagem real do estado físico. Não substituir por foto de pneu novo.
- Imagens existentes, preços, estoque, categorias e ativação são preservados.

Um exemplo de divergência é o cadastro Accelera PH1 195/40 R17 91V: o catálogo
consultado do fabricante lista PHI 195/40 R17 81V. Não se confirma SKU exato por
essa semelhança e não se altera o cadastro comercial por inferência.

## Fontes consultadas

- https://kr-wheels.com/rodas/ e biblioteca pública de mídia.
- https://brwrodas.com.br e biblioteca pública de mídia.
- https://www.zunkyrodas.com/site/ e biblioteca pública de mídia.
- https://www.motorcrazy.com.br e biblioteca pública de mídia.
- https://www.pneufree.com.br/sitemap-produtos.xml — 4.900 páginas indexadas.
- https://www.allopneus.com/sitemap-modele.xml e sitemap-produits.xml.
- https://rodasdeligaleve.com.br/sitemap-produtos.xml — 1.718 páginas indexadas.
- https://www.bastosrodas.com.br/sitemap.xml e páginas de produtos.

As páginas públicas são lidas sem login, checkout ou ações nos sites de origem.
O arquivo obtido é baixado e otimizado na infraestrutura da loja; não depende
de hotlink. A origem consultada não é declaração de licença ou exclusividade.

## Aplicação e evidências

`scripts/catalogo/importar-fotos-revisadas.mjs` funciona em ensaio por padrão;
`--aplicar` exige revisão explícita no dossiê e usa a rota administrativa de
fotos. A API verifica identidade, SKU, versão e ausência de imagem e chama a
escrita canônica com auditoria. Nenhum campo de oferta é aceito pelo contrato.

Os arquivos operacionais ficam em `.work`, ignorada pelo Git, incluindo:

- `bereta-fotos-dossie-final.json`: associações, critérios e fontes por item.
- `bereta-fotos-lote-*.json.resultado.json`: resultado por produto/lote.
- `bereta-pendencias-fotos.csv`: pendências e motivo por produto.

As pranchas visuais de revisão ficam no TEMP da operação. Builds e testes
continuam exclusivos do GitHub CI. A CI também recebeu correções para aceitar
chunks CSS pequenos válidos e limitar a espera por cada espelho do modelo ONNX,
sem remover as verificações de integridade e identidade dos artefatos.

## Limites atuais

Após o levantamento, o proprietário determinou retirar produtos sem marca da
vitrine. Foram identificados 574 anúncios ativos de rodas/pneus nessa condição.
A operação usa desativação com histórico/outbox, preservando o cadastro e pedidos,
com backup privado antes da execução. O tema claro também foi salvo na loja
para refletir a versão visual já revisada, preservando as demais propriedades.

A preparação de dependências usa um artefato único verificado para reduzir o
custo de publicação. O lint foi dividido por páginas, componentes e restante,
mantendo a cobertura integral e o limite nativo de um minuto de cada job.

7.015 itens do inventário ainda não têm associação revisada: 34 exigem foto
própria e 6.981 permanecem pendentes. Entre os motivos registrados estão 1.407
cadastros sem fabricante, 1.552 rodas sem modelo identificado e 1.226 acabamentos
não confirmados. Nos demais casos não foi confirmada uma imagem nas fontes
consultadas ou faltam dados do pneu. A pesquisa e o lote revisado não representam
conclusão da cobertura de todas as fotos.

## Fotos próprias fornecidas pelo proprietário

O proprietário compartilhou 59 fotos no Google Drive e autorizou associação
visual sem confirmação do SKU físico. Essa autorização permite foto
representativa por família; não transforma medida, furação ou fabricante da
peça fotografada em informação confirmada.

O primeiro lote associou três fotografias a oito anúncios sem imagem:
Rotiform R140 RSE prata (4211, 4212), Giovanna cinco raios preta (4358, 4359)
e Orbital prata (159, 190, 8356, 616). A associação é visual e representativa;
os nomes e demais dados comerciais dos anúncios foram preservados.

Os arquivos originais foram armazenados na infraestrutura da loja, com hash
conferido após envio. Origem, nome do arquivo e critério ficam nos atributos;
a escrita canônica registra histórico e correspondência não confirmada. O
plano com retrato anterior e a conferência pública ficam em `.work/bereta-drive-*`.
As outras fotos ainda não foram publicadas por essa operação.
