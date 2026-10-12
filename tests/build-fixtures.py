"""Independent fixtures: original inputs, Decimal oracle, literal medical gold anchors.

This generator does not read the modified application or invoke its functions.
"""
from pathlib import Path
from decimal import Decimal as D
import hashlib
import importlib.util
import json
import re

root=Path(__file__).resolve().parents[1]
original=root.parent/'icu-validation/tests/fixtures/clinical-scenarios.json'
scenarios=json.loads(original.read_text())
spec=importlib.util.spec_from_file_location('independent_arithmetic',root/'tests/arithmetic-profile.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
gold=(root/'reference/ICU_CORE_35_gold_standard_detailed.md').read_text()
confidence_policy=root/'reference/HAGMA_confidence_update_2026-10-08.md'
sections={m.group(1):m.group(2) for m in re.finditer(r'^## ((?:DYSNATREMIA|OXYGENATION-SCORES)-\d+) —[^\n]+\n(.*?)(?=^## |^# Итог|\Z)',gold,re.M|re.S)}
out=[]
for number,s in enumerate(scenarios,1):
    if not 251<=number<=285:continue
    d=s['input'];section=sections[s['id']]
    math=module.oracle(d,s['config'])
    # Measured Na in Stewart is a separately approved profile change.
    measured=module.oracle(dict(d,naCorr='off'),s['config'])
    math['st']=measured['st']
    del math['b']['AG_Na_corr'];del math['st']['SIG_Na_corr']
    math['b']['AG_Kellum']=float(D(str(d['Na']))+D(str(d['K']))-D(str(d['Cl']))-D(str(d['HCO3in']))-D('.2')*D(str(d['Alb']))-D('1.5')*D(str(d['PO4']))-D(str(d['Lac'])))
    math['b']['Na_measured']=d['Na']
    math['b']['Na_glucose']=float(D(str(d['Na']))+D('1.6')*max(D(0),(D(str(d['Gluc']))-D('5.5'))/D('5.5')))
    math['b']['SBE_calculated']=math['b']['SBE_calc']
    clinical={'text':re.search(r'\*\*Итоговый клинический эталон\.\*\* (.*)',section).group(1)}
    if s['category']=='DYSNATREMIA':
        n=int(s['id'][-2:])
        clinical.update(primary='metabolic acidosis' if n in [1,2,3,4,8,9,10,11,15] else None,
                        acidifyingShift=n in [5,12],hagma=n in [8,9,10,11,15],deltaApplicable=n in [8,9],
                        anionConfidence='supported' if n in [8,9,10,11,15] else 'possible' if n in [6,7,12,13,14] else 'none',
                        componentPossible=n in [6,7,8,9,10,11,12,13,14,15],
                        adequateWinter=n in [1,2,3,4,8,9,10,11,15],
                        sodiumInterpretation='persists' if n in [2,3,4] else 'corrected-normal' if n==5 else None)
        # Explicit decimal anchors from the signed gold; rounding tolerance is 0.011.
        anchors={}
        for k,p in {'AG':r'AG=([\d,]+)','AGcorr':r'AGcorr=([\d,]+)','AG_Kellum':r'AG Kellum=([\d,]+)',
                    'SIDa':r'SIDa≈([\d,]+)','SIDe':r'SIDe≈([\d,]+)','SIG':r'SIG≈([\d,]+)',
                    'Osm_calc':r'= \*\*([\d,]+) мОсм'}.items():
            m=re.search(p,section);assert m,(s['id'],k);anchors[k]=float(m.group(1).rstrip(',').replace(',','.'))
        clinical['goldNumericAnchors']=anchors
    else:
        sf=re.search(r'Дыхание=(\d+), тромбоциты=(\d+), сердечно-сосудистый компонент=(\d+); почки: Cr=(\d+), диурез=(\d+), renal=max=(\d+)',section)
        ap=re.search(r'Кислородный компонент=(\d+), креатинин=(\d+)',section)
        totals=re.search(r'Итого ≈(\d+) при ARF=no и ≈(\d+) при ARF=yes',section)
        clinical.update(primary=None,hagma=False,anionConfidence='none',componentPossible=False,deltaApplicable=False,sofaComponents=list(map(int,sf.groups())),
                        sofaTotal=int(re.search(r'Итого SOFA=(\d+)',section).group(1)),
                        apacheComponents=list(map(int,ap.groups())),apacheTotals=list(map(int,totals.groups())),
                        news2=2,qsofa=0,sirs=0)
        pf=float(re.search(r'P/F=\*\*([\d,]+)',section).group(1).replace(',','.'))
        clinical['berlin']='none' if d['PEEP']<5 or pf>300 else 'severe' if pf<=100 else 'moderate' if pf<=200 else 'mild'
    clinical['confidenceAuthority']='HAGMA_confidence_update_2026-10-08.md: explicit clinician amendment; original gold text retained'
    qc=[]
    if abs(math['b']['SBE_calc']-d['SBE_input'])>2:qc.append('SBE_CONFLICT')
    if d['Na']>145:qc.append('HYPERNATREMIA_AG_LIMIT')
    if d['pO2']<60 and d['SpO2']>=95:qc.append('PAO2_SPO2_STRONG')
    elif 60<=d['pO2']<=79 and d['SpO2']>=98:qc.append('PAO2_SPO2_SOFT')
    if math['b']['PF']<=300 and d['PEEP']<5:qc.append('BERLIN_PRESSURE_NOT_MET')
    if d['Vaso']!='none':qc.append('MAP_ON_VASOPRESSOR')
    out.append({'id':s['id'],'number':number,'scenario':s,'math':math,'clinical':clinical,'qcCodes':qc})
assert len(out)==35
(root/'tests/cases-35.json').write_text(json.dumps(out,ensure_ascii=False,indent=2,allow_nan=False)+'\n')
(root/'tests/oracle-manifest.json').write_text(json.dumps({'cases':35,'originalFixtureSHA256':hashlib.sha256(original.read_bytes()).hexdigest(),'goldSHA256':hashlib.sha256(gold.encode()).hexdigest(),'confidencePolicySHA256':hashlib.sha256(confidence_policy.read_bytes()).hexdigest(),'construction':'Decimal profile + measured Na Stewart + Kellum + explicit anchors parsed from clinician gold; confidence labels from explicit clinician amendment; no application import'},ensure_ascii=False,indent=2)+'\n')
print('35 independent regression fixtures generated; original scenarios unchanged')
