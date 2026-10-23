# Auditoria da Bereta Rodas — 18/10/2026

## Veredito

A vitrine tem uma boa base técnica e uma direção visual coerente com a marca,
mas ainda não é uma loja comercial. Hoje ela funciona como uma apresentação
institucional incompleta: não há produtos publicados, ofertas, estoque,
destaques ou páginas de produto. A aparência premium promete uma experiência
que o restante da jornada ainda não entrega.

Status técnico automatizado: **COM_PENDÊNCIAS**.
Prontidão comercial: **NÃO CERTIFICADA**.

## A imagem do topo

A imagem publicada é `https://bereta.avilaops.com/media/fachada.jpg`, uma foto
crua da fachada. No celular, o corte em `66% 100%` mantém carros, postes e fios
no campo visual e esconde parte do prédio. O resultado parece improvisado.

A arte enviada pelo cliente não deve ser aplicada como simples fundo porque já
contém `BERETA RODAS`, o slogan e o subtítulo. O componente atual desenha esses
mesmos textos em HTML; usar a arte pronta duplicaria o conteúdo, prejudicaria a
responsividade e reduziria a acessibilidade.

Solução recomendada:

1. produzir uma fotografia hero limpa, sem texto embutido, em duas composições;
2. usar versão horizontal para desktop e versão vertical para celular;
3. preservar título, texto e botões em HTML;
4. adicionar suporte a `bannerDesktopUrl`, `bannerMobileUrl`, posição focal e
   sobreposição configurável no tema;
5. otimizar os arquivos para AVIF/WebP responsivo em vez de servir o JPG
   original como `unoptimized`.

## Evidências verificadas

| Área | Resultado |
| --- | --- |
| Loja | Ativa, plano LOJA_PRO |
| Catálogo | 0 produtos totais e 0 ativos |
| Categorias | 4 cadastradas, todas com 0 produtos |
| Destaques | 0 |
| Produtos no sitemap | 0 |
| Merchant feed | HTTP 200, porém 0 ofertas |
| Pedidos | 0 |
| Domínio próprio | Não configurado |
| Instagram | Não configurado |
| Horário | Não configurado |
| SEO básico | Title, description, canonical, robots, sitemap e JSON-LD presentes |
| Estrutura da home | Um H1 e sem estouro horizontal em 390 px e 1440 px |
| Desempenho de laboratório | LCP aproximado de 2,9 s no mobile e 3,1 s no desktop; não é dado de campo |
| Estabilidade visual | CLS aproximado de 0,0007 no mobile e 0,0034 no desktop |
| Acessibilidade tátil | Vários controles abaixo de 44 px; menu 32×42, logo 34×34 e tema 36×36 no mobile |

## Achados críticos — P0

### 1. Catálogo vazio

O maior problema não é visual: a loja anuncia rodas e pneus, mas retorna
`0 produtos encontrados`. Busca, categorias, destaques, feed do Merchant,
carrinho e checkout ficam sem função comercial.

Desenvolver:

- importação do catálogo real por fornecedor/ERP/planilha;
- produto, variações e compatibilidade por veículo;
- preço, estoque, prazo e disponibilidade por SKU;
- fotos reais e padronizadas;
- publicação controlada e auditoria de divergências;
- destaques e campanhas alimentados por regras, não manualmente página a página.

### 2. Busca sem modelo automotivo

O texto promete busca por aro, furação, modelo e acabamento, mas não existe
catálogo para responder. Para ser referência, a seleção precisa aceitar:

- veículo: marca, modelo, versão e ano;
- roda: aro, tala, furação, offset/ET, cubo, acabamento e carga;
- pneu: largura, perfil, aro, índice de carga/velocidade, aplicação e tecnologia;
- placa, quando houver fonte licenciada e consentimento adequado;
- validação de compatibilidade e alerta explícito quando exigir adaptação.

### 3. Jornada de compra não homologável

Sem produto publicado, não foi possível validar carrinho, frete, pagamento,
estoque, retirada, instalação, cancelamento e pedido. A loja não deve ser tratada
como pronta até existir uma compra de homologação completa, sem capturar valor,
e uma compra real controlada com estorno documentado.

### 4. Hero e marca perdem qualidade no celular

- foto com carros, fios e poste compete com título e CTA;
- o logotipo horizontal fica pequeno demais no cabeçalho;
- o placeholder da busca é cortado;
- o botão secundário tem área de toque de apenas 14 px de altura;
- a barra inferior e o WhatsApp flutuante disputam o canto direito.

Desenvolver um cabeçalho responsivo com símbolo `B` no celular e wordmark no
desktop, além da direção de arte separada para o hero.

## Achados importantes — P1

### Conteúdo e posicionamento

- A mesma foto do Mustang é usada nas duas seções editoriais.
- O selo genérico `Imagem editorial` aparece para o público.
- O texto sobre microfibras, pincéis e cuidado de pintura pertence a uma loja de
  estética automotiva, não ao núcleo de rodas, pneus e montagem da Bereta.
- `Categorias` aparece no rodapé sem itens.
- O telefone aparece como `1732246358`, sem formatação e sem ação de ligação.
- Faltam horário, mapa, Instagram, marcas trabalhadas e garantias de serviço.

Substituir por conteúdo próprio:

- showroom, box, equipe e equipamentos;
- antes/depois de rodas e projetos entregues;
- marcas e linhas disponíveis;
- serviços de montagem, alinhamento, balanceamento e reforma;
- endereço, mapa, estacionamento, horário e canais de atendimento;
- política de garantia de produto e serviço em linguagem simples.

### Prova social e confiança

Desenvolver:

- avaliações reais do Google, com quantidade, nota e link de origem;
- galeria de projetos com veículo, aro, tala, pneu e acabamento;
- depoimentos autorizados e fotos reais;
- selos de pagamento, garantia e segurança apenas quando comprovados;
- página institucional com história, estrutura e equipe;
- FAQ técnico e comercial.

### Arquitetura de conversão

Criar três entradas claras:

1. **Encontrar para meu carro** — fluxo guiado por veículo e compatibilidade;
2. **Comprar por medida** — para quem já conhece aro, pneu ou furação;
3. **Montar meu projeto** — atendimento assistido com orçamento e agendamento.

O fluxo deve permitir salvar o veículo/garagem, comparar opções, montar o kit
roda + pneu + serviço, escolher retirada/instalação e agendar o box.

### Página de produto

Cada produto precisa de:

- galeria própria, zoom e imagens no veículo quando autorizadas;
- especificações completas e normalizadas;
- compatibilidade confirmada, condicional ou não confirmada;
- preço Pix e parcelado, disponibilidade e prazo;
- cálculo de frete/retirada antes do carrinho;
- garantia, devolução e cuidados;
- produtos relacionados e kit recomendado;
- `Product` + `Offer` coerentes com preço e estoque reais.

### Mobile e acessibilidade

- elevar alvos principais para pelo menos 44×44 px como meta de usabilidade;
- corrigir truncamento da busca e prioridade dos dois CTAs;
- remover sobreposição visual entre WhatsApp e navegação fixa;
- simplificar o rodapé móvel;
- testar foco, teclado, leitor de tela, contraste e redução de movimento;
- garantir que textos e ações funcionem em 320, 360, 390 e 430 px.

### Desempenho

- retirar `unoptimized` das imagens remotas ou colocar os ativos em CDN
  compatível com otimização;
- servir tamanhos responsivos e formatos modernos;
- pré-carregar somente o hero apropriado ao viewport;
- medir Core Web Vitals em campo, separados por página e dispositivo;
- definir orçamento: LCP ≤ 2,5 s, INP ≤ 200 ms e CLS ≤ 0,1 no percentil 75;
- eliminar rastreios abortados e erros de console quando forem reproduzíveis em
  navegação normal, sem confundir encerramento do teste com defeito do site.

## Descoberta e aquisição — P1/P2

### SEO e Google

A fundação técnica está presente, mas não há produtos para indexar. Depois do
catálogo:

- sitemap com categorias e produtos canônicos;
- Merchant Center com feed válido e sincronização de preço/estoque;
- marcação `Product`, `Offer`, frete, devolução e variantes;
- Search Console e relatórios de Merchant Listings monitorados;
- páginas locais para serviços reais em São José do Rio Preto;
- integração correta com Perfil da Empresa no Google;
- conteúdo técnico útil: medidas, furação, offset, tala, índices e cuidados.

### CRM e retenção

- captura consentida de orçamento abandonado;
- recuperação de carrinho;
- lembrete de manutenção, rodízio e alinhamento;
- pós-venda e pedido de avaliação após serviço concluído;
- segmentação por veículo e histórico, com opt-out e LGPD;
- painel de conversão por busca, produto, orçamento, WhatsApp e agendamento.

## Referências competitivas observadas

Os líderes atuais reduzem a incerteza antes de mostrar o catálogo. PneuStore
oferece busca por medida, veículo e placa, preços, parcelamento, montagem e rede
de parceiros. Achei Pneus combina busca por medida/veículo, estoque amplo,
benefícios comerciais, central de atendimento e centro de montagem.

A Bereta não precisa copiar escala nacional. Sua vantagem pode ser local e mais
especializada: compatibilidade precisa, curadoria premium, projeto visual,
instalação própria e prova real do resultado.

## Roadmap recomendado

### Fase 1 — Loja vendável

- catálogo real, categorias, fotos, preço e estoque;
- hero desktop/mobile e marca legível;
- conteúdo correto, telefone, horário, mapa e Instagram;
- frete, retirada, pagamento e checkout homologados;
- feed Merchant com ofertas e sitemap de produtos.

Critério de saída: compra ponta a ponta validada e nenhum CTA levando a página
vazia.

### Fase 2 — Especialista em rodas e pneus

- garagem/veículo;
- busca técnica por medida e compatibilidade;
- kits roda + pneu + montagem;
- orçamento assistido e agendamento do box;
- páginas de produto completas e comparação;
- garantias, FAQ e conteúdo técnico.

Critério de saída: o usuário consegue chegar a opções compatíveis sem depender
de conversa manual para descobrir o básico.

### Fase 3 — Autoridade regional

- avaliações e portfólio de projetos;
- SEO local e Perfil da Empresa;
- campanhas, recuperação de carrinho e pós-venda;
- dashboards de busca sem resultado, conversão e margem;
- testes A/B de hero, busca e orçamento;
- metas de Core Web Vitals e acessibilidade automatizadas no deploy.

Critério de saída: crescimento mensurável de tráfego qualificado, orçamentos,
agendamentos e vendas, com qualidade operacional estável.

## Pontos que já funcionam

- identidade escura/amarela coerente;
- favicon oficial publicado;
- estrutura sem overflow horizontal nos viewports testados;
- H1 único, canonical, robots, sitemap e JSON-LD válidos;
- CLS muito baixo no ensaio;
- endereço fiscal e políticas presentes;
- WhatsApp e retirada configurados.

## Conclusão

O site pode ficar visualmente forte rapidamente, mas “referência no setor” não
virá de mais decoração. A prioridade é transformar a promessa visual em uma
jornada especializada e verificável: catálogo real, compatibilidade, kit,
instalação, prova social e compra homologada. Sem isso, a home premium continua
sendo uma bela recepção para uma loja vazia.
