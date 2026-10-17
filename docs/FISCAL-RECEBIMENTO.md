# Recebimento de NF-e

Em Configurações → Notas fiscais, o dono envia o certificado A1 (.pfx/.p12),
senha e UF. O CNPJ é lido do certificado e deve coincidir com Dados da empresa.
Certificados A3 não são suportados. A senha e o arquivo são cifrados juntos
com AES-256-GCM e uma chave independente `LOJAS_CERT_SECRET` (32 bytes em hex).
O navegador recebe somente a identificação e a validade do certificado.

## Ativação

1. Configurar e guardar em cofre/backup `LOJAS_CERT_SECRET`.
2. Aplicar `npx prisma migrate deploy` antes de iniciar o novo código.
3. Abrir `/painel/configuracoes/fiscal` como dono e enviar um certificado A1.
4. Consultar o primeiro lote e conferir os XMLs baixados.
5. Conferir a rotina `fiscal.receber` no agendador existente.

Uma única loja configura cada CNPJ, para evitar duas sequências de NSU.
Se outro programa já consulta este CNPJ, coordenar o uso da distribuição com
ele antes de ativar, respeitando o mesmo controle de NSU e o intervalo.
A renovação do certificado preserva o NSU e o horário de próxima consulta.
A mudança de CNPJ exige revisão pelo suporte e preserva documentos anteriores.

## Consulta

O serviço usa mTLS e SOAP 1.2, `distNSU`, ambiente de produção e o endpoint
oficial `www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx`.
Cada chamada processa um lote de até 50 documentos. A gravação dos documentos
e do último NSU ocorre na mesma transação, com deduplicação por loja/CNPJ/NSU.
Uma reserva atômica impede consultas simultâneas. Fim da fila, erro ou consumo
indevido reservam uma hora antes de nova tentativa. Falha ao salvar não avança
o NSU. O próximo lote pode ser solicitado pelo botão ou pelo agendador.

A rotina roda a cada cinco minutos e atende até cinco lojas por execução,
respeitando o horário persistido de cada CNPJ. Certificados vencidos e lojas
inativas não são consultados. Nenhum evento de manifestação é enviado.

A consulta recebe apenas NF-e, resumos e eventos disponibilizados ao ator
pelo Ambiente Nacional. Não oferece todo o histórico do CNPJ, NFS-e ou NFC-e.
XML completo depende das regras de distribuição e, em alguns casos, de
manifestação do destinatário. A tela identifica o schema de cada documento.
Os últimos 100 documentos são listados; os anteriores permanecem no banco.

Referências: [serviços oficiais](https://www.nfe.fazenda.gov.br/PORTAl/webServices.aspx?tipoConteudo=OUC%2FYVNWZfo%3D)
e [regras de consumo](https://hom.nfe.fazenda.gov.br/Portal/informe.aspx?AspxAutoDetectCookieSupport=1&Informe=R%2F52iNPKnGs%3D&ehCTG=false).

Testes locais usam certificados e XMLs sintéticos. Consulta real exige
certificado válido, cadeia ICP-Brasil confiável no servidor e acesso à SEFAZ.

## Validação local em 15/10/2026

- 929 testes unitários aprovados na suíte completa.
- Cinco testes de integração aprovados em PostgreSQL 18 isolado: concorrência,
  isolamento, intervalo, reversão transacional e troca de CNPJ.
- Todas as 65 migrações aplicadas em uma base vazia de teste.
- Typecheck e ESLint dos arquivos alterados aprovados.
- Playwright: login, upload A1, senha incorreta, ausência de segredo na resposta,
  recusa de outra origem, intervalo, download XML e bloqueio de gerente/anônimo.
- Tela conferida em 1440 px e 393 px, sem erro de página ou vazamento lateral.
  Capturas em `output/fiscal-qa/desktop.png` e `output/fiscal-qa/mobile.png`.
- Corrigida a leitura do caminho reescrito na navegação do painel, que causava
  divergência de hidratação ao abrir a configuração diretamente.

Não publicado em produção. Não foi realizada consulta real à SEFAZ.
