"""Independent decimal arithmetic for the explicitly selected v30.1 formula profile.

No application file or function is imported. Formula selection is NOT clinical approval.
Independent controls and source-backed clinical tables are kept separately.
"""
from decimal import Decimal, getcontext
getcontext().prec = 40
D = lambda x: Decimal(str(x))
NA = {"0.9": (154, .154), "3": (513, .513), "10": (1700, 1.7)}
K = {"4": (536, .536), "7.5": (1000, 1), "10": (1340, 1.34)}

def number(x):
    return {"$number": "NaN"} if x is None else float(x)

def effective(v, fallback):
    return D(fallback if v is None or v == 0 else v)

def oracle(d, config):
    ph, co2, sodium, chloride = map(D, (d['pH'], d['pCO2'], d['Na'], d['Cl']))
    hh = D('.03') * co2 * (D(10) ** (ph - D('6.1')))
    h = hh if d['HCO3in'] is None else D(d['HCO3in'])
    glucose = D(d['Gluc'])
    nc = sodium + D('1.6') * (glucose - D('5.5')) / D('5.5') if d['naCorr']=='on' and glucose>D('5.5') else sodium
    albumin = effective(d['Alb'], 40)
    ag = sodium - chloride - h
    ac = ag + D('.25') * (40 - albumin)
    da, dh = ac - 12, 24 - h
    ratio = da / dh if h < 22 and da > 0 else None
    be_calc = h - D('24.4') + D('16.2') * (ph - D('7.4'))
    be = be_calc if d['sbeMode']=='calc' or d['SBE_input'] is None else D(d['SBE_input'])
    fw = D('.3') * (sodium - 140)
    clbe = 104 - chloride * 140 / sodium
    albbe = (D('.148') * ph - D('.818')) * (40 - albumin)
    fio = d['FiO2']
    po = d['pO2']
    pf = D(po) * 100 / D(fio) if po is not None and fio is not None and fio>0 else None
    aa = D(fio) * D('7.13') - co2 / D('.8') - D(po) if fio is not None and fio>20 and po is not None else None
    os = D('1.86') * sodium + glucose + effective(d['Ur'], 0) + 9
    b = dict(HCO3calc=hh,HCO3=h,NaCorr=nc,AG=ag,AGcorr=ac,AG_Na_corr=ac-(sodium-140) if sodium>140 else ac,deltaAG=da,deltaHCO3=dh,deltaDelta=ratio,SBE_calc=be_calc,SBE=be,SBE_FW=fw,SBE_Cl=clbe,SBE_Alb=albbe,SBE_UA=be-fw-clbe-albbe,PF=pf,A_a_est=aa,Osm_calc=os,Osm_gap=D(d['Osm_in'])-os if d['Osm_in'] is not None else None)
    calcium, magnesium = effective(d['Ca'], 1.2), effective(d['Mg'], .9)
    mult = 2 if d['sidModel']=='charged' else 1
    sida = nc + D(d['K']) + mult*(calcium+magnesium)-chloride-D(d['Lac'])
    ach = albumin * (D('.123') * ph - D('.631'))
    pch = effective(d['PO4'],1.1) * (D('.309')*ph-D('.469'))
    side=h+ach+pch
    sidec=h+D(40)*(D('.123')*ph-D('.631'))+pch if albumin<30 else side
    sig=sida-side
    st=dict(SIDa=sida,Alb_charge=ach,PO4_charge=pch,SIDe=side,SIDe_corr=sidec,SIG=sig,SIG_corr=sida-sidec,SIG_Na_corr=sig-(sodium-140) if sodium>145 else sig)
    mass=D(d['Weight']) if d['Weight'] is not None and d['Weight']>0 else D(70)
    age=d['Age']
    coef=D('.5' if age is not None and age>=65 else '.6') if d['Sex']=='M' else D('.6' if age is not None and age<18 else '.5' if age is not None and age<65 else '.45')
    total=mass*coef
    fields=['waterDeficit','naDeficit','kDeficit','clDeficit','naVolume','kVolume','deltaNa','deltaK']
    bal=dict(W=mass,tbwCoef=coef,T=total,**{k:None for k in fields})
    if sodium>145:bal['waterDeficit']=total*(sodium-140)/140
    if sodium<135:
        bal['naDeficit']=total*(140-sodium)
        conc,perml=map(D,NA[config['naSolution']])
        bal['naVolume']=bal['naDeficit']/perml
        bal['deltaNa']=(conc-sodium)/(total+1)
    if d['K']<3.5:
        bal['kDeficit']=mass*D('.4')*(D('4.5')-D(d['K']))
        bal['kVolume']=bal['kDeficit']/D(K[config['kSolution']][1])
        bal['deltaK']=bal['kDeficit']/(mass*D('.4'))
    if chloride<98:bal['clDeficit']=mass*D('.5')*(103-chloride)
    return {group:{key:number(value) for key,value in values.items()} for group,values in [('b',b),('st',st),('bal',bal)]}
