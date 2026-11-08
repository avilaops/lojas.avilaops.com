# Jornada visual PK — Implementation Plan

**Goal:** transformar a jornada aprovada em um mapa navegável, da identificação à cotação, exclusivo PK.

**Architecture:** componentes React e HTML semântico responsivo, com caminhos por código, amostra ou aplicação; agrupamento dos dez segmentos em cinco finalidades. Diagramas Mermaid versionados documentam a mesma jornada. Sem serviço externo de renderização nem nova dependência no navegador.

**Tech Stack:** Next.js, React, Tailwind e Mermaid documental existentes.

**Spec:** fluxograma e mapa mental aprovados na conversa: identificar, entender, conferir, cotar; produção, cultivo, construção, movimentação e infraestrutura.

## Tarefas

- [ ] Dados das três entradas e cinco grupos; verificar cobertura sem duplicação dos dez segmentos.
- [ ] Mapa navegável e página /como-escolher: seleção acessível, links reais, quatro etapas e orientação técnica.
- [ ] Integrar home, índice de aplicações, cabeçalho, rodapé, sitemap e llms.txt somente PK.
- [ ] Versionar fluxograma e mindmap Mermaid da jornada aprovada.
- [ ] Ampliar o navegador CI para entradas, teclado, rotas e telas 390/1440; revisão final.
- [ ] Publicar por PR/CI e conferir o domínio público.

## Restrições e decisões

Somente GitHub CI para testes, lint, tipos e build (AGENTS.md). Os arquivos locais da entrega anterior permanecem preservados; o commit remoto é montado sobre a main atual com somente os arquivos desta tarefa. Não se cria pedido nem se envia mensagem automaticamente. Diagramas representam orientação; a confirmação técnica depende de material, perfil e condições do equipamento. A interface usa HTML acessível para manter links, textos legíveis e navegação no celular; Mermaid permanece como representação versionada e editável.

Ruling: preservar os timeouts de entrega e deploy. O teste scripts/ci/entregar-imagem.test.mjs explicita a política Linear de um minuto para esses jobs. A tarefa permanece restrita à jornada visual; se necessário, a entrega idempotente pode ser repetida sem ampliar o escopo de infraestrutura.
