-- Progresso por canal dentro de um evento.
--
-- Um evento pode mandar e-mail ao comprador e WhatsApp ao lojista. Sem esta
-- coluna, o segundo falhar obrigaria a escolher entre reenviar os dois (o
-- comprador recebe duas vezes) ou fechar o evento com metade feita (o lojista
-- nunca fica sabendo da venda). Com ela, a nova tentativa cumpre só o que
-- faltou.
--
-- Evento antigo nasce com a lista vazia: nenhum deles ficou pela metade, todos
-- foram executados pelo n8n de uma vez só.
ALTER TABLE "AutomacaoEvento"
  ADD COLUMN "canaisFeitos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
