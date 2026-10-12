import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createEngine,sourceHash,sourcePath} from './adapter/icu-html.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fixtures=JSON.parse(fs.readFileSync(path.join(root,'tests/cases-35.json'),'utf8'));
const rows=[];
const encode=v=>JSON.parse(JSON.stringify(v,(_,x)=>x===undefined?{$undefined:true}:typeof x==='number'&&!Number.isFinite(x)?{$number:String(x)}:x));
function plain(x){return JSON.parse(JSON.stringify(x))}
function group(row,kind,run){
  const tests=[];
  const expect=(label,actual,expected,tolerance=null)=>{
    const pass=tolerance!==null?Number.isFinite(actual)&&Math.abs(actual-expected)<=tolerance:JSON.stringify(encode(actual))===JSON.stringify(encode(expected));
    tests.push({label,status:pass?'PASS':'FAIL',expected:encode(expected),actual:encode(actual),...(tolerance!==null?{difference:Number.isFinite(actual)?actual-expected:null,tolerance}:{})});
  };
  try{run(expect)}catch(error){tests.push({label:'execution',status:'FAIL',expected:'Successful execution',actual:String(error.stack||error)})}
  row[kind]={status:tests.length&&tests.every(t=>t.status==='PASS')?'PASS':'FAIL',checks:tests};
}
function selected(d,context){
  const merged={...d,...context};
  // Explicit test context is transferred to new UI fields; original fixture remains unchanged.
  for(const key of ['respiratorySupport','adequateResuscitation'])if(typeof merged[key]==='boolean')merged[key]=merged[key]?'yes':'no';
  return merged;
}
for(const f of fixtures){
  const engine=createEngine();engine.input(f.scenario.input,f.scenario.config);
  const d=selected(f.scenario.input,f.scenario.context),before=JSON.stringify(f.scenario);
  const r=engine.compute(d),sofa=r.scales[3],apache=r.scales[4];
  const row={id:f.id,number:f.number,actual:encode(r),clinicalInputQC:null};
  group(row,'math',expect=>{
    for(const [name,fields]of Object.entries(f.math))for(const [key,expected]of Object.entries(fields)){
      if(name==='bal'&&key==='naVolume'){expect('bal.naVolume removed by v31 sodium P1',Number.isNaN(r.bal.naVolume),true);continue;}
      if(expected&&expected.$number==='NaN')expect(name+'.'+key,Number.isNaN(r[name][key]),true);
      else expect(name+'.'+key,r[name][key],expected,1e-6+1e-9*Math.abs(expected));
    }
    for(const [key,expected]of Object.entries(f.clinical.goldNumericAnchors||{}))expect('signed gold '+key, key in r.b?r.b[key]:r.st[key],expected,.011);
    expect('SBE_input not overwritten',d.SBE_input,f.scenario.input.SBE_input);
    expect('immutable original case',JSON.stringify(f.scenario),before);
  });
  group(row,'interpretation',expect=>{
    expect('primary metabolic process',r.p.met,f.clinical.primary);
    expect('HAGMA with independent gas evidence',r.h.hasHAGMA,f.clinical.hagma);
    expect('anion confidence from clinician amendment',r.h.confidence,f.clinical.anionConfidence);
    expect('possible anion component retained',r.h.componentPossible,f.clinical.componentPossible);
    expect('delta classification allowed',r.dd.applicable??false,f.clinical.deltaApplicable);
    if(f.clinical.componentPossible){
      expect('elevated AG is not declared normal',r.syn.title.includes('Расстройств КОС не выявлено'),false);
      expect('clinical findings retain confidence wording',r.fin.findings.includes(r.h.reason),true);
      expect('inapplicable ratio cannot leak classification',r.dd.applicable||r.syn.detail.includes(r.dd.classification),!!r.dd.applicable);
      if(f.clinical.anionConfidence==='possible')expect('AG alone is not a confirmed HAGMA component',r.h.evidence.length,0);
      if(r.h.mixedPresentation)expect('mixed presentation cautious wording',r.h.reason.includes('возможный анионный ацидотический компонент на фоне смешанного нарушения'),true);
    }
    expect('no automatic metabolic alkalosis',r.syn.components.includes('метаболический алкалоз'),false);
    expect('no mild acidosis degree',/л[её]гкий ацидоз/i.test(r.syn.detail),false);
    if(f.clinical.acidifyingShift)expect('borderline acidifying shift',r.syn.title.includes('ацидифицирующий сдвиг'),true);
    if(f.clinical.adequateWinter)expect('Winter compensation',r.comp.checks.includes('адекватна'),true);
    if(f.clinical.sodiumInterpretation==='persists')expect('hyponatremia remains',r.fin.findings.includes('После расчётной поправки гипонатриемия сохраняется'),true);
    if(f.clinical.sodiumInterpretation==='corrected-normal')expect('corrected Na ordinary range',r.fin.findings.includes('После расчётной поправки Na находится в обычном диапазоне'),true);
    if(f.number>=266){
      expect('Berlin category',r.ards.severity||'none',f.clinical.berlin);
      expect('SOFA complete with explicit support',sofa.complete,true);
      expect('SOFA total',sofa.total,f.clinical.sofaTotal);
      const [resp,plt,cv,cr,urine,renal]=f.clinical.sofaComponents;
      expect('SOFA respiration',sofa.items[0].score,resp);expect('SOFA platelets',sofa.items[1].score,plt);expect('SOFA cardiovascular',sofa.items[3].score,cv);
      expect('SOFA renal creatinine',sofa.items[5].scoreCreatinine,cr);expect('SOFA renal urine',sofa.items[5].scoreUrine,urine);expect('SOFA renal worst',sofa.items[5].score,renal);
      expect('APACHE unknown ARF',apache.acuteRenalFailure,'unknown');expect('APACHE no definitive score',Number.isNaN(apache.total),true);
      expect('APACHE conditional totals',[apache.totalNoARF,apache.totalYesARF],f.clinical.apacheTotals);
      expect('APACHE oxygen',apache.items.find(i=>i.name==='Оксигенация').score,f.clinical.apacheComponents[0]);
      expect('APACHE creatinine base',apache.items.find(i=>i.name==='Креатинин').baseScore,f.clinical.apacheComponents[1]);
      expect('NEWS2',r.scales[0].total,2);expect('qSOFA',r.scales[1].total,0);expect('SIRS',r.scales[2].total,0);
      expect('single slice label SOFA',sofa.interp.includes('по предоставленному срезу'),true);expect('first 24h label APACHE',apache.interp.includes('первых 24 ч'),true);
      expect('no sepsis causal assumption',r.sepsis.sepsisConfirmed,false);expect('no vasopressor need assumption',r.sepsis.shockConfirmed,false);
      if(d.infection==='no')expect('infection=no excludes confirmation',r.sepsis.sepsisStatus.includes('не подтверждаются'),true);
      if(d.infection==='yes')expect('sepsis conditional on cause',r.sepsis.sepsisStatus.includes('если органная дисфункция связана'),true);
    }
  });
  group(row,'qc',expect=>{
    const q=engine.call('clinicalQC',d,r.b);row.clinicalInputQC=q.status;
    expect('warning codes',q.warnings.map(w=>w.code).sort(),[...f.qcCodes].sort());
    expect('all QC policy decisions resolved',q.pending,[]);
    if(f.qcCodes.includes('SBE_CONFLICT')){expect('SBE method conflict does not imply gas conflict',q.summary.includes('внутренне несогласованы'),false);expect('SBE preserved',r.b.SBE,d.SBE_input);}
    engine.input(d,f.scenario.config);
    const inputsBefore=plain(engine.read());engine.run();expect('UI calculation no input mutation',plain(engine.read()),inputsBefore);
    expect('QC panel exists',engine.elements.has('qcResults'),true);
    for(const code of f.qcCodes){const msg=q.warnings.find(w=>w.code===code).message;expect('QC visible '+code,engine.text('qcResults').includes(engine.call('escapeHTML',msg)),true);}
    expect('SBE values separate',engine.text('results').includes('SBE_input')&&engine.text('results').includes('SBE_calculated'),true);
    expect('Kellum visible',engine.text('results').includes('AG Kellum'),true);
    if(f.clinical.componentPossible){
      for(const id of ['diagnosis','results-findings','dash-findings','finalResults'])expect('confidence visible '+id,engine.text(id).includes(engine.call('escapeHTML',r.h.reason)),true);
      expect('copy report retains confidence',engine.evaluate('lastReport').includes(r.h.reason),true);
      if(!f.clinical.deltaApplicable)expect('ratio inapplicability visible',engine.text('results').includes(r.dd.classification),true);
    }
    if(f.number>=266){expect('APACHE UI conditional totals',engine.text('dash-apache'),apache.totalDisplay);expect('copy report APACHE conditional',engine.evaluate('lastReport').includes(apache.totalDisplay),true);}
  });
  group(row,'boundaries',expect=>{
    const b=r.b;
    const has=(input,calc,code)=>engine.call('clinicalQC',input,calc).warnings.some(w=>w.code===code);
    // Exact technical threshold boundaries are exercised independently of medical formula output.
    for(const sign of [-1,1]){
      expect('HCO3 diff exactly 2 '+sign,has({...d,HCO3in:sign*2},{...b,HCO3calc:0},'HCO3_CONFLICT'),false);
      expect('HCO3 diff >2 '+sign,has({...d,HCO3in:sign*2.00001},{...b,HCO3calc:0},'HCO3_CONFLICT'),true);
      expect('SBE diff exactly 2 '+sign,has({...d,SBE_input:sign*2},{...b,SBE_calc:0},'SBE_CONFLICT'),false);
      expect('SBE diff >2 '+sign,has({...d,SBE_input:sign*2.00001},{...b,SBE_calc:0},'SBE_CONFLICT'),true);
    }
    const off=engine.compute({...d,naCorr:'off'}),on=engine.compute({...d,naCorr:'on'});
    for(const key of ['AG','AGcorr','AG_Kellum','Osm_calc','deltaAG','deltaHCO3','deltaDelta']){const a=off.b[key],z=on.b[key];expect('naCorr invariant '+key,Number.isNaN(a)&&Number.isNaN(z)||Math.abs(a-z)<1e-8,true);}
    for(const key of ['SIDa','SIDe','SIDe_corr','SIG','SIG_corr'])expect('naCorr invariant '+key,off.st[key],on.st[key],1e-8);
    expect('missing measured osmolar gap',Number.isNaN(engine.call('calcBasic',{...d,Osm_in:NaN}).Osm_gap),true);
    for(const key of ['Na','K','Cl','Alb','PO4','Lac'])expect('Kellum missing '+key,Number.isNaN(engine.call('calcBasic',{...d,[key]:NaN}).AG_Kellum),true);
    const probe={...d,pH:7.3,pCO2:40,HCO3in:19,SBE_input:0,Na:145,Lac:1,anionSourceConfirmed:'unknown',AGupperLimit:NaN};
    const pb={HCO3:19,HCO3calc:19,SBE:0,SBE_calc:-3,AGcorr:15,deltaAG:3,deltaDelta:.6};
    expect('Na 145 allows HAGMA',engine.call('detectHAGMA',probe,pb,null).hasHAGMA,true);
    const hyper=engine.call('detectHAGMA',{...probe,Na:145.00001},pb,null);
    expect('Na above145 permits independently supported component',hyper.hasHAGMA,true);
    expect('Na above145 retains limitation',hyper.limitedBySodium,true);
    expect('Na above145 remains supported confidence',hyper.confidence,'supported');
    expect('Na above145 retains warning',has({...probe,Na:145.00001},pb,'HYPERNATREMIA_AG_LIMIT'),true);
    expect('Na above145 still prevents ratio classification',engine.call('calcDeltaDelta',{...probe,Na:145.00001},pb).applicable,false);
    expect('AGcorr14 alone no HAGMA',engine.call('detectHAGMA',probe,{...pb,AGcorr:14},null).hasHAGMA,false);
    expect('AG at upper limit no AG-based component',engine.call('detectHAGMA',probe,{...pb,AGcorr:14},null).componentPossible,false);
    expect('AG just above limit graded component',engine.call('detectHAGMA',probe,{...pb,AGcorr:14.00001},null).confidence,'supported');
    expect('specified laboratory upper bound respected',engine.call('detectHAGMA',{...probe,AGupperLimit:16},pb,null).hasHAGMA,false);
    expect('specified lab bound exact',engine.call('detectHAGMA',{...probe,AGupperLimit:15},pb,null).componentPossible,false);
    const normal={...probe,pH:7.4,HCO3in:24,SBE_input:0},nb={...pb,HCO3:24,HCO3calc:24,SBE_calc:0};
    const agOnly=engine.call('detectHAGMA',normal,nb,null);
    expect('AGcorr above14 alone no confirmed HAGMA',agOnly.hasHAGMA,false);
    expect('normal gas still allows possible component',agOnly.componentPossible,true);
    expect('normal gas confidence is possible',agOnly.confidence,'possible');
    // Final 300 spec P1.3 supersedes this old wording assertion; medical confidence checks above remain unchanged.
    expect('AG alone cannot assert an unproven mixed disorder',agOnly.reason.includes('на фоне смешанного нарушения'),false);
    expect('possible anion wording still retained',agOnly.reason.includes('возможный анионный ацидотический компонент'),true);
    const hyperOnly=engine.call('detectHAGMA',{...normal,Na:160},nb,null);
    expect('hypernatremia AG alone remains possible',hyperOnly.confidence,'possible');
    expect('hypernatremia AG alone not confirmed',hyperOnly.hasHAGMA,false);
    for(const sodium of [145,160]){
      expect('normal pH does not veto gas evidence Na'+sodium,engine.call('detectHAGMA',{...probe,pH:7.4,Na:sodium},pb,null).confidence,'supported');
      const lactate=engine.call('detectHAGMA',{...normal,Na:sodium,Lac:2.00001},nb,null);
      expect('normal pH HCO3 supports lactate evidence Na'+sodium,lactate.confidence,'supported');
      expect('lactate evidence does not diagnose etiology Na'+sodium,lactate.reason.includes('сама по себе не доказывает лактатацидоз'),true);
      expect('normal HCO3 with lactate ratio still inapplicable Na'+sodium,engine.call('calcDeltaDelta',{...normal,Na:sodium,Lac:3},nb).applicable,false);
      expect('normal pH HCO3 independently confirmed source Na'+sodium,engine.call('detectHAGMA',{...normal,Na:sodium,anionSourceConfirmed:'yes'},nb,null).confidence,'supported');
      expect('normal HCO3 source ratio remains inapplicable Na'+sodium,engine.call('calcDeltaDelta',{...normal,Na:sodium,anionSourceConfirmed:'yes'},nb).applicable,false);
    }
    expect('lactate exactly2 does not add evidence',engine.call('detectHAGMA',{...normal,Lac:2},nb,null).confidence,'possible');
    expect('high lactate no AG rise is not AG-based HAGMA',engine.call('detectHAGMA',{...normal,Lac:4},{...nb,AGcorr:14},null).hasHAGMA,false);
    for(const confirmation of ['unknown','no',undefined])expect('source needs explicit confirmation '+confirmation,engine.call('detectHAGMA',{...normal,anionSourceConfirmed:confirmation},nb,null).confidence,'possible');
    expect('glucose SIG and notes cannot confirm source',engine.call('detectHAGMA',{...normal,Gluc:30,notes:'кетоны не подтверждены; кетоацидоза нет'},nb,{SIG:20}).confidence,'possible');
    expect('HCO3 just below22 ratio classification permitted',engine.call('calcDeltaDelta',{...probe,HCO3in:21.999},{...pb,HCO3:21.999,HCO3calc:21.999}).applicable,true);
    expect('HCO3 22 no ratio classification',engine.call('calcDeltaDelta',{...probe,HCO3in:22},{...pb,HCO3:22,HCO3calc:22}).applicable,false);
    expect('HCO3 22 not absolute exclusion of possible component',engine.call('detectHAGMA',{...probe,HCO3in:22},{...pb,HCO3:22,HCO3calc:22},null).confidence,'possible');
    expect('HCO3 22 confirmed source still supported',engine.call('detectHAGMA',{...probe,HCO3in:22,anionSourceConfirmed:'yes'},{...pb,HCO3:22,HCO3calc:22},null).confidence,'supported');
    expect('gas conflict difference exactly2 permits evidence',engine.call('detectHAGMA',probe,{...pb,HCO3calc:17},null).confidence,'supported');
    expect('gas conflict difference above2 blocks evidence',engine.call('detectHAGMA',{...probe,Lac:4,anionSourceConfirmed:'yes'},{...pb,HCO3calc:16.99999},null).confidence,'unreliable');
    expect('triad conflict blocks HAGMA',engine.call('detectHAGMA',probe,{...pb,HCO3calc:15},null).hasHAGMA,false);
    expect('triad conflict blocks primary',engine.call('detectPrimary',probe,{...pb,HCO3calc:15}).invalid,true);
    expect('isolated SBE conflict permits HAGMA',engine.call('detectHAGMA',probe,pb,null).hasHAGMA,true);
    for(const [ratio,part]of [[.9,'без явного'],[1.5,'без явного'],[1.50001,'возможен'],[2,'возможен'],[2.00001,'вероятный']]){
      const delta=engine.call('calcDeltaDelta',probe,{...pb,deltaDelta:ratio});expect('delta boundary '+ratio,delta.classification.includes(part),true);
    }
    if(f.number>=266){
      const oxygen={...d,bilateral:'yes',timing:'yes',noncardiac:'yes',PEEP:5,respiratorySupport:'yes'};
      for(const [pf,severity]of [[100,'severe'],[100.00001,'moderate'],[200,'moderate'],[200.00001,'mild'],[300,'mild'],[300.00001,null]])expect('Berlin PF '+pf,engine.call('ardsAssessment',oxygen,{...b,PF:pf}).severity,severity);
      for(const peep of [0,4.99999,NaN])expect('Berlin PEEP '+peep,engine.call('ardsAssessment',{...oxygen,PEEP:peep},{...b,PF:100}).confirmed,false);
      for(const key of ['bilateral','timing','noncardiac'])for(const value of ['unknown','no'])expect('Berlin missing/negative '+key+value,engine.call('ardsAssessment',{...oxygen,[key]:value},{...b,PF:100}).confirmed,false);
      for(const [pf,score]of [[99.999,4],[100,3],[199.999,3],[200,2],[299.999,2],[300,1],[399.999,1],[400,0]])expect('SOFA respiration '+pf,engine.call('calcSOFA',{...oxygen,PEEP:0},{...b,PF:pf}).items[0].score,score);
      expect('SOFA missing support low PF not complete',engine.call('calcSOFA',{...oxygen,respiratorySupport:'unknown'},{...b,PF:80}).complete,false);
      for(const [urine,score]of [[199.999,4],[200,3],[499.999,3],[500,0]])expect('SOFA urine '+urine,engine.call('calcSOFA',{...oxygen,Cr:80,Urine:urine},b).items[5].score,score);
      for(const [cr,score]of [[1.19999,0],[1.2,1],[1.99999,1],[2,2],[3.49999,2],[3.5,3],[4.99999,3],[5,4]])expect('SOFA creatinine '+cr,engine.call('calcSOFA',{...oxygen,Cr:cr*88.4,Urine:1500},b).items[5].score,score);
      expect('SOFA worse creatinine not overridden by urine',engine.call('calcSOFA',{...oxygen,Cr:6*88.4,Urine:400},b).items[5].score,4);
      const no=engine.call('calcAPACHE2',{...d,acuteRenalFailure:'no'},b),yes=engine.call('calcAPACHE2',{...d,acuteRenalFailure:'yes'},b);
      expect('APACHE ARF no',no.total,f.clinical.apacheTotals[0]);expect('APACHE ARF yes',yes.total,f.clinical.apacheTotals[1]);
      expect('APACHE only creatinine doubles',yes.total-no.total,f.clinical.apacheComponents[1]);
      for(const item of no.items.filter(i=>i.name!=='Креатинин'))expect('APACHE other unchanged '+item.name,yes.items.find(i=>i.name===item.name).score,item.score);
      const fifty=engine.call('calcAPACHE2',{...d,FiO2:50,pO2:40,acuteRenalFailure:'no'},{...b,A_a_est:266.5});
      const under=engine.call('calcAPACHE2',{...d,FiO2:49.999,pO2:40,acuteRenalFailure:'no'},{...b,A_a_est:266.5});
      expect('APACHE FiO2 50 uses AA',fifty.items.find(i=>i.name==='Оксигенация').score,2);expect('APACHE FiO2 below50 uses PaO2',under.items.find(i=>i.name==='Оксигенация').score,4);
      for(const [po,spo,code]of [[59.999,95,'PAO2_SPO2_STRONG'],[60,98,'PAO2_SPO2_SOFT'],[79,98,'PAO2_SPO2_SOFT']])expect('PaO2/SpO2 boundary '+po,has({...d,pO2:po,SpO2:spo},b,code),true);
      expect('SpO2 below95 no strong',has({...d,pO2:40,SpO2:94.999},b,'PAO2_SPO2_STRONG'),false);
      expect('SpO2 below98 no soft',has({...d,pO2:75,SpO2:97.999},b,'PAO2_SPO2_SOFT'),false);
      expect('PaO2 above79 no soft',has({...d,pO2:79.00001,SpO2:98},b,'PAO2_SPO2_SOFT'),false);
      expect('non simultaneous no strong diagnosis',has({...d,pO2:40,SpO2:98,sampleSimultaneity:'no'},b,'PAO2_SPO2_STRONG'),false);
      const shock={...d,infection:'yes',baselineSOFA:0,infectionRelatedOrganDysfunction:'yes',Vaso:'norepi_low',adequateResuscitation:'yes',vasopressorRequirement:'yes',SBP:75,DBP:60};
      expect('lactate2 excludes strict shock',engine.call('calcSepsis',{...shock,Lac:2},b,{total:4,complete:true},{total:0}).shockConfirmed,false);
      expect('MAP65 treated shock can confirm',engine.call('calcSepsis',{...shock,Lac:2.00001},b,{total:4,complete:true},{total:0}).shockConfirmed,true);
      expect('unknown resuscitation no shock confirmation',engine.call('calcSepsis',{...shock,Lac:3,adequateResuscitation:'unknown'},b,{total:4,complete:true},{total:0}).shockConfirmed,false);
      expect('unknown vasopressor need no shock confirmation',engine.call('calcSepsis',{...shock,Lac:3,vasopressorRequirement:'unknown'},b,{total:4,complete:true},{total:0}).shockConfirmed,false);
    }
  });
  row.status=['math','interpretation','qc','boundaries'].every(k=>row[k].status==='PASS')?'PASS':'FAIL';rows.push(row);
}
const summary={scenarioCount:rows.length,pass:rows.filter(r=>r.status==='PASS').length,fail:rows.filter(r=>r.status==='FAIL').length,checks:rows.reduce((n,r)=>n+['math','interpretation','qc','boundaries'].reduce((a,k)=>a+r[k].checks.length,0),0),sourceHash,sourcePath,nativeBrowserVerification:false,originalInputsUnmodified:true};
const prefix=process.env.ICU_REPORT_PREFIX||'regression-35';
fs.mkdirSync(path.join(root,'reports'),{recursive:true});
fs.writeFileSync(path.join(root,'reports',prefix+'.json'),JSON.stringify({summary,rows},null,2)+'\n');
let md='# ICU CORE — регрессия 35 сценариев\n\nДата: 08.10.2026.\n\n'+`Сценарии: **${summary.pass} PASS / ${summary.fail} FAIL**, проверок: ${summary.checks}.\n\n`;
md+='Основа: клинический эталон и ТЗ пользователя, дополненные согласованными QC-порогами, правилом изолированного SBE-конфликта и последним уточнением уверенности HAGMA (reference/HAGMA_confidence_update_2026-10-08.md). HCO3/pH/Na влияют на уверенность, но не являются абсолютным veto компонента; ΔΔ проверяется отдельно по строгой применимости. PASS для QC означает правильное предупреждение, а не физиологическую нормальность сценария. Полные исходные входы не изменены. Проверены расчётное ядро и путь ввода/вывода в изолированной модели DOM; визуальная проверка в настоящем браузере не выполнена.\n\n';
md+='| № | ID | Математика | Интерпретация | QC-предупреждения | Границы | Итог | QC входов |\n|---:|---|---|---|---|---|---|---|\n';
for(const r of rows)md+=`| ${r.number} | ${r.id} | ${r.math.status} | ${r.interpretation.status} | ${r.qc.status} | ${r.boundaries.status} | **${r.status}** | ${r.clinicalInputQC||'—'} |\n`;
md+='\n## Несовпадения\n\n';
for(const r of rows)for(const k of ['math','interpretation','qc','boundaries'])for(const t of r[k].checks.filter(x=>x.status==='FAIL'))md+=`- ${r.id} / ${k} / ${t.label}: expected=${JSON.stringify(t.expected)}, actual=${JSON.stringify(t.actual)}${t.difference!==undefined?', difference='+t.difference:''}.\n`;
if(!rows.some(r=>r.status==='FAIL'))md+='Несовпадений нет.\n';
md+='\n## Ограничения\n\nЭтот отчёт проверяет согласованный объём 35 сценариев и границы этих правил. Он не подтверждает клиническую корректность всех остальных функций приложения или готовность к клиническому применению. Исходные модели simple/charged сохранены. SBE и Dorwart–Chalmers не заменены другими формулами. APACHE и SOFA подписаны как расчёты по предоставленному срезу. При ARF unknown выведены два условных результата.\n';
fs.writeFileSync(path.join(root,'reports',prefix+'.md'),md);
console.log(JSON.stringify(summary));
for(const r of rows.filter(r=>r.status==='FAIL'))console.log(r.id,['math','interpretation','qc','boundaries'].filter(k=>r[k].status==='FAIL').map(k=>k+': '+r[k].checks.filter(t=>t.status==='FAIL').map(t=>t.label).join(', ')).join(' | '));
process.exitCode=summary.fail?1:0;
