-- Decisão da loja sobre crawlers de treinamento de IA (10/09/2026).
--
-- Separada de "aparecer na busca" de propósito: Googlebot e OAI-SearchBot
-- são sempre liberados em loja ativa; GPTBot, Google-Extended, ClaudeBot e
-- CCBot só entram se o lojista ligar. Padrão desligado: ninguém autoriza
-- treinamento por acidente, e não há ganho de busca em autorizar.
ALTER TABLE "Tenant" ADD COLUMN "permiteTreinamentoIa" BOOLEAN NOT NULL DEFAULT false;
