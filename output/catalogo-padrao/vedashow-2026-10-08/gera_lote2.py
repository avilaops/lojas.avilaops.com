import json,re,math,collections
V=json.load(open('/tmp/veda-agora.json'))
st=collections.Counter()
def vs(x):
    x=float(x); s=('%.4f'%x).rstrip('0').rstrip('.')
    o={s,s.replace('.',',')}
    for nd in (1,2,3):
        t=('%.*f'%(nd,x))
        if abs(float(t)-x)<1e-9: o|={t,t.replace('.',',')}
    return '(?:'+'|'.join(re.escape(i) for i in o)+')'
def fnum(v):
    m=re.match(r'^\s*(\d+(?:[.,]\d+)?)',str(v)) if v is not None else None
    return float(m.group(1).replace(',','.')) if m else None
def br(x):
    s=('%.3f'%x).rstrip('0').rstrip('.'); return s.replace('.',',')
def medidas_validas(v,fam):
    a=v.get('atributos') or {}; n=v['nome']
    di,de,h=fnum(a.get('diametroInternoMm')),fnum(a.get('diametroExternoMm')),fnum(a.get('alturaMm'))
    if not(di and de and h and 0<di<de<=2500 and 0<h<=400): return None
    pats=[vs(di)+r'\s*[xX]\s*'+vs(de)+r'\s*[xX]\s*'+vs(h), vs(di)+r'\s*mm\s*[xX]\s*'+vs(de)+r'\s*mm\s*[xX]\s*'+vs(h)]
    if fam=='O-Rings': pats.append(vs(di)+r'\s*[xX]\s*'+vs(h))
    for p in pats:
        m=re.search(r'(?<![\d,.])'+p+r'(?![\d,.])',n)
        if m:
            antes=n[:m.start()]; dep=n[m.end():]
            if fam!='O-Rings' and (re.search(r'\d $',antes) or re.match(r' \d{1,4}(\s|$)',dep)) and re.search(r'\d \d+[xX]|[xX]\d+ \d',n) and 'mm' not in n: return None
            return di,de,h
    return None
MARCAS='FAG SKF TIMKEN NSK NTN INA KOYO NACHI SNR ZWZ URB GBR ZSG SAV SABO NOK COMBAT CBT VULKAN BGL FRM STARFER MTX TEKBOND LOCTITE UNIPEGA IBIRA ZORTECH BOMVINK TRAMONTINA VONDER EUROBELT CONTINENTAL GATES GOODYEAR ORBI APC CTK CSK ERM MAK HCH PPK GIROS ARCA NORD POWELL VEDALONE ORION SPARTA EMTOP LUFKIN GEDORE KANAFLEX ROLMAX SCHIOPPA NORTON DANEVA LORENZETTI BOZZA THOMPSON KAROL STB'.split()
MSET=set(MARCAS)
MAT=[(r'\bVITON\b|\bFKM\b','Viton (FKM)','O Viton (FKM) suporta temperaturas mais altas e maior variedade de fluidos e produtos químicos que a borracha nitrílica.'),(r'\bNBR\b|NITR[IÍ]LIC','NBR (nitrílica)','A borracha nitrílica (NBR) é o material padrão para óleos minerais, graxas e combustíveis em temperatura moderada.'),(r'\bPU\b|POLIURETAN','Poliuretano (PU)','O poliuretano (PU) tem alta resistência à abrasão e ao rasgo, por isso é comum em vedações de cilindros hidráulicos.'),(r'SILICONE','Silicone','O silicone trabalha em ampla faixa de temperatura, mas tem menor resistência mecânica que a nitrílica.'),(r'\bPTFE\b|TEFLON','PTFE','O PTFE tem atrito muito baixo e resiste a praticamente todos os fluidos.'),(r'NYLON|POLIAMIDA','Nylon','O nylon é rígido, de baixo atrito e resistente ao desgaste.'),(r'\bEPDM\b','EPDM','O EPDM é indicado para água quente, vapor e fluidos de freio, e não deve ter contato com óleo mineral.')]
CONF='Confira as medidas da peça antiga ou do alojamento antes de comprar; em caso de dúvida, fale com a loja informando a aplicação.'
GEN=('As medidas estão indicadas no nome do produto',)
VED={'Retentores','O-Rings','Gaxetas','Raspadores','Anéis Backup','Guias'}
def desc_ved(c,md,mat):
    di,de,h=md; m1=f' em {mat[0]}' if mat else ''
    mt=f'Medidas: {br(di)} mm de diâmetro interno, {br(de)} mm de diâmetro externo e {br(h)} mm de altura.'
    ext=(' '+mat[1]) if mat else ''
    if c=='Retentores': return '\n\n'.join([f'Retentor{m1} para vedação de eixos rotativos. O lábio de vedação mantém o óleo ou a graxa dentro do conjunto e impede a entrada de poeira, água e outros contaminantes, protegendo rolamentos e engrenagens.'+ext, mt+f' Serve em eixo de {br(di)} mm e alojamento de {br(de)} mm.', 'Usado em redutores, motores, bombas, cubos de roda, implementos agrícolas e máquinas industriais. '+CONF])
    if c=='O-Rings': return None
    if c=='Gaxetas': return '\n\n'.join([f'Gaxeta{m1} para vedação de hastes e êmbolos em cilindros hidráulicos e pneumáticos. Os lábios se abrem com a pressão do fluido e vedam contra a haste ou a camisa, evitando vazamento e perda de força do cilindro.'+ext, mt, 'Usada em cilindros de máquinas agrícolas, de construção, prensas e equipamentos industriais. '+CONF])
    if c=='Raspadores': return '\n\n'.join([f'Raspador (limpador de haste){m1} para cilindros hidráulicos e pneumáticos. Fica na entrada do cilindro e limpa a haste no retorno, impedindo que poeira, barro e partículas cheguem às gaxetas e ao óleo.'+ext, mt+f' Para haste de {br(di)} mm.', 'Trocar o raspador junto com as gaxetas aumenta a vida do reparo. '+CONF])
    if c=='Anéis Backup': return '\n\n'.join([f'Anel backup (anel anti-extrusão){m1} para uso junto de O-rings e gaxetas. Montado no canal do lado de baixa pressão, apoia a vedação e evita que ela seja empurrada para a folga entre as peças quando a pressão é alta.'+ext, f'Medidas: {br(di)} mm de diâmetro interno, {br(de)} mm de diâmetro externo e {br(h)} mm de espessura.', CONF])
    if c=='Guias': return '\n\n'.join([f'Anel guia{m1} para cilindros hidráulicos e pneumáticos. Mantém a haste ou o êmbolo centralizado e evita o contato de metal com metal, absorvendo esforços laterais e protegendo as vedações.'+ext, mt, CONF])
STOPD=set('ROLAMENTO ROLAMENTOS RADIAL ESFERA ESFERAS FIXO ROLO ROLOS CONICO CÔNICO ESFERICO ESFÉRICO OSCILANTE AXIAL AGULHA CILINDRICO CILÍNDRICO CONTATO ANGULAR MANCAL UNITARIO UNITÁRIO AMENTO - LINHA'.split())
P=[]
for v in V:
    c=(v.get('categoria') or {}).get('nome') or ''; a=v.get('atributos') or {}; n=v['nome']; pt={}; na={}
    marca=v.get('marca')
    if not marca:
        achou=[t for t in re.findall(r'[A-ZÀ-Ú0-9]+',n.upper()) if t in MSET]
        if len(set(achou))==1:
            marca={'SABO':'Sabó','3M':'3M'}.get(achou[0],achou[0].capitalize()); pt['marca']=marca; st['marca']+=1
    # identificadores
    tem_id=bool(v.get('gtin'))
    mpn=None
    if marca and not tem_id:
        if c in('Rolamentos','Mancais'):
            toks=[t for t in n.split() if t.upper() not in STOPD and t.upper() not in MSET and t.upper().replace('/','') not in ('GBRGTOP','GTOP')]
            SUF={'ZZ','DDU','LLU','NR','TN','TVP','TVH','ECP','RSR','CM','RS','KC3','K'}
            toks=[re.sub(r'^CONJ\.','',t) for t in toks if not (t.isalpha() and len(t)>=3 and t.upper() not in SUF)]
            d=' '.join(toks).strip(' -')
            if re.search(r'\d{3}',d) and 3<=len(d)<=30 and not re.search(r'\d+\s*mm',d): mpn=d
        elif c=='Retentores':
            m=re.search(r'\b(0\d{4})\b',n)
            if m: mpn=m.group(1)
    if mpn: pt['mpn']=mpn; pt['identificadoresEstado']='informado'; st['mpn']+=1
    elif not tem_id and not marca: pt['identificadoresEstado']='sem_identificador'; st['sem_id']+=1
    # medidas, peso, embalagem
    md=medidas_validas(v,c) if c in VED else None
    dim=None; peso=None
    if md:
        di,de,h=md
        if c=='O-Rings':
            cs=(de-di)/2; vol=2*math.pi**2*((di+cs)/2)*(cs/2)**2/1000; peso=vol*1.25/1000; dim=(de,cs)
        elif c=='Retentores': vol=math.pi/4*(de**2-di**2)*h/1000; peso=vol*0.35*3.0/1000; dim=(de,h)
        else: vol=math.pi/4*(de**2-di**2)*h/1000; peso=vol*0.6*1.2/1000; dim=(de,h)
        peso=round(max(0.01,peso+0.01),3)
    elif c=='Rolamentos':
        di,de,h=fnum(a.get('diametroInternoMm')),fnum(a.get('diametroExternoMm')),fnum(a.get('alturaMm'))
        if di and de and h and di<de<=600 and h<=200 and a.get('_dossieFonte'): dim=(de,h)
    if peso and not v.get('pesoKg'): pt['pesoKg']=peso; na['_pesoOrigem']='estimado pelas medidas e pelo material; conferir na balança'; st['peso']+=1
    if dim and not v.get('alturaCm'):
        lado=max(5,math.ceil((dim[0]+20)/10)); alt=max(2,math.ceil((dim[1]+10)/10))
        pt.update(larguraCm=float(lado),comprimentoCm=float(lado),alturaCm=float(alt)); na['_embalagemOrigem']='estimada pelas medidas da peça'; st['dim']+=1
    # material e descricao
    mat=None
    for rx,nome,frase in MAT:
        if re.search(rx,n,re.I): mat=(nome,frase); break
    if mat and c in VED|{'Cordões','Juntas','Anéis','Vedações'} and not a.get('material'): na['material']=mat[0]; st['material']+=1
    d=v.get('descricao') or ''
    if c in VED and c!='O-Rings' and md and any(g in d for g in GEN):
        t=desc_ved(c,md,mat)
        if t: pt['descricao_forcar']=t; st['desc_rica']+=1
    elif mat and c in VED and d and mat[1] not in d and 'Material:' not in d:
        ps=d.split('\n\n'); ps.insert(1 if len(ps)>1 else len(ps),'Material: '+mat[0]+'. '+mat[1]); pt['descricao_forcar']='\n\n'.join(ps); st['desc_material']+=1
    if na: pt['atributos']=na
    if pt: P.append({'sku':v['sku'],'slug':v['slug'],**pt})
json.dump(P,open('patch2.json','w'),ensure_ascii=False)
print(len(P),st)
import random; random.seed(11)
for k in ('mpn','pesoKg','descricao_forcar','marca'):
    xs=[p for p in P if k in p]
    for p in random.sample(xs,min(4,len(xs))):
        nome=next(v['nome'] for v in V if v['sku']==p['sku']); print(k,'|',nome,'=>',str(p[k])[:260].replace('\n',' / '), '| dim',p.get('larguraCm'),p.get('alturaCm'))
