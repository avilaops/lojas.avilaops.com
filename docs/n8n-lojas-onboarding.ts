import { workflow, node, trigger, sticky, placeholder, newCredential, ifElse, switchCase, expr } from '@n8n/workflow-sdk';

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
          { id: 'passosTexto', name: 'passosTexto', value: expr('{{ Object.entries($json.body?.passos ?? {}).map(function (par) { return par[0] + ": " + par[1]; }).join("\\n") }}'), type: 'string' },
          { id: 'temErro', name: 'temErro', value: expr('{{ Object.values($json.body?.passos ?? {}).some(function (v) { return String(v).startsWith("erro"); }) }}'), type: 'boolean' },
        ],
      },
    },
  },
  output: [{ tipo: 'loja.criada', slug: 'vedashow', nome: 'Vedashow', url: 'https://vedashow.lojas.avilaops.com', lojistaWhatsapp: '5516999990000', lojistaEmail: 'jose@vedashow.com.br', emailRemetente: '', referencia: '', numero: '', totalReais: '0,00', meioPagamento: '', clienteNome: '', clienteEmail: '', clienteTelefone: '', itens: '', passosTexto: '', temErro: false }],
});

const rotear = switchCase({
  version: 3.4,
  config: {
    name: 'Rotear por Tipo de Evento',
    parameters: {
      mode: 'rules',
      rules: {
        values: [
          { outputKey: 'loja.criada', conditions: { options: { caseSensitive: false, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.tipo }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'loja.criada' }], combinator: 'and' } },
          { outputKey: 'loja.provisionada', conditions: { options: { caseSensitive: false, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.tipo }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'loja.provisionada' }], combinator: 'and' } },
          { outputKey: 'pedido.criado', conditions: { options: { caseSensitive: false, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.tipo }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'pedido.criado' }], combinator: 'and' } },
          { outputKey: 'pedido.pago', conditions: { options: { caseSensitive: false, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.tipo }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'pedido.pago' }], combinator: 'and' } },
          { outputKey: 'pedido.recusado', conditions: { options: { caseSensitive: false, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.tipo }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'pedido.recusado' }], combinator: 'and' } },
        ],
      },
      options: { fallbackOutput: 'none' },
    },
  },
});

const zapBoasVindas = node({
  type: 'n8n-nodes-base.twilio',
  version: 1,
  config: {
    name: 'WhatsApp: Boas-vindas ao Lojista',
    executeOnce: true,
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'sms',
      operation: 'send',
      from: placeholder('Número WhatsApp do Twilio, ex.: whatsapp:+14155238886'),
      to: expr('+{{ $json.lojistaWhatsapp }}'),
      toWhatsapp: true,
      message: expr('Olá! Sua loja *{{ $json.nome }}* já está no ar para você aprovar: {{ $json.url }}\n\nEntre no painel em https://cliente.avilaops.com/dashboard/loja para cadastrar produtos e trocar cores.\nQualquer dúvida, é só responder aqui. — Avila Ops'),
    },
    credentials: { twilioApi: newCredential('Twilio') },
  },
  output: [{ sid: 'SM123', status: 'queued' }],
});

const emailTreinamento = node({
  type: 'n8n-nodes-base.emailSend',
  version: 2.1,
  config: {
    name: 'E-mail: Treinamento em Vídeo',
    executeOnce: true,
    onError: 'continueRegularOutput',
    parameters: {
      operation: 'send',
      fromEmail: 'Avila Ops <lojas@avilaops.com>',
      toEmail: expr('{{ $("Normalizar Evento").item.json.lojistaEmail }}'),
      subject: expr('Sua loja {{ $("Normalizar Evento").item.json.nome }} está no ar — 3 vídeos de 1 minuto'),
      emailFormat: 'html',
      html: expr('<p>Olá!</p><p>Sua loja <strong>{{ $("Normalizar Evento").item.json.nome }}</strong> já responde em <a href="{{ $("Normalizar Evento").item.json.url }}">{{ $("Normalizar Evento").item.json.url }}</a>.</p><p>Três vídeos curtos para você dominar o painel:</p><ol><li><a href="https://docs.avilaops.com/lojas/cadastrar-produtos">Cadastrar produtos pela planilha</a></li><li><a href="https://docs.avilaops.com/lojas/pedidos">Acompanhar e enviar pedidos</a></li><li><a href="https://docs.avilaops.com/lojas/aparencia">Trocar cores, logo e domínio</a></li></ol><p>Painel: <a href="https://cliente.avilaops.com/dashboard/loja">cliente.avilaops.com/dashboard/loja</a></p><p>— Avila Ops</p>'),
    },
    credentials: { smtp: { id: 'u5TEBKNV9jVOaswT', name: 'SMTP account' } },
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
      content: expr('Aprovar loja {{ $("Normalizar Evento").item.json.nome }} ({{ $("Normalizar Evento").item.json.slug }}) com o cliente'),
      options: { description: expr('{{ $("Normalizar Evento").item.json.url }}\nWhatsApp: {{ $("Normalizar Evento").item.json.lojistaWhatsapp }}\nE-mail: {{ $("Normalizar Evento").item.json.lojistaEmail }}'), dueString: 'em 2 dias', dueLang: 'pt', priority: 3 },
    },
    credentials: { todoistApi: { id: 'C7xqqFDFDlihAQLG', name: 'Todoist account' } },
  },
  output: [{ id: '1', content: 'Aprovar loja Vedashow' }],
});

const esperar3Dias = node({
  type: 'n8n-nodes-base.wait',
  version: 1.1,
  config: { name: 'Esperar 3 Dias', parameters: { resume: 'timeInterval', amount: 3, unit: 'days' } },
  output: [{}],
});

const zapIndicacoes = node({
  type: 'n8n-nodes-base.twilio',
  version: 1,
  config: {
    name: 'WhatsApp: Pedir 2 Indicações',
    executeOnce: true,
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'sms',
      operation: 'send',
      from: placeholder('Número WhatsApp do Twilio, ex.: whatsapp:+14155238886'),
      to: expr('+{{ $("Normalizar Evento").item.json.lojistaWhatsapp }}'),
      toWhatsapp: true,
      message: expr('Oi! Tudo certo com a loja *{{ $("Normalizar Evento").item.json.nome }}*?\n\nPara manter o valor promocional do setup, combinamos 2 indicações (nome e telefone) de quem também pode querer vender pela internet. Pode mandar por aqui mesmo. Obrigado! — Avila Ops'),
    },
    credentials: { twilioApi: newCredential('Twilio') },
  },
  output: [{ sid: 'SM124', status: 'queued' }],
});

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
    credentials: { todoistApi: { id: 'C7xqqFDFDlihAQLG', name: 'Todoist account' } },
  },
  output: [{ id: '2', content: 'Provisionamento com erro' }],
});

const zapLojaNoAr = node({
  type: 'n8n-nodes-base.twilio',
  version: 1,
  config: {
    name: 'WhatsApp: Loja Configurada',
    executeOnce: true,
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'sms',
      operation: 'send',
      from: placeholder('Número WhatsApp do Twilio, ex.: whatsapp:+14155238886'),
      to: expr('+{{ $json.lojistaWhatsapp }}'),
      toWhatsapp: true,
      message: expr('Pronto! Domínio, DNS e e-mail da *{{ $json.nome }}* estão configurados. Sua loja: {{ $json.url }} — Avila Ops'),
    },
    credentials: { twilioApi: newCredential('Twilio') },
  },
  output: [{ sid: 'SM125', status: 'queued' }],
});

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

const zapPixPendente = node({
  type: 'n8n-nodes-base.twilio',
  version: 1,
  config: {
    name: 'WhatsApp: Lembrete de PIX',
    executeOnce: true,
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'sms',
      operation: 'send',
      from: placeholder('Número WhatsApp do Twilio, ex.: whatsapp:+14155238886'),
      to: expr('+{{ $json.clienteTelefone }}'),
      toWhatsapp: true,
      message: expr('Oi, {{ $("Normalizar Evento").item.json.clienteNome.split(" ")[0] }}! Seu pedido na {{ $("Normalizar Evento").item.json.nome }} (R$ {{ $("Normalizar Evento").item.json.totalReais }}) ainda está aguardando o PIX. O código expira em breve — se precisar de um novo, é só responder aqui.'),
    },
    credentials: { twilioApi: newCredential('Twilio') },
  },
  output: [{ sid: 'SM126', status: 'queued' }],
});

const zapPedidoPago = node({
  type: 'n8n-nodes-base.twilio',
  version: 1,
  config: {
    name: 'WhatsApp: Pedido Pago (Lojista)',
    executeOnce: true,
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'sms',
      operation: 'send',
      from: placeholder('Número WhatsApp do Twilio, ex.: whatsapp:+14155238886'),
      to: expr('+{{ $json.lojistaWhatsapp }}'),
      toWhatsapp: true,
      message: expr('💰 Pedido #{{ $json.numero }} pago — R$ {{ $json.totalReais }}\nCliente: {{ $json.clienteNome }} ({{ $json.clienteTelefone }})\nItens: {{ $json.itens }}\nSeparar e enviar pelo painel: https://cliente.avilaops.com/dashboard/loja'),
    },
    credentials: { twilioApi: newCredential('Twilio') },
  },
  output: [{ sid: 'SM127', status: 'queued' }],
});

const emailConfirmacao = node({
  type: 'n8n-nodes-base.emailSend',
  version: 2.1,
  config: {
    name: 'E-mail: Confirmação ao Comprador',
    executeOnce: true,
    onError: 'continueRegularOutput',
    parameters: {
      operation: 'send',
      fromEmail: expr('{{ $("Normalizar Evento").item.json.nome }} <{{ $("Normalizar Evento").item.json.emailRemetente || "pedidos@lojas.avilaops.com" }}>'),
      toEmail: expr('{{ $("Normalizar Evento").item.json.clienteEmail }}'),
      subject: expr('Pedido #{{ $("Normalizar Evento").item.json.numero }} confirmado — {{ $("Normalizar Evento").item.json.nome }}'),
      emailFormat: 'html',
      html: expr('<p>Olá, {{ $("Normalizar Evento").item.json.clienteNome }}!</p><p>Recebemos o pagamento do seu pedido <strong>#{{ $("Normalizar Evento").item.json.numero }}</strong> (R$ {{ $("Normalizar Evento").item.json.totalReais }}).</p><p>Itens: {{ $("Normalizar Evento").item.json.itens }}</p><p>Acompanhe em <a href="{{ $("Normalizar Evento").item.json.url }}/pedido/{{ $("Normalizar Evento").item.json.referencia }}">{{ $("Normalizar Evento").item.json.url }}/pedido/{{ $("Normalizar Evento").item.json.referencia }}</a>.</p><p>{{ $("Normalizar Evento").item.json.nome }}</p>'),
      options: { replyTo: expr('{{ $("Normalizar Evento").item.json.lojistaEmail }}') },
    },
    credentials: { smtp: { id: 'u5TEBKNV9jVOaswT', name: 'SMTP account' } },
  },
  output: [{ accepted: ['cliente@exemplo.com'] }],
});

const zapRecusado = node({
  type: 'n8n-nodes-base.twilio',
  version: 1,
  config: {
    name: 'WhatsApp: Pagamento Recusado',
    executeOnce: true,
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'sms',
      operation: 'send',
      from: placeholder('Número WhatsApp do Twilio, ex.: whatsapp:+14155238886'),
      to: expr('+{{ $json.clienteTelefone }}'),
      toWhatsapp: true,
      message: expr('Oi, {{ $json.clienteNome.split(" ")[0] }}! O pagamento do seu pedido na {{ $json.nome }} não foi aprovado pelo cartão. Você pode refazer com PIX em {{ $json.url }}/carrinho — aprovação na hora. Se preferir, responda aqui que ajudamos.'),
    },
    credentials: { twilioApi: newCredential('Twilio') },
  },
  output: [{ sid: 'SM128', status: 'queued' }],
});

const notaFluxo = sticky(
  '## Lojas — onboarding e pedidos\n\nRecebe os eventos de **lojas.avilaops.com** (`N8N_WEBHOOK_URL` = URL deste webhook, `N8N_WEBHOOK_TOKEN` = valor da credencial Header Auth, cabeçalho `authorization` com prefixo `Bearer `).\n\n- `loja.criada` → WhatsApp + e-mail de treinamento + tarefa "Aprovar loja" + pedido de 2 indicações em 3 dias\n- `loja.provisionada` → erro vira tarefa no Todoist; sucesso avisa o lojista\n- `pedido.criado` (PIX) → 30 min depois, se ainda não pagou, lembra o comprador\n- `pedido.pago` → avisa o lojista no WhatsApp e confirma ao comprador por e-mail\n- `pedido.recusado` → oferece PIX ao comprador',
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
