import json,re,sys,collections
sys.path.insert(0,'.')
from rtl_dados import RTL
V=json.load(open('veda.json')); M={m['sku']:m for m in json.load(open('match.json'))}
SH={v:k for k,v in json.load(open('short.json')).items()}  # handle -> curto
RTLURL='https://loja.rtlrolamentos.com.br/products/'
GCAT={'Retentores':'503744','Gaxetas':'503744','Raspadores':'503744','Anéis Backup':'503744','Guias':'503744','Vedações':'503744','Cordões':'503744','Juntas':'503744','Anéis':'503744','O-Rings':'6732',
 'Rolamentos':'2878','Mancais':'2878','Buchas':'2878','Polias':'2878','Rodas Dentadas':'2878','Anéis Elásticos':'2878','Correias':'2878','Acoplamentos':'2878','Porcas':'1739','Arruelas':'2195','Correntes':'1492','Emendas':'503764'}
def br(x):
    s=('%.3f'%x).rstrip('0').rstrip('.'); return s.replace('.',',')
def fnum(v):
    if v is None: return None
    m=re.match(r'^\s*(\d+(?:[.,]\d+)?)',str(v)); 
    return float(m.group(1).replace(',','.')) if m else None
def medidas(a):
    di,de,h=fnum(a.get('diametroInternoMm')),fnum(a.get('diametroExternoMm')),fnum(a.get('alturaMm'))
    if di and de and h and 0<di<de<=2000 and 0<h<=300 and 0.5<=(de-di)/2<=40 and not a.get('_nomeSuspeito'): return di,de,h
    return None
CONF='Confira as medidas da peça antiga ou do alojamento antes de comprar; em caso de dúvida, fale com a loja informando a aplicação.'
def mat(a):
    m=a.get('material'); return f' em {m}' if m else ''
def desc(v,rt):
    c=v['cat']; a=v['attr'] or {}; n=v['nome']; md=medidas(a); marca=v['marca']
    mtxt=f'Medidas: {br(md[0])} mm de diâmetro interno, {br(md[1])} mm de diâmetro externo e {br(md[2])} mm de altura.' if md else 'As medidas estão indicadas no nome do produto.'
    if c=='Retentores':
        return '\n\n'.join([f'Retentor{mat(a)} para vedação de eixos rotativos. O lábio de vedação mantém o óleo ou a graxa dentro do conjunto e impede a entrada de poeira, água e outros contaminantes, protegendo rolamentos e engrenagens.',
          mtxt+' O diâmetro interno corresponde ao eixo e o externo ao alojamento onde o retentor é prensado.',
          'Usado em redutores, motores, bombas, cubos de roda, implementos agrícolas e máquinas industriais. '+CONF])
    if c=='O-Rings':
        s=fnum(a.get('secaoMm')); di=fnum(a.get('diametroInternoMm'))
        m2=f'Medidas: {br(di)} mm de diâmetro interno e {br(s)} mm de seção (espessura do cordão).' if di and s else 'As medidas (diâmetro interno x seção) estão indicadas no nome do produto.'
        return '\n\n'.join([f'Anel O-ring{mat(a)} para vedação estática ou dinâmica de fluidos. Montado em canal, é comprimido entre as duas superfícies e veda óleo, água, ar e outros fluidos em conexões, tampas, válvulas, cilindros e bombas.',
          m2+' O anel é identificado pelo diâmetro interno e pela seção; os dois precisam bater com o canal.',
          'A compatibilidade com o fluido e a temperatura depende do material do anel. '+CONF])
    if c=='Gaxetas':
        return '\n\n'.join([f'Gaxeta{mat(a)} para vedação de hastes e êmbolos em cilindros hidráulicos e pneumáticos. Os lábios se abrem com a pressão do fluido e vedam contra a haste ou a camisa, evitando vazamento e perda de força do cilindro.',
          mtxt if md else 'As medidas estão indicadas no nome do produto (diâmetro interno x diâmetro externo x altura).',
          'Usada em cilindros de máquinas agrícolas, de construção, prensas e equipamentos industriais. '+CONF])
    if c=='Raspadores':
        return '\n\n'.join([f'Raspador (limpador de haste){mat(a)} para cilindros hidráulicos e pneumáticos. Fica na entrada do cilindro e limpa a haste no retorno, impedindo que poeira, barro e partículas cheguem às gaxetas e ao óleo.',
          mtxt if md else 'As medidas estão indicadas no nome do produto.',
          'Trocar o raspador junto com as gaxetas aumenta a vida do reparo. '+CONF])
    if c=='Anéis Backup':
        return '\n\n'.join(['Anel backup (anel anti-extrusão) para uso junto de O-rings e gaxetas. Montado no canal do lado de baixa pressão, apoia a vedação e evita que ela seja empurrada para a folga entre as peças quando a pressão é alta.',
          'As medidas estão indicadas no nome do produto e devem corresponder ao canal e ao anel de vedação com que ele trabalha.', CONF])
    if c=='Guias':
        return '\n\n'.join(['Anel guia para cilindros hidráulicos e pneumáticos. Mantém a haste ou o êmbolo centralizado e evita o contato de metal com metal, absorvendo esforços laterais e protegendo as vedações.',
          mtxt if md else 'As medidas estão indicadas no nome do produto.', CONF])
    if c=='Rolamentos':
        nu=n.upper(); ved=[]
        if re.search(r'2RS|DDU|LLU',nu): ved.append('duas vedações de borracha (2RS), que retêm a graxa e protegem contra poeira e umidade')
        elif re.search(r'ZZ|2Z\b',nu): ved.append('duas blindagens metálicas (ZZ), que retêm a graxa e protegem contra partículas')
        folga=' Folga interna C3, maior que a normal, indicada para trabalho com aquecimento ou ajuste apertado.' if re.search(r'C3',nu) else ''
        h=rt and rt['h']
        if h and h.startswith('rolamento-rigido'): tipo='Rolamento rígido de esferas de uma carreira, o tipo mais usado em motores elétricos, redutores, bombas, polias e máquinas em geral. Suporta carga radial e carga axial moderada nos dois sentidos'
        elif h and 'conicos' in h: tipo='Rolamento de rolos cônicos de uma carreira, formado por cone (anel interno com rolos) e capa (anel externo). Suporta carga radial e axial combinadas em um sentido, e é montado em pares em cubos de roda, redutores e eixos'
        elif h and '-uc-' in h: tipo='Rolamento de esferas tipo UC para mancais, com anel externo esférico, anel interno prolongado e parafusos de fixação no eixo. Monta nos mancais das séries P, F, FL e T do mesmo tamanho'
        elif h and 'axial' in h: tipo='Rolamento axial de esferas de escora simples. Suporta carga axial em um sentido e não deve receber carga radial'
        elif h and 'autocompensador-de-rolos' in h: tipo='Rolamento autocompensador de rolos, de duas carreiras. Suporta carga radial pesada e compensa desalinhamento entre eixo e alojamento'
        elif h and 'autocompensador' in h: tipo='Rolamento autocompensador de esferas, de duas carreiras. Compensa desalinhamento entre eixo e alojamento e trabalha com baixo atrito'
        elif h and 'contato-angular' in h: tipo='Rolamento de esferas de contato angular. Suporta carga radial e axial combinadas'
        else: tipo='Rolamento para apoio de eixos, que reduz o atrito entre as partes girantes e suporta as cargas do conjunto'
        p1=tipo+('; este modelo tem '+ved[0] if ved else '')+'.'+folga
        d=rt and rt['d']
        if d and d['d'] and d['D'] and d['B']:
            p2=f'Medidas: {br(d["d"])} mm de furo, {br(d["D"])} mm de diâmetro externo e {br(d["B"])} mm de largura.'+(f' Peso aproximado de {br(d["pesoKg"])} kg.' if d['pesoKg'] else '')
        elif md: p2=mtxt
        else: p2='A designação gravada no rolamento (número e sufixos) define as medidas; ela está no nome do produto.'
        p3=(f'Marca {marca}. ' if marca else '')+'Confira a designação gravada no rolamento antigo, incluindo os sufixos de vedação e folga, antes de comprar.'
        return '\n\n'.join([p1,p2,p3])
    if c=='Mancais':
        return '\n\n'.join(['Mancal para apoio de eixos, usado com rolamento de esferas tipo UC. A caixa é fixada à estrutura da máquina e o rolamento, com anel externo esférico, compensa pequenos desalinhamentos na montagem.',
          'O número do mancal indica a série e o tamanho, que definem o diâmetro do eixo e a furação de fixação; ele está no nome do produto.', (f'Marca {marca}. ' if marca else '')+'Confira o modelo gravado no mancal antigo e o diâmetro do eixo antes de comprar.'])
    if c=='Correias':
        return '\n\n'.join(['Correia de transmissão para acionamento entre polias em motores, compressores, máquinas agrícolas e equipamentos industriais.',
          'O código no nome do produto indica o perfil (seção) e o comprimento da correia; os dois precisam ser iguais aos da correia original.', (f'Marca {marca}. ' if marca else '')+'Confira o código impresso na correia antiga antes de comprar.'])
    if c in('Buchas','Porcas','Arruelas') and rt:
        d=rt['d']
        if c=='Buchas': return '\n\n'.join(['Bucha de fixação cônica para montagem de rolamentos de furo cônico em eixos cilíndricos lisos, sem necessidade de rebaixo no eixo. O conjunto é formado por bucha, porca e arruela de trava.',
            f'Para eixo de {br(d["d"])} mm; rosca M{d["rosca"]}, comprimento de {br(d["B"])} mm e conicidade 1:12.'+(f' Peso aproximado de {br(d["pesoKg"])} kg.' if d['pesoKg'] else ''), 'Confira o código da bucha (série H) e o diâmetro do eixo antes de comprar.'])
        if c=='Porcas': return '\n\n'.join(['Porca de fixação KM para travar rolamentos e buchas de fixação no eixo. Tem rasgos na face externa para aperto com chave de gancho e é usada com a arruela de trava MB do mesmo número.',
            f'Rosca M{d["rosca"]}, diâmetro externo de {br(d["D"])} mm e espessura de {br(d["B"])} mm.'+(f' Peso aproximado de {br(d["pesoKg"])} kg.' if d['pesoKg'] else ''), 'Confira o número da porca (KM) e a rosca do eixo ou da bucha antes de comprar.'])
        return '\n\n'.join(['Arruela de trava MB para uso com porca de fixação KM. A lingueta interna encaixa no rasgo do eixo ou da bucha e um dos dentes externos é dobrado sobre o rasgo da porca, impedindo que ela se solte.',
            f'Diâmetro interno de {br(d["d"])} mm, externo de {br(d["D"])} mm e espessura de {br(d["B"])} mm.', 'Confira o número da arruela (MB), que deve ser o mesmo da porca KM.'])
    return None
P=[]; st=collections.Counter()
for v in V:
    c=v['cat']; pt={}
    a=dict(v['attr'] or {})
    if re.search(r'\d \d+(,\d+)?x|x\d+ \d+( |$)',v['nome']): a['_nomeSuspeito']=1; v['attr']=a; st['nome_suspeito']+=1
    rt=None; m=M.get(v['sku'])
    if m:
        h=m['h']; code=('dg:'+re.search(r'6\d{3}',h).group(0)) if h.startswith('rolamento-rigido') else SH.get(h)
        d=RTL.get(code)
        if d:
            rt={'h':h,'d':d}
            md=medidas(a)
            if md and d['d'] and (abs(md[0]-d['d'])>0.6 or abs(md[1]-d['D'])>0.6): st['medida_diverge']+=1; rt=None
    if c in GCAT and not v.get('gcat'): pt['googleProductCategory']=GCAT[c]
    if not v['desc']:
        t=desc(v,rt)
        if t: pt['descricao']=t; st['desc']+=1
    if rt:
        d=rt['d']; na={}
        if c=='Rolamentos' and d['d'] and d['D'] and d['B'] and not medidas(a): na.update(diametroInternoMm=d['d'],diametroExternoMm=d['D'],alturaMm=d['B'])
        if d['pesoKg'] and not v['peso']: pt['pesoKg']=d['pesoKg']; st['peso']+=1
        if d['rosca']: na['rosca']='M'+d['rosca']
        if na: na['_dossieFonte']=RTLURL+rt['h']; pt['atributos']=na; st['attrs']+=1
    if pt: P.append({'sku':v['sku'],'slug':v['slug'],**pt}); st['produtos']+=1
    if 'googleProductCategory' in pt: st['gcat']+=1
json.dump(P,open('patch.json','w'),ensure_ascii=False)
print(st); 
import random; random.seed(5)
for p in random.sample([p for p in P if 'pesoKg' in p],2)+random.sample(P,3): print(json.dumps(p,ensure_ascii=False,indent=1)[:1100])
print(max(len(p.get('descricao','')) for p in P))
