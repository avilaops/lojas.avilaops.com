# CI em etapas curtas

Todos os jobs de `Build e deploy` e `Merge automático` mantêm
`timeout-minutes: 1`. Timeout reprova o job; não há build ou teste nos servidores.

## Dependências e artefatos

`dependencias` instala o lockfile e gera o Prisma uma vez. Os consumidores
recebem esse arquivo da mesma execução, sem repetir `npm ci`.
O instalador oficial do ONNX usa `ONNXRUNTIME_NODE_INSTALL=skip` para dispensar
o download adicional de CUDA. O motor existente usa CPU e o pacote já inclui
esse binário; a sessão CPU continua verificada dentro da imagem final.
O arquivo Linux x64 não transfere os binários ONNX de Windows, macOS ou ARM.
O manifesto também exige a mesma plataforma, arquitetura e versão principal
do Node no consumidor.
`scripts/ci/artefato.mjs` vincula cada arquivo ao SHA, run e tentativa atuais e
valida SHA-256 antes da extração. Builds, navegador e modelo usam o mesmo
contrato. Os nomes de artefatos incluem o SHA e o download não informa outro run.
É necessário repetir a execução inteira ao mudar a tentativa: artefatos de uma
tentativa anterior são recusados, inclusive em rerun somente dos jobs falhos.

## Gates preservados

- Unitários: duas partes com todos os quatro grupos de arquivos de `npm test`.
- Qualidade: `next typegen` seguido de TypeScript, e ESLint em outro job.
- Payloads: testes do adaptador de artefatos, privacidade/observabilidade,
  contratos e consumidor de cupom com baseline explícito.
- Banco: PostgreSQL 18 isolado e migrations completas em cada uma das duas
  partes da integração, preservando todos os arquivos de `test:integracao`.
- Build: depende do gate de qualidade. A flag `LOJAS_CI_TIPOS_VERIFICADOS=1`
  evita repetir a checagem interna do Next somente no CI. Builds comuns
  continuam verificando tipos internamente.
- Navegador: Chromium headless da versão do lockfile; jornadas B2B, HTTP e
  reinício e jornadas de etiquetas continuam executando sobre o build real.
- PDFs: dimensões e leitura real dos códigos a 203 dpi.
- Experiments: versão fixada, inventário, compatibilidade, estrutura MLOps,
  consumidores e observações reais do banco e navegador.
- Modelo: download e verificação do hash do U2Netp existente no projeto.
- Imagem: depende de todos os gates, recebe o bundle compilado e confere a
  sessão ONNX dentro do runtime Linux antes de publicar.
- Deploy e fumaça: continuam exclusivos da main autorizada e da imagem por
  digest; preservam a proteção contra publicação de versão anterior.

O `Dockerfile` original permanece disponível com o fluxo completo de build.
`Dockerfile.ci` apenas empacota os arquivos produzidos pelo workflow aprovado;
seu contexto temporário não usa o `.dockerignore` de fontes, que exclui
`node_modules` e impediria incluir as dependências de runtime.

## Evidências

Cada parte do banco preserva seu TAP integral e os checks MLOps. O job de
contratos exige duas partes, concatena o TAP e recusa sobrescrita de checks ao
reunir observações do banco e do navegador. Os validadores existentes conferem
commit, run, plano e hashes antes de avaliar os resultados.

Os artefatos finais conservam os prefixos `lojas-contracts`, `lojas-runtime`,
`lojas-flow-observations`, `lojas-b2b-browser` e `lojas-etiquetas`. Arquivos de
preparação são retidos por sete dias. Sua existência não aprova nenhum gate.

## Referências

- [Artefatos entre jobs do GitHub Actions](https://docs.github.com/en/actions/tutorials/store-and-share-data).
- [Tipos gerados pelo Next](https://nextjs.org/docs/app/api-reference/cli/next#next-typegen-options).
- [Checagem externa de TypeScript](https://nextjs.org/docs/app/api-reference/config/next-config-js/typescript).
- [Chromium headless do Playwright](https://playwright.dev/docs/browsers#chromium-headless-shell).
