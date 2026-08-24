import { workflow, node, trigger, sticky, placeholder, newCredential, ifElse, switchCase, expr, nodeJson } from '@n8n/workflow-sdk';

const CRED_SMTP = { id: 'u5TEBKNV9jVOaswT', name: 'SMTP account' };
const CRED_TODOIST = { id: 'C7xqqFDFDlihAQLG', name: 'Todoist account' };
const TWILIO_FROM = placeholder('Número WhatsApp do Twilio, ex.: whatsapp:+14155238886');
const REMETENTE = 'Avila Ops <lojas@avilaops.com>';

const receberEvento = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Receber Evento da Plataforma',
    parameters: { httpMethod: 'POST', path: 'lojas-eventos', authentication: 'headerAuth', responseMode: 'onReceived' },
    credentials: { httpHeaderAuth: newCredential('Lojas Webhook Auth') },
  },
  output: [{ body: { tipo: 'loja.criada', slug: 'vedashow', nome: 'Vedashow', url: 'https://vedashow.lojas.avilaops.com', whatsapp: '5516999990000', emailContato: 'jose@vedashow.com.br' } }],
});

const normalizar = node({
  type: 'n8n-nodes-base.set',
  version: 3.5,
  config: {
    name: 'Normalizar Evento',
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'tipo', name: 'tipo', value: expr('{{ $json.body?.tipo ?? $json.tipo ?? "" }}'), type: 'string' },
          { id: 'slug', name: 'slug', value: expr('{{ $json.body?.slug ?? $json.slug ?? "" }}'), type: 'string' },
          { id: 'nome', name: 'nome', value: expr('{{ $json.body?.nome ?? $json.body?.lojaNome ?? $json.nome ?? "" }}'), type: 'string' },
          { id: 'url', name: 'url', value: expr('{{ $json.body?.url ?? $json.body?.lojaUrl ?? $json.url ?? "" }}'), type: 'string' },
          { id: 'lojistaWhatsapp', name: 'lojistaWhatsapp', value: expr('{{ $json.body?.whatsapp ?? $json.body?.lojistaWhatsapp ?? $json.whatsapp ?? "" }}'), type: 'string' },
          { id: 'lojistaEmail', name: 'lojistaEmail', value: expr('{{ $json.body?.emailContato ?? $json.body?.lojistaEmail ?? $json.emailContato ?? "" }}'), type: 'string' },
          { id: 'emailRemetente', name: 'emailRemetente', value: expr('{{ $json.body?.emailRemetente ?? "" }}'), type: 'string' },
          { id: 'referencia', name: 'referencia', value: expr('{{ $json.body?.referencia ?? "" }}'), type: 'string' },
          { id: 'numero', name: 'numero', value: expr('{{ $json.body?.numero ?? "" }}'), type: 'string' },
          { id: 'totalReais', name: 'totalReais', value: expr('{{ (($json.body?.total ?? 0) / 100).toFixed(2).replace(".", ",") }}'), type: 'string' },
          { id: 'meioPagamento', name: 'meioPagamento', value: expr('{{ $json.body?.meioPagamento ?? "" }}'), type: 'string' },
          { id: 'clienteNome', name: 'clienteNome', value: expr('{{ $json.body?.clienteNome ?? "" }}'), type: 'string' },
          { id: 'clienteEmail', name: 'clienteEmail', value: expr('{{ $json.body?.clienteEmail ?? "" }}'), type: 'string' },
          { id: 'clienteTelefone', name: 'clienteTelefone', value: expr('{{ $json.body?.clienteTelefone ?? "" }}'), type: 'string' },
          { id: 'itens', name: 'itens', value: expr('{{ $json.body?.itens ?? "" }}'), type: 'string' },
          { id: 'passosTexto', name: 'passosTexto', value: expr('{{ Object.entries($json.body?.passos ?? {}).map(([k, v]) => k + ": " + v).join("\\n") }}'), type: 'string' },
          { id: 'temErro', name: 'temErro', value: expr('{{ Object.values($json.body?.passos ?? {}).some((v) => String(v).startsWith("erro")) }}'), type: 'boolean' },
        ],
      },
    },
  },
  output: [{ tipo: 'loja.criada', slug: 'vedashow', nome: 'Vedashow', url: 'https://vedashow.lojas.avilaops.com', lojistaWhatsapp: '5516999990000', lojistaEmail: 'jose@vedashow.com.br', emailRemetente: '', referencia: '', numero: '', totalReais: '0,00', meioPagamento: '', clienteNome: '', clienteEmail: '', clienteTelefone: '', itens: '', passosTexto: '', temErro: false }],
});

const regra = (valor) => ({
  outputKey: valor,
  conditions: {
    options: { caseSensitive: false, leftValue: '', typeValidation: 'strict' },
    conditions: [{ leftValue: expr('{{ $json.tipo }}'), operator: { type: 'string', operation: 'equals' }, rightValue: valor }],
    combinator: 'and',
  },
});

const rotear = switchCase({
  version: 3.4,
  config: {
    name: 'Rotear por Tipo de Evento',
    parameters: {
      mode: 'rules',
      rules: { values: [regra('loja.criada'), regra('loja.provisionada'), regra('pedido.criado'), regra('pedido.pago'), regra('pedido.recusado')] },
      options: { fallbackOutput: 'none' },
    },
  },
});

const zap = (name, to, message) =>
  node({
    type: 'n8n-nodes-base.twilio',
    version: 1,
    config: {
      name,
      executeOnce: true,
      onError: 'continueRegularOutput',
      parameters: { resource: 'sms', operation: 'send', from: TWILIO_FROM, to, toWhatsapp: true, message },
      credentials: { twilioApi: newCredential('Twilio') },
    },
    output: [{ sid: 'SM123', status: 'queued' }],
  });

const zapBoasVindas = zap(
  'WhatsApp: Boas-vindas ao Lojista',
  expr('+{{ $json.lojistaWhatsapp }}'),
  expr(
    'Olá! Sua loja *{{ $json.nome }}* já está no ar para você aprovar: {{ $json.url }}\n\n' +
      'Entre no painel em https://cliente.avilaops.com/dashboard/loja para cadastrar produtos e trocar cores.\n' +
      'Qualquer dúvida, é só responder aqui. — Avila Ops',
  ),
);

const emailTreinamento = node({
  type: 'n8n-nodes-base.emailSend',
  version: 2.1,
  config: {
    name: 'E-mail: Treinamento em Vídeo',
    executeOnce: true,
    onError: 'continueRegularOutput',
    parameters: {
      operation: 'send',
      fromEmail: REMETENTE,
      toEmail: expr('{{ $json.lojistaEmail }}'),
      subject: expr('Sua loja {{ $json.nome }} está no ar — 3 vídeos de 1 minuto'),
      emailFormat: 'html',
      html: expr(
        '<p>Olá!</p>' +
          '<p>Sua loja <strong>{{ $json.nome }}</strong> já responde em <a href="{{ $json.url }}">{{ $json.url }}</a>.</p>' +
          '<p>Três vídeos curtos para você dominar o painel:</p>' +
          '<ol>' +
          '<li><a href="https://docs.avilaops.com/lojas/cadastrar-produtos">Cadastrar produtos pela planilha</a></li>' +
          '<li><a href="https://docs.avilaops.com/lojas/pedidos">Acompanhar e enviar pedidos</a></li>' +
          '<li><a href="https://docs.avilaops.com/lojas/aparencia">Trocar cores, logo e domínio</a></li>' +
          '</ol>' +
          '<p>Painel: <a href="https://cliente.avilaops.com/dashboard/loja">cliente.avilaops.com/dashboard/loja</a></p>' +
          '<p>— Avila Ops</p>',
      ),
    },
    credentials: { smtp: CRED_SMTP },
  },
  output: [{ accepted: ['jose@vedashow.com.br'] }],
});

const tarefaAprovar = node({
  type: 'n8n-nodes-base.todoist',
  version: 2.2,
  config: {
    name: 'Todoist: Aprovar Loja em 48h',
    executeOnce: true,
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'task',
      operation: 'create',
      content: expr('Aprovar loja {{ $json.nome }} ({{ $json.slug }}) com o cliente'),
      options: { description: expr('{{ $json.url }}\nWhatsApp: {{ $json.lojistaWhatsapp }}\nE-mail: {{ $json.lojistaEmail }}'), dueString: 'em 2 dias', dueLang: 'pt', priority: 3 },
    },
    credentials: { todoistApi: CRED_TODOIST },
  },
  output: [{ id: '1', content: 'Aprovar loja Vedashow' }],
});

const esperar3Dias = node({
  type: 'n8n-nodes-base.wait',
  version: 1.1,
  config: { name: 'Esperar 3 Dias', parameters: { resume: 'timeInterval', amount: 3, unit: 'days' } },
  output: [{}],
});

const zapIndicacoes = zap(
  'WhatsApp: Pedir 2 Indicações',
  expr('+{{ $("Normalizar Evento").item.json.lojistaWhatsapp }}'),
  expr(
    'Oi! Tudo certo com a loja *{{ $("Normalizar Evento").item.json.nome }}*?\n\n' +
      'Para manter o valor promocional do setup, combinamos 2 indicações (nome e telefone) de quem também pode querer vender pela internet. Pode mandar por aqui mesmo. Obrigado! — Avila Ops',
  ),
);

const provisionamentoComErro = ifElse({
  version: 2.3,
  config: {
    name: 'Provisionamento Teve Erro?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr('{{ $json.temErro }}'), operator: { type: 'boolean', operation: 'true' }, rightValue: '' }],
        combinator: 'and',
      },
    },
  },
});

const tarefaErro = node({
  type: 'n8n-nodes-base.todoist',
  version: 2.2,
  config: {
    name: 'Todoist: Corrigir Provisionamento',
    executeOnce: true,
    parameters: {
      resource: 'task',
      operation: 'create',
      content: expr('Provisionamento com erro: loja {{ $json.slug }}'),
      options: { description: expr('{{ $json.passosTexto }}\n\nReexecutar: POST /api/admin/tenants/{{ $json.slug }}/provisionar'), dueString: 'hoje', dueLang: 'pt', priority: 4 },
    },
    credentials: { todoistApi: CRED_TODOIST },
  },
  output: [{ id: '2', content: 'Provisionamento com erro' }],
});

const zapLojaNoAr = zap(
  'WhatsApp: Loja Configurada',
  expr('+{{ $json.lojistaWhatsapp }}'),
  expr('Pronto! Domínio, DNS e e-mail da *{{ $json.nome }}* estão configurados. Sua loja: {{ $json.url }} — Avila Ops'),
);

const ehPix = ifElse({
  version: 2.3,
  config: {
    name: 'Pedido é PIX?',
    parameters: {
      conditions: {
        options: { caseSensitive: false, leftValue: '', typeValidation: 'strict' },
        conditions: [{ leftValue: expr('{{ $json.meioPagamento }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'pix' }],
        combinator: 'and',
      },
    },
  },
});

const esperar30Min = node({
  type: 'n8n-nodes-base.wait',
  version: 1.1,
  config: { name: 'Esperar 30 Minutos', parameters: { resume: 'timeInterval', amount: 30, unit: 'minutes' } },
  output: [{}],
});

const consultarPedidos = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Consultar Pedidos da Loja',
    executeOnce: true,
    parameters: {
      method: 'GET',
      url: expr('https://lojas.avilaops.com/api/admin/tenants/{{ $("Normalizar Evento").item.json.slug }}/pedidos'),
      authentication: 'genericCredentialType',
      genericAuthType: 'httpBearerAuth',
    },
    credentials: { httpBearerAuth: newCredential('Lojas Admin Token') },
  },
  output: [{ referencia: 'VEDASHOW-ABC', status: 'AGUARDANDO_PAGAMENTO', clienteTelefone: '5516988887777' }],
});

const aindaNaoPagou = ifElse({
  version: 2.3,
  config: {
    name: 'Ainda Aguardando Pagamento?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [
          { leftValue: expr('{{ $json.referencia }}'), operator: { type: 'string', operation: 'equals' }, rightValue: expr('{{ $("Normalizar Evento").item.json.referencia }}') },
          { leftValue: expr('{{ $json.status }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'AGUARDANDO_PAGAMENTO' },
        ],
        combinator: 'and',
      },
    },
  },
});

const zapPixPendente = zap(
  'WhatsApp: Lembrete de PIX',
  expr('+{{ $json.clienteTelefone }}'),
  expr(
    'Oi, {{ $("Normalizar Evento").item.json.clienteNome.split(" ")[0] }}! Seu pedido na {{ $("Normalizar Evento").item.json.nome }} ' +
      '(R$ {{ $("Normalizar Evento").item.json.totalReais }}) ainda está aguardando o PIX. O código expira em breve — se precisar de um novo, é só responder aqui.',
  ),
);

const zapPedidoPago = zap(
  'WhatsApp: Pedido Pago (Lojista)',
  expr('+{{ $json.lojistaWhatsapp }}'),
  expr(
    '💰 Pedido #{{ $json.numero }} pago — R$ {{ $json.totalReais }}\n' +
      'Cliente: {{ $json.clienteNome }} ({{ $json.clienteTelefone }})\n' +
      'Itens: {{ $json.itens }}\n' +
      'Separar e enviar pelo painel: https://cliente.avilaops.com/dashboard/loja',
  ),
);

const emailConfirmacao = node({
  type: 'n8n-nodes-base.emailSend',
  version: 2.1,
  config: {
    name: 'E-mail: Confirmação ao Comprador',
    executeOnce: true,
    onError: 'continueRegularOutput',
    parameters: {
      operation: 'send',
      fromEmail: expr('{{ $json.nome }} <{{ $json.emailRemetente || "pedidos@lojas.avilaops.com" }}>'),
      toEmail: expr('{{ $json.clienteEmail }}'),
      subject: expr('Pedido #{{ $json.numero }} confirmado — {{ $json.nome }}'),
      emailFormat: 'html',
      html: expr(
        '<p>Olá, {{ $json.clienteNome }}!</p>' +
          '<p>Recebemos o pagamento do seu pedido <strong>#{{ $json.numero }}</strong> (R$ {{ $json.totalReais }}).</p>' +
          '<p>Itens: {{ $json.itens }}</p>' +
          '<p>Acompanhe em <a href="{{ $json.url }}/pedido/{{ $json.referencia }}">{{ $json.url }}/pedido/{{ $json.referencia }}</a>.</p>' +
          '<p>{{ $json.nome }}</p>',
      ),
      options: { replyTo: expr('{{ $json.lojistaEmail }}') },
    },
    credentials: { smtp: CRED_SMTP },
  },
  output: [{ accepted: ['cliente@exemplo.com'] }],
});

const zapRecusado = zap(
  'WhatsApp: Pagamento Recusado',
  expr('+{{ $json.clienteTelefone }}'),
  expr(
    'Oi, {{ $json.clienteNome.split(" ")[0] }}! O pagamento do seu pedido na {{ $json.nome }} não foi aprovado pelo cartão. ' +
      'Você pode refazer com PIX em {{ $json.url }}/carrinho — aprovação na hora. Se preferir, responda aqui que ajudamos.',
  ),
);

const notaFluxo = sticky(
  '## Lojas — onboarding e pedidos\n\nRecebe os eventos de **lojas.avilaops.com** (`N8N_WEBHOOK_URL` = URL deste webhook, `N8N_WEBHOOK_TOKEN` = valor da credencial Header Auth).\n\n' +
    '- `loja.criada` → WhatsApp + e-mail de treinamento + tarefa "Aprovar loja" + pedido de 2 indicações em 3 dias\n' +
    '- `loja.provisionada` → erro vira tarefa no Todoist; sucesso avisa o lojista\n' +
    '- `pedido.criado` (PIX) → 30 min depois, se ainda não pagou, lembra o comprador\n' +
    '- `pedido.pago` → avisa o lojista no WhatsApp e confirma ao comprador por e-mail\n' +
    '- `pedido.recusado` → oferece PIX ao comprador',
  [receberEvento, normalizar, rotear],
  { color: 4 },
);

export default workflow('lojas-onboarding', 'Lojas — Onboarding e Pedidos')
  .add(notaFluxo)
  .add(receberEvento)
  .to(normalizar)
  .to(
    rotear
      .onCase(0, zapBoasVindas.to(emailTreinamento.to(tarefaAprovar.to(esperar3Dias.to(zapIndicacoes)))))
      .onCase(1, provisionamentoComErro.onTrue(tarefaErro).onFalse(zapLojaNoAr))
      .onCase(2, ehPix.onTrue(esperar30Min.to(consultarPedidos.to(aindaNaoPagou.onTrue(zapPixPendente)))))
      .onCase(3, zapPedidoPago.to(emailConfirmacao))
      .onCase(4, zapRecusado),
  );
