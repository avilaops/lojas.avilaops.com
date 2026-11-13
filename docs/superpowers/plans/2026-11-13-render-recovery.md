# Recuperar Lojas no padrão de Auth e webmail

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar o Lojas em TypeScript com os dados recuperados, usando Render, PostgreSQL próprio e R2, como as aplicações já recuperadas.

**Architecture:** Preservar Next.js, Prisma e PostgreSQL. Render executa exclusivamente artefato aprovado no GitHub CI. Cloudflare cuida do DNS e R2 persiste imagens e comprovantes; comprovantes e acervo fiscal continuam privados.

**Tech Stack:** Node 22, Next.js 16, TypeScript, PostgreSQL 18, Cloudflare R2, GitHub Actions e Render.

**Spec:** Orientação do proprietário em 13/11/2026: “faça igual as outras aplicações, mesmo padrão”. Referências verificadas: Auth e webmail em Render Free com PostgreSQL 18; o edge do ERP não corresponde a backend recuperado. Diagnóstico: documento Linear `8765b0b9-0131-41c6-a04f-dc86198cb8d7`.

## Global Constraints

- Builds e testes somente no GitHub CI; nenhum build local ou no servidor de aplicação.
- Backend permanece TypeScript/Next.js. Não converter PostgreSQL para D1.
- Restaurar em banco novo e com credencial própria; não sobrescrever bancos do Auth, mail ou portal.
- Segredos ficam fora do Git, dos logs e dos artefatos públicos.
- Publicar só após checagem do banco e smoke no destino. Não declarar mídias antigas recuperadas sem evidência.
- Serviços gratuitos de recuperação são temporários: o PostgreSQL atual informa expiração em 13/12/2026. Não contratar planos pagos sem autorização.

## Review Focus

- Uploads persistem após reinício e nenhum comprovante Pix é exposto pela rota pública.
- Falha do R2 deve ser erro operacional; não converter indisponibilidade em arquivo inexistente nem gravar silenciosamente em disco efêmero.
- O host original das lojas, cookies, sessão e callbacks precisam funcionar nos domínios reais.
- Restore não remove gatilhos, funções ou garantias financeiras, nem mantém permissões para usuários de outros bancos.
- Migrações novas só são aplicadas depois da aprovação do código correspondente no CI.

## Tasks

### 1. Banco restaurado e isolado

- [ ] Conferir extensões e privilégios disponíveis no PostgreSQL 18 de recuperação.
- [ ] Criar papel de login exclusivo e banco `lojas`; retirar CONNECT de PUBLIC somente nesse banco.
- [ ] Adaptar apenas ownership e ACL do dump para o papel próprio, preservando tabelas, dados, funções e gatilhos.
- [ ] Restaurar com erro fatal/rollback, conferir todas as contagens COPY, versões de migração, funções e gatilhos.

### 2. Persistência de arquivos fora do runtime

Files: `src/lib/armazenamento.ts`, `src/lib/uploads.ts`, `src/lib/imagens.ts`, `src/lib/pix-manual.ts`, `src/app/uploads/[...caminho]/route.ts`, `src/app/api/painel/imagens/route.ts`, testes em `src/lib/*.test.ts` e documentação de deploy.

- [ ] Escrever testes de persistência remota, falha fechada, travessia de diretórios, comprovante privado e erro distinto de 404; observar RED no CI.
- [ ] Implementar armazenamento R2 usando credencial restrita ou gateway autenticado com binding de bucket próprio.
- [ ] Manter modo em disco para ambientes existentes e testes que o configuram explicitamente.
- [ ] Conferir upload/leitura/exclusão e imagem variante no CI e persistência após reinício remoto.

### 3. Artefato e publicação Render

Files: `.github/workflows/deploy-production.yml`, `deploy/render/*`, `.env.example`, `.agents/equipe/controle.json`.

- [ ] Preservar gates de tipos, lint, testes, integração, navegador e imagem aprovada.
- [ ] Preparar entrega de artefato/imagem aprovado para Render, sem recompilar aplicação em Render.
- [ ] Desligar entrega SSH antiga para o novo destino. Manter rollback por release e SHA.
- [ ] Provisionar serviço gratuito e variáveis estritamente necessárias, mantendo a chave original do cofre.
- [ ] Verificar saúde real do banco, sessão, vitrine demo, upload e ausência de cache de comandos privados.

### 4. Domínios e evidências

- [ ] Registrar DNS anterior e só promover após smoke do destino.
- [ ] Atender domínio-base, subdomínios de lojas e domínios próprios sem confundir tenants.
- [ ] Registrar quais mídias antigas não foram recuperadas, janela do backup, expiração do banco e integrações externas não homologadas.
- [ ] Atualizar Linear, registro da equipe e relatório local com SHA, CI e recursos reais.
