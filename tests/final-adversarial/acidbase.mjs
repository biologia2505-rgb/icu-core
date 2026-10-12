import {base,gas,engine,createEngine,basis,check,record,fp,finish} from './common.mjs';
// Primary metabolic controls. Chronicity is a duration field, not a selector of primary disorder.
for(const [h,low,high,met]of [[12,24,28,'metabolic acidosis'],[18,33,37,'metabolic acidosis'],[20,36,40,'metabolic acidosis'],[27,37.9,41.9,'metabolic alkalosis'],[28,38.6,42.6,'metabolic alkalosis'],[35,43.5,47.5,'metabolic alkalosis'],[40,47,51,'metabolic alkalosis']]){
 for(const chronicity of ['unknown','acute','chronic'])for(const [point,co,resp]of [['below',low-.01,'respiratory alkalosis'],['low',low,null],['inside',(low+high)/2,null],['high',high,null],['above',high+.01,'respiratory acidosis'],['float-low',low-fp(low),null],['float-high',high+fp(high),null]]){
 const d=gas(h,co,{Cl:128-h,chronicity,chronic:chronicity}),r=engine(d).compute(d);
 check('AB-M-'+h+'-'+chronicity+'-'+point,'1,2 acid-base/primary metabolic',d,{met,resp,compensated:resp===null},{met:r.p.met,resp:r.p.resp,compensated:r.p.respIsCompensation},chronicity==='unknown'&&point.startsWith('float')?['AB-02']:['AB-01'],basis.policy,'Technical float points represent the same boundary; ±0.01 is outside. This is an audit oracle, no source change.');
 }
}
// Explicit primary respiratory controls (independent literal anchors) remain separate.
const anchors=[[50,'acute',25,26,'respiratory acidosis'],[60,'acute',26,28,'respiratory acidosis'],[80,'acute',28,32,'respiratory acidosis'],[50,'chronic',27,28,'respiratory acidosis'],[60,'chronic',30,32,'respiratory acidosis'],[80,'chronic',36,40,'respiratory acidosis'],[30,'acute',22,23,'respiratory alkalosis'],[25,'acute',21,22.5,'respiratory alkalosis'],[30,'chronic',19,20,'respiratory alkalosis'],[25,'chronic',16.5,18,'respiratory alkalosis']];
for(const [co,chronicity,lo,hi,resp]of anchors)for(const [point,h,status,met]of [['below',lo-.01,'below','metabolic acidosis'],['low',lo,'within',null],['inside',(lo+hi)/2,'within',null],['high',hi,'within',null],['above',hi+.01,'above','metabolic alkalosis'],['float-low',lo-fp(lo),'within',null],['float-high',hi+fp(hi),'within',null]]){
 const d=gas(h,co,{chronicity,chronic:chronicity,Cl:128-h}),r=engine(d).compute(d);check('AB-R-'+co+'-'+chronicity+'-'+point,'1,2 respiratory ranges',d,{resp,met,status},{resp:r.p.resp,met:r.p.met,status:r.p.respiratoryRangeStatus});
}
for(const co of [25,30,50,60,80]){const d=gas(24,co,{SBE_input:0,notes:'COPD chronic respiratory disease',Age:80}),r=engine(d).compute(d);check('AB-unknown-'+co,'1 unknown',d,{chronicity:'unknown',guessed:false},{chronicity:r.p.chronicity,guessed:r.p.chronicity!=='unknown'});}
for(const ph of [7.34,7.35,7.36,7.44,7.45,7.46]){const d={...base,pH:ph,HCO3in:.03*40*10**(ph-6.1),pCO2:40},r=engine(d).compute(d);check('AB-pH-'+ph,'2 boundaries',d,{acidBase:ph<7.35?'acidemia':ph>7.45?'alkalemia':'normal'},{acidBase:r.p.acidBase});}
for(const co of [34.99,35,35.01,44.99,45,45.01]){const d=gas(24,co),e=engine(d),a=e.call('respiratoryCompensationRange',d);check('AB-CO-gate-'+co,'2 boundaries',d,{exists:co<35||co>45},{exists:a!==null});}
for(const h of [21.99,22,22.01,25.99,26,26.01]){const d=gas(h,40,{sbeMode:'input',SBE_input:0}),r=engine(d).compute(d);check('AB-HCO-'+h,'2 absolute thresholds',d,{met:h<22?'metabolic acidosis':h>26?'metabolic alkalosis':null},{met:r.p.met});}
for(const s of [-2.01,-2,-1.99,1.99,2,2.01]){const h=24.4+s,d={...base,HCO3in:h,pH:7.4,pCO2:h/(.03*10**1.3),SBE_input:s},r=engine(d).compute(d);check('AB-SBE-'+s,'2 SBE boundaries',d,{met:s<-2?'metabolic acidosis':s>2?'metabolic alkalosis':null},{met:r.p.met});}
// Mixed-normal-pH / anion confidence cross product; explicit support is not inferred from SIG or notes.
for(const Na of [140,145,145.01,160])for(const Alb of [20,40])for(const Lac of [1,2,2.01,5])for(const src of ['unknown','no','yes']){
 const d=gas(24,40,{Na,Cl:Na-24-18,Alb,Lac,anionSourceConfirmed:src,SBE_input:0}),r=engine(d).compute(d);
 check('AG-'+Na+'-'+Alb+'-'+Lac+'-'+src,'3 HAGMA support',d,{confidence:Lac>2||src==='yes'?'supported':'possible',delta:false},{confidence:r.h.confidence,delta:r.dd.applicable});
}
for(const h of [18,21.99,22,22.01,26,35])for(const Na of [140,145,145.01]){
 const co=h<22?1.5*h+8:40,d=gas(h,co,{Na,Cl:Na-h-20,Lac:1,anionSourceConfirmed:'yes'}),r=engine(d).compute(d);
 check('DD-app-'+h+'-'+Na,'3 ratio applicability',d,{applicable:h<22&&Na<=145},{applicable:r.dd.applicable});
}
for(const ratio of [.39,.4,.41,.89,.9,.91,1.49,1.5,1.51,1.99,2,2.01]){
 const d=gas(16,32,{Cl:140-16-(12+8*ratio),Alb:40,Lac:1}),r=engine(d).compute(d);check('DD-class-'+ratio,'3 DD classification',d,{NAGMA:ratio<.9,alk:ratio>2,possible:ratio>1.5&&ratio<=2},{NAGMA:r.syn.processes.includes('NAGMA'),alk:r.syn.processes.includes('metabolic alkalosis'),possible:r.syn.possibleProcesses.includes('metabolic alkalosis')},['AB-03'],basis.policy,'At a computed exact .9/1.5/2 ratio boundary, representation error must not invent another clinical process.');
}
for(const [h,co]of [[24,40],[35,46],[31,60]]){const d=gas(h,co,{Cl:140-h-20,Lac:8,anionSourceConfirmed:'yes',chronicity:co===60?'chronic':'unknown'}),r=engine(d).compute(d);check('AG-composition-'+h+'-'+co,'3 composition consistency',d,{supported:true,unqualifiedIsolated:false},{supported:r.h.hasHAGMA,unqualifiedIsolated:r.syn.title==='Изолированное нарушение'},['AB-04'],basis.policy,'Additional supported acid/anion evidence must be represented or qualified; this oracle does not demand an unconditionally proven second diagnosis.');}
// SID/SIG cannot independently turn an isolated profile into HAGMA. Literal formula arithmetic.
for(const profile of ['simple','charged'])for(const Alb of [20,40])for(const Lac of [1,5])for(const PO4 of [.5,1.1,3]){
 const d=gas(24,40,{sidModel:profile,Alb,Lac,PO4,Cl:106}),r=engine(d).compute(d),SIDa=140+4+(profile==='charged'?4.2:2.1)-106-Lac,SIDe=24+Alb*(.123*d.pH-.631)+PO4*(.309*d.pH-.469);
 check('ST-'+profile+'-'+Alb+'-'+Lac+'-'+PO4,'4 Stewart arithmetic',d,{SIDa,SIDe,SIG:SIDa-SIDe},{SIDa:r.st.SIDa,SIDe:r.st.SIDe,SIG:r.st.SIG},[],basis.math,'Numeric arithmetic comparison only (1e−10); not a clinical tolerance.','approx');
 if(Lac===1)check('ST-no-auto-HAGMA-'+profile+'-'+Alb+'-'+PO4,'4 Stewart isolation',d,{hagma:false},{hagma:r.h.hasHAGMA});
}
for(const profile of ['simple','charged'])for(const Alb of [20,40]){
 const pH=6.1+Math.log10(24/1.2),PO4=1.1,charge=Alb*(.123*pH-.631)+PO4*(.309*pH-.469),Cl=140+4+(profile==='charged'?4.2:2.1)-1-24-charge;
 const d=gas(24,40,{Cl,Alb,PO4,sidModel:profile}),e=engine(d);e.run();check('ST-diagram-zeroSIG-'+profile+'-'+Alb,'4 Stewart presentation',d,{falseHiddenAnion:false},{falseHiddenAnion:e.text('gamble-summary').includes('есть скрытый анион или ошибка ввода')},['UI-01'],basis.math,'SIDa−SIDe≈0 independently constructed. Chart omits albumin/phosphate charges and uses singly counted Ca/Mg even in charged profile.');
}
for(const co of [30,40,50,60]){const d=gas(18,co,{Cl:100}),r=engine(d).compute(d);check('AB-mixed-pH-'+co,'1 opposite processes',d,{hasResp:co<33||co>37},{hasResp:!!r.p.resp});}
finish('acidbase-matrix');
