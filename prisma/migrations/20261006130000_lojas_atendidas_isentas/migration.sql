-- Lojas atendidas pela Ávila Ops ficam fora da régua de cobrança.
--
-- A Brilhax e a Vedashow foram montadas por nós, não têm login do lojista e a
-- mensalidade delas não passa pela plataforma (ainda não conferimos pagamento
-- feito por fora). A régua (`verificarInadimplencia`) não tinha como saber
-- disso e suspendeu a Brilhax em 06/10/2026 — faixa amarela e checkout
-- desligado. A Vedashow só escapava da faixa por um `slug !== "vedashow"` no
-- layout, que sai junto com esta migração.
--
-- Isenção é dado (`cobrancaIsenta`, que `suspender()` respeita), não regra no
-- código. Idempotente: se o PATCH manual já rodou, nada muda. Só reativa quem
-- está SUSPENSA; loja cancelada continua cancelada.
UPDATE "Tenant" SET "cobrancaIsenta" = true WHERE slug IN ('brilhax', 'vedashow');
UPDATE "Tenant" SET status = 'ATIVA', "suspensaEm" = NULL WHERE slug IN ('brilhax', 'vedashow') AND status = 'SUSPENSA';
