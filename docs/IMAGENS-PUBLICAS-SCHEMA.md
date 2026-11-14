# Imagens públicas do schema • E-Commerce

Demanda `SCHEMA-IMAGENS-PUBLICAS-20261114`, responsável `codex`.

## Causa e contrato

A inspeção HTTP e de navegador da release `3d28fa3` em 14/11/2026 confirmou
que os logos configurados da Brilhax e Domi-Rio retornam 404, inclusive no
domínio próprio, sem variante e com parâmetro para evitar cache. O corpo
`não` coincide com a resposta ENOENT da rota pública de uploads. A leitura
administrativa do R2 não encontrou objetos sob os dois namespaces. A ausência
de mídias históricas já constava da recuperação de 13/11; este patch não
restaura arquivos, muda cadastros ou modifica infraestrutura.

As duas rotas próprias `/opengraph-image` responderam 200, `image/png`,
1200×630, sem `X-Robots-Tag`. A inspeção visual confirmou nome, slogan e
inicial da loja correta. Essa imagem existente passa a ser `Store.image`;
ela não é apresentada como um logotipo recuperado.

`logoPublicoParaSchema` verifica os uploads gerenciados pelo leitor de
armazenamento existente, limitado ao namespace público do mesmo tenant e
ao formato de caminho atendido por `/uploads`. Não consulta URLs arbitrárias,
subpastas privadas ou arquivos de outra loja. Arquivo vazio, ausente ou sem
leitura confirmada não gera o campo opcional `logo`. Isso não muda os erros
operacionais da rota de arquivos. Logos estáticos e externos cadastrados
mantêm seu tratamento anterior, sem nova consulta de rede.

`schemaDaIdentidadePublica` normaliza `logo` e `imagem` independentemente.
O layout informa a prévia OG canônica da própria loja. Preços, avaliações,
endereços, checkout, cadastros e links canônicos ficam sob suas fontes atuais.

## Verificação

Nenhum build ou teste local é permitido. A CI existente executará:

- Testes de objeto existente, ausente, indisponível e vazio; variante de imagem;
  isolamento de slug; recusa de caminho privado e travessia; ausência de fetch
  arbitrário para URLs externas.
- Regressão do schema separando imagem OG e logo, com normalização de URL.
- QA do build real com duas lojas fictícias: uma com upload presente e outra
  sem o objeto. Confere `logo` presente/omitido, OG 200 PNG 1200×630 e ausência
  de `noindex`, além das jornadas de descoberta e privacidade existentes.
- Gates existentes de tipos, lint, unitários, integrações, navegador e MLOps.

CI deste patch ainda não executada. Evidência HTTP de produção é separada
da aprovação da mudança e não autoriza publicação automática.

## Limites de cobertura

Fotos e ícones históricos ausentes permanecem uma limitação anterior desta
recuperação. A busca pelos nomes exatos dos dois logos no workspace encontrou
referências em relatórios e logs, sem arquivo de imagem correspondente.

Vinhos Imperial mantém canonical `https://vinhosimperial.com`. O domínio
`.com.br` redireciona ao `.com`. Ambos conduzem a uma loja que atualmente emite
`noindex, nofollow`, `robots.txt` com `Disallow: /` e `llms.txt` 404. O ARD 404
segue a mesma regra `visivelNaBusca`; a loja não está no conjunto de estados
ATIVA/SUSPENSA. Não se altera seu status ou sua indexação. Essas duas raízes
ficam registradas como indexação desabilitada, fora da cobertura pública atual.
