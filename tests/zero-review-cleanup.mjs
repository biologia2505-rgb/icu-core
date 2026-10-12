import fs from 'node:fs';
import path from 'node:path';
import {base,gas,createEngine,engine,check,finish,root,encode} from './final-core-testkit.mjs';
for(const boundary of [7.35,7.45]){
 const eps=4*Number.EPSILON*Math.max(1,Math.abs(boundary));
 for(const delta of [-eps/2,0,eps/2,-1e-9,1e-9,-.001,.001]){
  const value=boundary+delta,d=gas(24,40,{pH:value}),e=engine(d),b=e.call('calcBasic',d),expected=Math.abs(delta)<=eps?'normal':value<7.35?'acidemia':value>7.45?'alkalemia':'normal';
  check(`pH-${boundary}-${delta}-classification`,'ZERO-PH',d,expected,e.call('detectPrimary',d,b).acidBase);
  const expectedLabel=expected==='normal'?'pH в нормальном диапазоне':expected==='acidemia'?'ацидемия':'алкалемия';
  check(`pH-${boundary}-${delta}-wording`,'ZERO-PH',d,expectedLabel,e.call('phCompensation',d).status);
  e.run();check(`pH-${boundary}-${delta}-raw-preserved`,'ZERO-PH',d,value,e.read().pH);
  check(`pH-${boundary}-${delta}-dashboard`,'ZERO-PH',d,expected==='normal'?'погранично':expectedLabel,e.text('dash-pH-status'));
  const hb={...b,HCO3:20,deltaAG:4,SBE_calc:0},h={hasHAGMA:true};check(`pH-${boundary}-${delta}-delta-gate`,'ZERO-PH',d,expected==='acidemia',e.call('deltaDeltaApplicable',{...d,Na:140},hb,h));
 }
}
for(const Age of [14,16,17,18]){
 const d={...base,Age},e=engine(d),r=e.call('calcAPACHE2',d,e.call('calcBasic',d));
 check('APACHE-age-'+Age+'-applicable','ZERO-APACHE-AGE',d,Age>16,r.applicable);
 if(Age<=16){check('APACHE-age-'+Age+'-no-total','ZERO-APACHE-AGE',d,true,!Number.isFinite(r.total));check('APACHE-age-'+Age+'-status','ZERO-APACHE-AGE',d,'APACHE II не применяется: исходная система не валидировалась для пациентов ≤16 лет.',r.status);}
 else check('APACHE-age-'+Age+'-known-total','ZERO-APACHE-AGE',d,true,Number.isFinite(r.total));
 check('APACHE-age-'+Age+'-other-module','ZERO-APACHE-AGE',d,true,e.call('calcNEWS2',d).complete);
 e.run();check('APACHE-age-'+Age+'-report','ZERO-APACHE-AGE',d,true,e.evaluate('lastReport').includes(Age<=16?'APACHE II: Не применяется':'APACHE II:'));
}
for(const [PEEP,respiratorySupport]of [[5,'no'],[0,'yes']])for(const O2support of ['no','yes','unknown']){
 const d={...base,PEEP,respiratorySupport,O2support,pO2:60,FiO2:50,bilateral:'yes',timing:'yes',noncardiac:'yes'},storage=new Map(),e=createEngine({storage});e.input(d);const before=e.read(),b=e.call('calcBasic',before),qc=e.call('clinicalQC',before,b),sofa=e.call('calcSOFA',before,b),n=e.call('calcNEWS2',before);
 check(`context-${PEEP}-${respiratorySupport}-${O2support}-Berlin`,'ZERO-CONTEXT',d,PEEP>=5,e.call('ardsAssessment',before,b).confirmed);
 check(`context-${PEEP}-${respiratorySupport}-${O2support}-SOFA`,'ZERO-CONTEXT',d,respiratorySupport==='yes'?3:2,sofa.items[0].score);
 check(`context-${PEEP}-${respiratorySupport}-${O2support}-NEWS`,'ZERO-CONTEXT',d,O2support==='unknown'?null:O2support==='yes'?2:0,n.items.find(x=>x.name==='Кислород').score);
 check(`context-${PEEP}-${respiratorySupport}-${O2support}-QC`,'ZERO-CONTEXT',d,PEEP>=5&&respiratorySupport==='no',qc.warnings.some(x=>x.code==='PRESSURE_SUPPORT_CONTEXT'));
 e.run();for(const label of ['PEEP/CPAP — Berlin','Respiratory support — SOFA','Supplemental oxygen — NEWS2'])check(`context-${PEEP}-${respiratorySupport}-${O2support}-report-${label}`,'ZERO-CONTEXT',d,true,e.evaluate('lastReport').includes(label));
 const record=e.call('makeHistory',e.read(),e.compute(e.read()).syn);e.call('saveHistory',record);
 for(const mode of ['same','fresh']){const reload=mode==='same'?e:createEngine({storage});reload.input({PEEP:12,respiratorySupport:'unknown',O2support:'unknown'});reload.call('loadHistory',0);for(const k of ['PEEP','respiratorySupport','O2support'])check(`context-${PEEP}-${respiratorySupport}-${O2support}-${mode}-${k}`,'ZERO-CONTEXT',d,before[k],reload.read()[k]);}
}
finish('zero-review-cleanup');
