# Primeira etapa: MDX e navegação do Lojas

## Escopo autorizado

Iniciar a proposta apresentada: conteúdo editorial em MDX e componentes React
para operação. O usuário autorizou a execução e o uso de marketing-skills.
Esta etapa entrega Ajuda em MDX e seleção de lojas da equipe responsiva.
As demais aplicações e a integração com o CMS ficam fora deste primeiro recorte.

## Decisões

- Usar `@next/mdx` na mesma versão do Next instalado, compilando somente arquivos
  versionados. Conteúdo de usuários e do banco não será executado como MDX.
- Manter `/ajuda` e suas sete âncoras públicas. Preservar instruções existentes,
  removendo apenas promessas desatualizadas ou sem comprovação.
- Separar `/entrar/equipe` do layout comercial por route group. Preservar todas
  as verificações de SSO e o POST de abertura da sessão com auditoria existente.
- Buscar lojas por nome, slug e domínio no cliente, sem novas consultas ao banco.
- Usar tokens e ícones da marca existente, foco visível e alvos de pelo menos 44 px.
- Não executar migrações nem testes contra o banco de produção.

## Sequência

1. Registrar demanda e criar branch de trabalho preservando o ajuste local de
   instrumentation necessário para o servidor de desenvolvimento.
2. Escrever testes da busca: acentos, caixa, domínio, consulta vazia e ausência
   de resultados. Executar na CI, conforme a política do repositório.
3. Implementar seletor com campo rotulado, contador anunciado, limpar busca,
   cartões responsivos, estados vazios e bloqueio de envios duplicados.
4. Configurar MDX com componentes compartilhados; migrar Ajuda para conteúdo
   versionado com navegação por capítulos em desktop e mobile.
5. Abrir PR de rascunho para executar tipos, lint, testes e build na CI.
   Registrar resultado real, limitações e endereço de revisão.

## Verificação

- CI: testes de filtro, tipos, lint, compilação MDX e verificações existentes.
- Revisão: nenhuma mudança no contrato de autorização ou no POST de entrada;
  nenhuma rota duplicada; IDs de Ajuda preservados; estado sem resultado útil;
  leitura e navegação sem largura fixa em mobile.
- Publicação em produção depende da CI e do fluxo de entrega vigente. Uma
  alteração local ou um PR de rascunho não comprovam implantação em produção.

## Estado

Em implementação. Builds e testes exclusivamente no GitHub CI.
