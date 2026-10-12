import {base,gas,engine,createEngine,check,finish,source} from './final-core-testkit.mjs';
import fs from 'node:fs';
import {root} from './final-core-testkit.mjs';
const fp=x=>Number.EPSILON*Math.max(1,Math.abs(x));
for(const chronicity of ['unknown','acute','chronic'])for(const [h,co,pH,met]of [[18,33,7.34,'metabolic acidosis'],[35,46,7.5,'metabolic alkalosis']]){
 const d=gas(h,co,{pH,SBE_input:h-24.4+16.2*(pH-7.4),chronicity,chronic:chronicity,Cl:128-h}),r=engine(d).compute(d);
 check('AB-01-metabolic-anchor-'+h+'-'+chronicity,'AB-01',d,{met,resp:null,comp:true,primary:met},{met:r.p.met,resp:r.p.resp,comp:r.p.respIsCompensation,primary:r.p.primaryProcess});
}
for(const [h,co,pH,resp]of [[31,60,7.33,'respiratory acidosis'],[20,30,7.46,'respiratory alkalosis']]){
 const d=gas(h,co,{pH,SBE_input:h-24.4+16.2*(pH-7.4),chronicity:'chronic',chronic:'chronic',Cl:128-h}),r=engine(d).compute(d);
 check('AB-01-preserve-chronic-respiratory-'+h,'AB-01',d,{resp,met:null,match:true},{resp:r.p.resp,met:r.p.met,match:r.p.respiratoryCompensationMatch});
}
for(const h of [12,18,20]){const lo=1.5*h+8-2,hi=1.5*h+8+2;for(const [tag,co,resp]of [['low',lo,null],['high',hi,null],['inside',(lo+hi)/2,null],['float-low',lo-fp(lo),null],['float-high',hi+fp(hi),null],['below',lo-.01,'respiratory alkalosis'],['above',hi+.01,'respiratory acidosis'],['real-below',lo-1e-9,'respiratory alkalosis'],['real-above',hi+1e-9,'respiratory acidosis']]){
 const d=gas(h,co,{Cl:128-h}),r=engine(d).compute(d);check('AB-02-Winter-'+h+'-'+tag,'AB-02',d,{met:'metabolic acidosis',resp,comp:resp===null},{met:r.p.met,resp:r.p.resp,comp:r.p.respIsCompensation});
}}
for(const [h,co,chronicity]of [[35,46,'unknown'],[31,60,'chronic']]){
 const d=gas(h,co,{Cl:140-h-20,Lac:8,anionSourceConfirmed:'yes',chronicity,chronic:chronicity}),r=engine(d).compute(d);
 check('AB-04-supported-'+h,'AB-04',d,{confidence:'supported',inConfirmed:true,isolated:false},{confidence:r.h.confidence,inConfirmed:r.syn.processes.includes('HAGMA'),isolated:r.syn.title==='Изолированное нарушение'});
 const possible={...d,Lac:1,anionSourceConfirmed:'unknown'},q=engine(possible).compute(possible);
 check('AB-04-possible-'+h,'AB-04',possible,{confidence:'possible',confirmed:false,possible:true,isolated:false},{confidence:q.h.confidence,confirmed:q.syn.processes.includes('HAGMA'),possible:q.syn.possibleProcesses.includes('HAGMA'),isolated:q.syn.title==='Изолированное нарушение'});
}
for(const id of ['TRIPLE-09','TRIPLE-10']){
 const c=JSON.parse(fs.readFileSync(root+'/reference/clinical-scenarios-original.json')).find(x=>x.id===id),d={...c.input,...c.context},r=engine(d).compute(d);
 check('AB-04-applicable-delta-preserves-components-'+id,['AB-01','AB-04'],d,{confidence:'supported',deltaApplicable:true,confirmed:['HAGMA','metabolic alkalinizing component','respiratory alkalosis']},{confidence:r.h.confidence,deltaApplicable:r.dd.applicable,confirmed:[...r.syn.processes].sort()},'User 2026-10-12 Δ/Δ >2 policy: probable alkalinizing component replaces the prior classic label; gas and ratio calculations unchanged.');
}
for(const [h,co]of [[27,50],[26.99,50],[18,40]]){
 const d=gas(h,co,{chronicity:'chronic',chronic:'chronic'}),r=engine(d).compute(d);
 check('AB-01-normal-pH-model-evaluation-'+h,'AB-01',d,{notFromDuration:true},{notFromDuration:r.p.acidBase!=='normal'||r.p.respiratoryCompensationMatch||r.p.respIsCompensation||r.p.primaryProcessCertain===false});
}
for(const co of [20,30,40,50,60,80])for(const diff of [-2.01,-2,-1.99,1.99,2,2.01]){
 const d=gas(24,co,{HCO3in:24+diff,Cl:90}),e=engine(d),r=e.compute(d),q=e.call('clinicalQC',d,r.b);
 check('QC-01-HH-'+co+'-'+diff,'QC-01',d,{conflict:Math.abs(diff)>2,blocked:Math.abs(diff)>2,hagmaUnreliable:Math.abs(diff)>2},{conflict:q.warnings.some(w=>w.code==='HCO3_CONFLICT'),blocked:!!r.p.invalid,hagmaUnreliable:r.h.confidence==='unreliable'},'HAGMA elevated by fixture AGcorr17; all consumers share the same representation guard.');
 if(Math.abs(diff)>2)check('QC-01-blocked-primary-uncertainty-'+co+'-'+diff,['AB-01','QC-01'],d,{certain:false},{certain:r.p.primaryProcessCertain},'A blocked gas sample cannot claim certainty about a primary process.');
}
for(const fi of [.21,.5,1,0,-1,100.01,101,100,50,21]){
 const d={...base,FiO2:fi,respiratorySupport:'yes'},e=engine(d),r=e.compute(d);e.run();const invalid=fi<=1||fi>100;
 check('QC-02-FiO2-'+fi,'QC-02',d,{PFavailable:!invalid,SOFAavailable:!invalid,warn:invalid,input:fi},{PFavailable:Number.isFinite(r.b.PF),SOFAavailable:r.scales[3].items[0].available,warn:e.text('qcResults').includes('FiO₂')&&e.text('qcResults').includes('Недопустим')||e.text('qcResults').includes('похожа на долю'),input:e.read().FiO2},'The percent field rejects fractional-style representation and keeps100valid; values remain unmodified.');
}
for(const [field,value,code]of [['GCS',16,'INVALID_GCS'],['GCS',2,'INVALID_GCS'],['baselineSOFA',-1,'INVALID_BASELINE_SOFA'],['baselineSOFA',25,'INVALID_BASELINE_SOFA'],['baselineSOFA',2.5,'INVALID_BASELINE_SOFA'],['Urine',-1,'INVALID_URINE'],['Gluc',-1,'INVALID_GLUCOSE']]){
 const d={...base,[field]:value},e=engine(d),r=e.compute(d);e.run();const q=e.call('clinicalQC',d,r.b);
 check('QC-02-domain-'+field+'-'+value,'QC-02',d,{warning:true,preserved:value},{warning:q.warnings.some(w=>w.code===code)&&e.evaluate('lastReport').includes(code),preserved:e.read()[field]});
}
for(const fi of [21,50,100]){
 const d={...base,gasSampleType:'venous',FiO2:fi,pO2:60,PEEP:5,bilateral:'yes',timing:'yes',noncardiac:'yes',respiratorySupport:'yes'},e=engine(d),r=e.compute(d);e.run();
 check('OX-01-venous-'+fi,'OX-01',d,{ARDS:false,SOFA:false,APACHE:false,acidBaseBlocked:false,rawLabel:true},{ARDS:r.ards.confirmed,SOFA:r.scales[3].items[0].available,APACHE:r.scales[4].items.find(i=>i.name==='Оксигенация').available,acidBaseBlocked:!!r.p.invalid,rawLabel:e.evaluate('lastReport').includes('недиагностическая арифметика по венозному pO₂')});
}
for(const map of [50,60,64.99,65,65.01,70,90])for(const Lac of [2,2.01,3]){
 const d={...base,SBP:map,DBP:map,Cr:2.01*88.4,Lac,Vaso:'norepi_low',infection:'yes',infectionRelatedOrganDysfunction:'yes',adequateResuscitation:'yes',vasopressorRequirement:'yes'},r=engine(d).compute(d);
 check('SEP-01-MAP-'+map+'-Lac-'+Lac,'SEP-01',d,{shock:Lac>2,targetNote:Lac>2&&map<65},{shock:r.sepsis.shockConfirmed,targetNote:r.sepsis.shockStatus.includes('на текущем измерении не достигнут')});
}
for(const Weight of [NaN,undefined,0,-1]){
 const d={...base,Weight,Na:160,K:3,Cl:95},r=engine(d).compute(d);check('EL-01-missing-'+String(Weight),'EL-01',d,{unavailable:true},{unavailable:[r.bal.W,r.bal.T,r.bal.waterDeficit,r.bal.naDeficit,r.bal.kDeficit,r.bal.clDeficit,r.bal.naVolume,r.bal.kVolume].every(Number.isNaN)});
 const e=engine(d);e.run();for(const id of ['balanceResults','balanceExplanations','dash-balance','finalResults'])check('EL-01-unavailable-display-'+id+'-'+String(Weight),'EL-01',d,{unavailable:true,falseNoDeficit:false},{unavailable:e.text(id).includes('Вес не задан'),falseNoDeficit:e.text(id).includes('Расчётных дефицитов не выявлено')});
 check('EL-01-unavailable-report-'+String(Weight),'EL-01',d,{unavailable:true},{unavailable:e.evaluate('lastReport').includes('Вес не задан')});
}
{
 const d={...base,Na:130,Gluc:40},e=engine(d);e.run();const r=e.compute(d);
 check('EL-02-conditional-Na-deficit','EL-02',d,{qualified:true,measuredAG:3,deficit:420},{qualified:e.text('balanceResults').includes('не доказывает фактическую потерю')&&e.evaluate('lastReport').includes('не доказывает фактическую потерю'),measuredAG:r.b.AG,deficit:r.bal.naDeficit});
 for(const id of ['balanceExplanations','dash-balance','finalResults'])check('EL-02-all-views-qualified-'+id,'EL-02',d,{qualified:true},{qualified:(e.text(id).includes('Условная расчётная оценка')||e.text(id).includes('условная расчётная оценка'))&&e.text(id).includes('не доказывает фактическую потерю')});
}
for(const profile of ['simple','charged'])for(const Alb of [20,40]){
 const d=gas(24,40,{sidModel:profile,Alb}),e=engine(d),r=e.compute(d);d.Cl=d.Na+d.K+(profile==='charged'?2*d.Ca+2*d.Mg:d.Ca+d.Mg)-d.Lac-r.st.SIDe;e.input(d);e.run();const chart=e.charts.find(c=>c.config.type==='bar'),parts=chart.config.data.datasets;
 const cat=parts.reduce((s,v)=>s+v.data[0],0),an=parts.reduce((s,v)=>s+v.data[1],0);
 check('UI-01-diagram-'+profile+'-'+Alb,'UI-01',d,{balance:true,warning:false,alb:true,phosphate:true},{balance:Math.abs(cat-an)<1e-10,warning:e.text('gamble-summary').includes('скрытый анион'),alb:parts.some(v=>v.label==='Заряд альбумина'),phosphate:parts.some(v=>v.label==='Заряд фосфата')});
}
for(const acuity of ['auto','unknown','acute','chronic']){const d={...base,acuity},e=engine(d);e.run();check('UI-02-acuity-'+acuity,'UI-02',d,{value:acuity==='auto'?'unknown':acuity,unknownText:acuity==='auto'||acuity==='unknown'},{value:e.compute(d).bal.acuity,unknownText:e.text('balanceResults').includes('Длительность неизвестна')});}
for(const x of [{K:6},{Cl:110}]){const d={...base,...x},e=engine(d);e.run();check('UI-03-no-deficit-wording-'+JSON.stringify(x),'UI-03',d,{neutral:true,falseNormal:false},{neutral:e.text('dash-balance').includes('Расчётных дефицитов не выявлено'),falseNormal:e.text('dash-balance').includes('Электролитных нарушений нет')});}
{
 const d={...base,sampleSimultaneity:'no'},e=engine(d);e.run();check('UI-04-nonsynchronous-report','UI-04',d,{QC:true,report:true,blocked:false},{QC:e.text('qcResults').includes('не одновременны'),report:e.evaluate('lastReport').includes('NON_SIMULTANEOUS_SAMPLE'),blocked:!!e.compute(d).p.invalid});
}
for(const [h,co]of [[31,60],[20,30]]){const d=gas(h,co,{chronicity:'chronic',chronic:'chronic',Cl:128-h}),e=engine(d);e.run();check('UI-05-HCO3-'+h,'UI-05',d,{falseMetLabel:false},{falseMetLabel:/мет\. ацидоз|мет\. алкалоз/.test(e.text('dash-HCO3-status'))});}
for(const infection of ['yes','no','unknown']){const d={...base,infection},e=engine(d);e.run();check('UI-06-infection-'+infection,'UI-06',d,{text:true},{text:e.text('sepsisResults').includes('<span>Инфекция</span><span>'+(infection==='yes'?'Да':infection==='no'?'Нет':'Неизвестно')+'</span>')});}
{
 const d={...base,pO2:NaN},e=engine(d);e.run();check('UI-07-unavailable','UI-07',d,{generic:true,wrongARF:false},{generic:e.text('scalesResults').includes('Недоступно'),wrongARF:e.text('scalesResults').includes('ARF неизвестен')});
}
for(const x of [{},{Alb:NaN},{Ur:NaN},{GCS:NaN},{SBE_input:20}]){const d={...base,...x},e=engine(d);e.run();const value=e.text('riskValue');check('EXTRA-RISK-01-status-'+JSON.stringify(Object.keys(x)),'EXTRA-RISK-01',d,{noPercent:true,status:true},{noPercent:!value.includes('%'),status:['Данные полные','Есть предупреждения','Интерпретация ограничена'].includes(value)});}
check('EXTRA-RISK-01-no-weighted-model','EXTRA-RISK-01',{}, {removed:true},{removed:!createEngine().evaluate('updateRisk.toString()').includes('risk+=')});
finish('final-core-defects');
