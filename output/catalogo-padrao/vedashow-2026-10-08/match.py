import json,re,collections,sys
V=json.load(open('veda.json')); R=json.load(open('rtl-sitemap.json'))
def norm(s):
    s=s.upper()
    for a,b in (('ÁÀÃÂ','A'),('ÉÊ','E'),('ÍÎ','I'),('ÓÔÕ','O'),('ÚÜ','U'),('Ç','C')):
        for ch in a: s=s.replace(ch,b)
    return s
STOP=set('ROLAMENTO ROLAMENTOS RIGIDO DE ESFERAS ESFERA RADIAL FIXO ROLOS ROLO CONICOS CONICO ESFERICO UMA CARREIRA AUTOCOMPENSADOR COM VEDACOES CILINDRICOS CILINDRICO CONTATO ANGULAR DUAS CARREIRAS MANCAL BUCHA FIXACAO DESMONTAGEM PORCA ARRUELA TRAVA ANEL BLOQUEIO AGULHAS AGULHA AXIAL - UNITARIO CORREIA'.split())
BR=set('GBR GTOP GBR/GTOP FAG SKF NSK NTN INA TIMKEN KOYO ZWZ ZSG SAV NORD ERM ARCA CTK CSK MAK VTO HCH PPK GIROS ORBI BGL APC STB FRM NB KG TECH URB IBC NACHI FK KML FET HTB NKE SNR ZKL IRB DPI HRB LYC NMB'.split())
def key(t):
    toks=[x for x in re.split(r'\s+',norm(t).replace(',',' ')) if x and x not in STOP and x not in BR]
    k=re.sub(r'[-./]','',''.join(toks))
    for a,b in (('2RS1','2RS'),('2RSH','2RS'),('2RSR','2RS'),('DDU','2RS'),('LLU','2RS'),('2Z','ZZ'),('ZZR','ZZ')): k=k.replace(a,b)
    return k
def base(k): return re.sub(r'(C3|C4|CM|TN9?|TVP|TVH|J|M|E|K|CC|W33|EK|CA|MB|P6|ECP|ECJ|ETN9|BEP|B|A|ATN9)+$','',k)
rk=collections.defaultdict(list)
for r in R:
    if r['t']: rk[key(r['t'])].append(r)
rb=collections.defaultdict(list)
for k,v in rk.items(): rb[base(k)].extend(v)
out=[]
for v in V:
    if v['cat'] not in ('Rolamentos','Mancais','Buchas','Porcas','Arruelas','Correias','Anéis Elásticos'): continue
    k=key(v['nome'])
    if k in rk: out.append({'sku':v['sku'],'h':rk[k][0]['h'],'tipo':'exato'})
    elif len(base(k))>=4 and base(k) in rb: out.append({'sku':v['sku'],'h':rb[base(k)][0]['h'],'tipo':'base'})
json.dump(out,open('match.json','w'))
hs=sorted(set(o['h'] for o in out))
json.dump(hs,open('handles.json','w'))
print(len(out),collections.Counter(o['tipo'] for o in out),'handles',len(hs))
