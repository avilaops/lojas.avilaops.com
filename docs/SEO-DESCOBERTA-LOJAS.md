# SEO e descoberta • módulo próprio do Lojas

O módulo fica em Configurações • SEO e descoberta, no caminho já existente `/painel/configuracoes/descoberta`. Usa a identidade e as permissões do Lojas. Dono e gerente editam; operador consulta. Não depende de WordPress, AIOSEO nem serviços pagos de IA.

## Controles

• Título e descrição da página inicial. Campos vazios retomam a redação automática; a prévia não grava antes de salvar. O título manual é absoluto no Next para não receber a marca duas vezes. As demais páginas mantêm seus metadados específicos.

• Inclusão e limite de produtos de destaque no resumo llms.txt. O padrão mantém os12 destaques atuais; a seleção vai de1 a20. Desmarcar retira somente essa seção do resumo, preservando categorias, informações da loja, catálogo completo, políticas, sitemap e documentos de descoberta.

• Treinamento de modelos de IA continua separado das permissões de busca e da publicação dos resumos. O padrão continua desligado.

O robots.txt declara `Content-Signal` para busca, entrada em respostas de IA e treinamento. Nas lojas públicas, busca e entrada ficam permitidas e treinamento segue a escolha salva; lojas canceladas/em provisionamento e hosts desconhecidos declaram as três categorias negadas. Na plataforma, as três categorias são permitidas por decisão explícita do proprietário. As regras privadas e os grupos de robôs permanecem. A diretiva é publicada por uma rota textual, preservando a URL `/robots.txt`.

• O painel mostra o endereço oficial, a configuração de rastreamento e atalhos para os documentos públicos. Não afirma que a loja está indexada, não atribui nota e não promete posição ou citação por assistentes.

## Fonte e dados

`Tenant.configuracaoSeo` é JSONB com default{}. `src/lib/seo-config.ts` contém o contrato e as funções puras. `src/lib/seo-inicio.ts` resolve a redação automática e manual para a home e para a prévia do painel, preservando as regras existentes de Domi-Rio e do layout industrial.

O formulário envia apenas os campos alterados à API existente `/api/painel/loja`. A loja vem da sessão, nunca do corpo. A escrita serializa o merge por tenant em transação PostgreSQL e retorna os valores confirmados ao formulário. O treinamento só é enviado quando foi alterado.

A migração é aditiva. Sem salvar uma preferência, lojas existentes mantêm os títulos, descrições, destaques e política de treinamento anteriores. Nenhum produto, preço, imagem, DNS, rastreador ou arquivo R2 é alterado pelo módulo.

## Verificação

Builds e testes exclusivamente no GitHub CI. O contrato cobre defaults, dados antigos inválidos, validação, merge, fallback de metadados e seleção de destaques. `scripts/qa-seo-descoberta.mts` usa banco isolado e servidor compilado para conferir formulário/prévia, persistência, metadados publicados, resumo, duas lojas, PATCHs concorrentes, operador/visitante sem permissão, retorno ao automático e telas1440/393px.

As capturas e evidências ficam no artefato `lojas-seo-descoberta-browser-<sha>`. Casos fictícios não representam lojas reais. A conferência de produção deve ler configurações existentes sem alterar preferências de clientes para demonstrar a funcionalidade.

Referências: https://llmstxt.org/ • https://developers.google.com/search/docs/appearance/title-link • https://developers.google.com/search/docs/appearance/snippet. As orientações de comprimento são sugestões de redação, não limites de classificação dos buscadores.
