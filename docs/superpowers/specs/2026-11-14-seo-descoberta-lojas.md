# SEO e descoberta • módulo próprio do Lojas

O usuário pediu uma solução nossa, do nosso jeito, após usar AIOSEO e a lista de integrações llmstxt.org como referência. A decisão técnica é entregar um módulo nativo do Lojas, na seção já existente do painel, aproveitando seus geradores e sua identidade. Não haverá dependência de WordPress, AIOSEO ou um segundo gerador de arquivos.

## Primeira entrega funcional

• Editar título e descrição da página inicial, com prévia ilustrativa, contadores e orientações. Campos vazios usam os valores automáticos existentes. Outras páginas mantêm seus metadados específicos.

• Escolher se os produtos de destaque aparecem no resumo llms.txt e o limite entre1 e20. O padrão mantém os12 produtos atuais. Categorias, política pública, llms-full.txt e sitemap continuam funcionando automaticamente.

• Mostrar domínio oficial, disponibilidade para busca e atalhos dos documentos públicos. Configuração permitida não comprova indexação, leitura por agentes nem classificação no Google; nenhum placar ou garantia será inventado.

• Preservar a decisão independente de treinamento de IA, desligada por padrão, e os mecanismos públicos de descoberta/WebMCP já publicados.

• Usar o caminho existente /painel/configuracoes/descoberta, com nome SEO e descoberta, interface própria da plataforma e formulário acessível em393px e desktop. Dono e gerente podem salvar; operador consulta.

## Arquitetura

Tenant.configuracaoSeo será JSONB não nulo com default{}. Migração aditiva mantém todos os comportamentos atuais. Um contrato Zod valida os quatro campos; PATCH parcial faz merge dos valores, por tenant. A API existente de configuração continua responsável por sessão e permissão. A leitura normaliza entradas antigas ou malformadas para padrões seguros.

Funções puras resolvem configuração, metadados e orientações. Um adaptador do servidor reaproveita as regras automáticas existentes, inclusive Domi-Rio e layout industrial, para que a prévia e a home usem a mesma fonte. O gerador llms.txt só muda a seleção de destaques; zero produtos implica nenhuma consulta desnecessária ao catálogo.

O módulo não altera produtos, preços, catálogo, arquivos R2, rastreamento, DNS ou consentimento. Nenhuma chamada paga de IA ou biblioteca adicional é necessária.

## Alternativas consideradas

Extensão WordPress/AIOSEO exigiria um runtime que o Lojas não utiliza. Uma contribuição à lista llmstxt.org não entrega controles aos lojistas. Um gerador paralelo duplicaria a política pública e poderia divergir dos preços e páginas reais. O módulo nativo atende à orientação do usuário e reaproveita o que já existe; limites e interface iniciais são escolhas de implementação do agente.

## Verificação

Testes e builds exclusivamente no GitHub CI. Primeiro registrar RED das funções novas; depois validar contrato, persistência/merge, metadados, arquivos públicos, permissões, isolamento de duas lojas e navegador real. Fixtures são fictícias e ficam no banco isolado de CI. Screenshots desktop/mobile do painel serão artefatos revisáveis. Publicação normal somente após checks e revisão do diff.

Fontes técnicas: https://llmstxt.org/ • https://developers.google.com/search/docs/appearance/title-link • https://developers.google.com/search/docs/appearance/snippet. Comprimentos são orientações de redação, não limites de classificação impostos pelo Google.
