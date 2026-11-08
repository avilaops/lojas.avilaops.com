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

Implementado para revisão no PR
<https://github.com/avilaops/lojas.avilaops.com/pull/227>.
Builds e testes exclusivamente no GitHub CI; checks identificam o commit
verificado e o artefato `lojas-mdx-acesso-browser-<sha>` guarda screenshots
da Ajuda e da fixture do seletor em 360, 768 e 1440 px.
A fixture verifica apresentação; a busca tem testes unitários, e acesso real
autenticado continua dependente de conta autorizada. Nenhuma publicação em produção.

## Continuação local

Após a correção de escopo pelo proprietário, continuar somente nos arquivos
locais, sem novas operações Git. Refinamentos locais: índice recolhível com
capítulo atual, recuperação do seletor ao voltar pelo navegador, texto de
acesso alinhado ao SSO e prazo de teste importado da definição canônica.
Esses refinamentos ainda não foram validados na CI. Não executar suítes ou
build local contrariando a política do repositório.

## Refinamento visual local

Após feedback do proprietário com screenshot: Ajuda com abertura editorial,
atalhos por tarefa, capítulos em cartões, passos numerados e índice compacto
no celular. Cabeçalho público com menu acessível, fechamento por Esc/clique
externo e destaque da página atual. As URLs e os contratos de acesso permanecem.
A documentação de Desenvolvedores ainda não foi migrada nesta continuação;
o feedback visual da Ajuda passou a ser a prioridade.

## Próximas páginas — execução local

Na continuação seguinte, migrar `/developers` e `/developers/privacidade` para
MDX mantendo suas URLs. Compartilhar apresentação com cartões, índice de seções,
breadcrumbs e abas entre documentação e privacidade. Os componentes de referência
continuam lendo `indiceDaApi`, `FERRAMENTAS`, `RETENCAO_DIAS` e `VALIDADE` do código
existente; não copiar listas de rotas ou prazos como texto fixo.
Preservar o conteúdo da política de privacidade e não alterar autenticação,
permissões, retenção ou dados das lojas. Adaptar o smoke da CI para as duas páginas,
sem executar suítes locais nem realizar operações Git.

## Blog — continuação local

Migrar os sete artigos existentes de `src/lib/blog.ts` para arquivos MDX,
com índice de metadados separado para sitemap e scripts continuarem consumindo
TypeScript comum. Usar registro explícito de loaders, manter slugs, datas,
capas, metadados de compartilhamento e bloqueio de artigos futuros.
Renovar listagem e leitura com capas existentes, cartões, índice responsivo,
tempo de leitura e links de continuação. Preparar testes de agenda e integridade;
não executar suítes locais nem realizar operações Git.

## Painel — navegação e busca

O proprietário autorizou acessar o painel e continuar as melhorias. As
credenciais OIDC locais continuam ausentes; não criar uma sessão substituta.
Enquanto isso, compartilhar o mapa de navegação entre menu e busca, incluir
subseções e configurações e respeitar os recursos habilitados na loja.
Cancelar buscas antigas e informar estados de carregamento, falha e sessão
expirada. Usar diálogos nativos para foco modal e Esc; restaurar o foco ao
fechar. Expor Trocar loja à equipe por seu caminho já autorizado.

Conferência visual com componentes reais e dados fictícios em `.work`, sem
consultas ao banco ou uma rota de acesso alternativa. A prévia não representa
uma sessão autenticada. Testes preparados para a CI; sem execução local ou Git.

### Vitrine da Bereta Rodas — primeira etapa

Loja priorizada pelo proprietário: Bereta Rodas. Corrigir o reaproveitamento das
categorias quadradas da home no catálogo: navegação compacta, com rolagem lateral
no celular e indicação da categoria atual. Integrar a busca com sugestões à home
e ao cabeçalho das páginas internas do template automotivo premium. Ajustar CTA
de atendimento para escolha de produto e aplicação no veículo. Preservar marca,
preços, estoque, conteúdo e configurações da loja. Nenhuma alteração no banco.

Conferência visual de home e catálogo em 390 e 1440px, com requisições de escrita
bloqueadas e imagens públicas existentes. Capturas locais em TEMP com prefixo
bereta-depois. Sem build ou testes locais, sem Git ou publicação; validação
formal reservada ao CI conforme AGENTS.md.

### Bereta clara e conteúdo MDX

Refino solicitado: retirar a faixa fotográfica de categorias da home para
antecipar os produtos. Removidos renderização, cálculo e importação sem uso.
Categorias preservadas no menu e catálogo. Workflow Express; ajuste local.

Referência visual enviada: marcas sem cartões, sem legenda e com movimento
contínuo. Substituído o Trilho por faixa duplicada para loop CSS sem salto.
Cópia com aria-hidden e links fora da sequência de Tab; todas as logos visíveis
continuam clicáveis. Links originais conservam nomes acessíveis.
Pausa manual, hover e foco; movimento reduzido oferece rolagem nativa estática.
Título acessível continua vindo do MDX. Ajuste somente local.

Carrossel de marcas solicitado: reaproveitar Trilho (scroll nativo, setas,

Refino: proprietário solicitou todas em SVG. Seis PNGs convertidos em curvas
com VTracer e comparados visualmente aos originais. Cinco SVGs obtidos na web
preservados. Carrossel referencia somente SVG; SPW permanece como nome porque
não foi encontrada arte validada. Conversão documentada nas fontes, sem bitmap
embutido ou alegação de que os seis vetores gerados são originais oficiais.
teclado e movimento reduzido), com imagens locais e links originais por fabricante.
Título e selo no MDX da vitrine. Cinco vetores e seis PNGs obtidos; SPW conserva
nome até existir arte validada. Fontes registradas em public/marcas/automotivo/FONTES.md.
Sem alteração de banco, Git ou publicação. Conferência visual somente leitura.

Refino solicitado: remover o cartão genérico Tudo da faixa fotográfica da home.
Categorias reais ocupam a largura disponível, inclusive quando existem uma ou
duas categorias. O filtro Tudo do catálogo permanece compacto. Alteração local.

Pedido explícito: continuar melhorias com versão clara e MDX. Workflow Main:
ajustar tokens claros, contraste de seleção e navegação, preservar o banner e
amarelo da marca; acrescentar guia editorial em MDX junto aos destaques.
`src/content/vitrine/guia-automotivo.mdx` contém orientações sobre medida,
especificações e confirmação de aplicação, além dos textos dos destaques.

Prévia clara padrão somente para a loja indicada pela variável local
`LOJAS_PREVIA_TEMA_CLARO`; desativada em NODE_ENV=production. A preferência
explícita do visitante continua sendo respeitada. A configuração persistida
da Bereta e das demais lojas não foi editada. Para publicar a opção clara como
padrão, será necessário salvar a escolha pelo fluxo normal de tema da loja.
Revisão visual em 390 e 1440px, sem build, testes, Git ou publicação.
