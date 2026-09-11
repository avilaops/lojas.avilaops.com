-- Um FALHOU só reabre uma vez. Depois do reenvio vira REENVIADO e sai da
-- fila: apertar o botão de novo não manda outro aviso igual ao comprador.
ALTER TYPE "AutomacaoEventoStatus" ADD VALUE 'REENVIADO';
