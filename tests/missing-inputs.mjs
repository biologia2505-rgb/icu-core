import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createEngine,sourceHash,sourcePath} from './adapter/icu-html.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fixtures=JSON.parse(fs.readFileSync(path.join(root,'tests/cases-35.json'),'utf8'));
const prefix=process.env.ICU_MISSING_REPORT_PREFIX||'missing-inputs';
if(!/^[a-z0-9-]+$/.test(prefix))throw new Error('Invalid ICU_MISSING_REPORT_PREFIX');
const rows=[];
const encode=v=>JSON.parse(JSON.stringify(v,(_,x)=>x===undefined?{$undefined:true}:typeof x==='number'&&!Number.isFinite(x)?{$number:String(x)}:x));
const missingText=v=>/не рассчитан(?:о|а)?/i.test(String(v));
function group(id,kind,run){
  const checks=[];
  const expect=(label,actual,expected,tolerance=null)=>{
    const pass=tolerance===null?JSON.stringify(encode(actual))===JSON.stringify(encode(expected)):Number.isFinite(actual)&&Math.abs(actual-expected)<=tolerance;
    checks.push({label,status:pass?'PASS':'FAIL',expected:encode(expected),actual:encode(actual),...(tolerance===null?{}:{tolerance,difference:Number.isFinite(actual)?actual-expected:null})});
  };
  try{run(expect)}catch(error){checks.push({label:'execution',status:'FAIL',expected:'Successful execution',actual:String(error.stack||error)})}
  rows.push({id,kind,status:checks.length&&checks.every(c=>c.status==='PASS')?'PASS':'FAIL',checks});
}
function rowValue(engine,panel,label){
  const escaped=label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const match=engine.text(panel).match(new RegExp('<span>'+escaped+'</span><span>([\\s\\S]*?)</span>'));
  return match?match[1].replace(/<[^>]+>/g,''):null;
}
// Independent literals, not application-computed expected values. Original 35 inputs stay intact.
// AG=140-(100+18)=22; albumin correction at Alb30 is +2.5, at Alb0 is +10.
// Dorwart–Chalmers: 1.86*140+5.5+5+9=279.9; measured320 gives gap40.1.
const base={...fixtures[0].scenario.input,...fixtures[0].scenario.config,pH:7.2,pCO2:46,HCO3in:18,SBE_input:-9.64,Na:140,Cl:100,Alb:30,Gluc:5.5,Ur:5,Osm_in:320,Lac:1,sbeMode:'input',sidModel:'charged',anionSourceConfirmed:'unknown'};
const normalGas={...base,pH:7.4,pCO2:40,HCO3in:24,SBE_input:0,Na:140,Cl:103,Alb:40};
const variants=[['absent-key',undefined,true],['undefined',undefined,false],['NaN',NaN,false],['null',null,false],['Infinity',Infinity,false],['negative-Infinity',-Infinity,false]];

for(const [name,value,absent]of variants){
  const d={...base,Alb:value};if(absent)delete d.Alb;
  group('albumin unavailable: '+name,'boundary',expect=>{
    const e=createEngine(),before=encode(d),r=e.compute(d);
    for(const key of ['AGcorr','deltaAG','deltaDelta','AG_Kellum','SBE_Alb','SBE_UA'])expect(key+' unavailable',Number.isNaN(r.b[key]),true);
    for(const key of ['Alb_charge','SIDe','SIDe_corr','SIG','SIG_corr'])expect('Stewart '+key+' unavailable',Number.isNaN(r.st[key]),true);
    expect('raw AG remains available',r.b.AG,22,1e-10);
    expect('SBE independently available',r.b.SBE_calc,-9.64,1e-10);
    expect('osmolality independent of albumin',r.b.Osm_calc,279.9,1e-10);
    expect('gap independent of albumin',r.b.Osm_gap,40.1,1e-10);
    expect('gas diagnosis remains metabolic acidosis',r.p.met,'metabolic acidosis');
    expect('AG-based HAGMA unavailable',r.h.confidence,'unavailable');
    expect('unavailable flag',r.h.evaluationUnavailable,true);
    expect('no HAGMA assertion from unavailable AGcorr',r.h.hasHAGMA,false);
    expect('no invented elevated AGcorr',r.h.componentPossible,false);
    expect('HAGMA reason explicitly not calculated',missingText(r.h.reason),true);
    expect('ratio not calculated',Number.isNaN(r.dd.value),true);
    expect('ratio not applicable',r.dd.applicable,false);
    expect('ratio classification explicitly not calculated',missingText(r.dd.classification),true);
    expect('no ratio suspicion',r.dd.suspicion,false);
    expect('missing albumin QC',e.call('clinicalQC',d,r.b).warnings.some(x=>x.code==='MISSING_REQUIRED_MATH_INPUTS'&&x.message.includes('Alb')),true);
    expect('original input not replaced',encode(d),before);
    expect('no hypo/hyperalbuminemia inferred from missing albumin',r.fin.findings.concat(r.fin.alerts).some(x=>/Гипоальбуминемия|Гиперпротеинемия/.test(x)),false);
  });
  const u={...base,Ur:value};if(absent)delete u.Ur;
  group('urea unavailable: '+name,'boundary',expect=>{
    const e=createEngine(),before=encode(u),r=e.compute(u);
    expect('Osm_calc unavailable',Number.isNaN(r.b.Osm_calc),true);
    expect('Osm_gap unavailable despite measured osmolality',Number.isNaN(r.b.Osm_gap),true);
    expect('albumin-corrected AG unaffected',r.b.AGcorr,24.5,1e-10);
    expect('HAGMA evidence unaffected',r.h.hasHAGMA,true);
    expect('missing urea QC',e.call('clinicalQC',u,r.b).warnings.some(x=>x.code==='MISSING_OSMOLARITY_INPUTS'&&x.message.includes('Ur')),true);
    expect('no invented osmolar-gap finding',r.fin.findings.some(x=>/Осмолярный gap/.test(x)),false);
    expect('no invented osmolar-gap data-quality diagnosis',r.quality.some(x=>/Выраженный osmolal gap/.test(x)),false);
    expect('original input not replaced',encode(u),before);
  });
}

group('albumin measured zero is not missing','boundary',expect=>{
  const e=createEngine(),d={...base,Alb:0},r=e.compute(d);
  expect('AGcorr uses measured0 rather than Alb40',r.b.AGcorr,32,1e-10);
  expect('deltaAG uses measured0 correction',r.b.deltaAG,20,1e-10);
  expect('SBE_Alb uses measured0 rather than Alb40',r.b.SBE_Alb,9.904,1e-10);
  expect('SBE_UA uses measured0 decomposition',r.b.SBE_UA,-23.544,1e-10);
  expect('no missing-albumin QC for measured0',e.call('clinicalQC',d,r.b).warnings.some(x=>x.code==='MISSING_REQUIRED_MATH_INPUTS'&&x.message.includes('Alb')),false);
  expect('physiological bounds still flag measured0',e.call('physiologicWarnings',d).some(x=>x.startsWith('Alb = 0')),true);
  expect('original measured0 retained',d.Alb,0);
});
group('urea measured zero is not missing','boundary',expect=>{
  const e=createEngine(),d={...base,Ur:0},r=e.compute(d);
  expect('Osm_calc uses measured0',r.b.Osm_calc,274.9,1e-10);
  expect('Osm_gap uses measured0',r.b.Osm_gap,45.1,1e-10);
  expect('no missing-urea QC for measured0',e.call('clinicalQC',d,r.b).warnings.some(x=>x.code==='MISSING_OSMOLARITY_INPUTS'),false);
  expect('physiological bounds still flag measured0',e.call('physiologicWarnings',d).some(x=>x.startsWith('Ur = 0')),true);
  expect('original measured0 retained',d.Ur,0);
});
group('finite albumin40 retains original correction and formulas','regression',expect=>{
  const e=createEngine(),r=e.compute({...base,Alb:40});
  expect('AGcorr equals raw AG at measured40',r.b.AGcorr,22,1e-10);
  expect('SBE_Alb equals0 at measured40',r.b.SBE_Alb,0,1e-10);
  expect('SBE_UA original formula',r.b.SBE_UA,-13.64,1e-10);
});
group('both albumin and urea missing are independent omissions','regression',expect=>{
  const e=createEngine(),d={...base,Alb:NaN,Ur:NaN},r=e.compute(d),qc=e.call('clinicalQC',d,r.b);
  for(const key of ['AGcorr','deltaAG','deltaDelta','SBE_Alb','SBE_UA','Osm_calc','Osm_gap'])expect(key+' unavailable',Number.isNaN(r.b[key]),true);
  expect('albumin omission QC',qc.warnings.some(x=>x.code==='MISSING_REQUIRED_MATH_INPUTS'),true);
  expect('urea omission QC',qc.warnings.some(x=>x.code==='MISSING_OSMOLARITY_INPUTS'),true);
});
group('missing measured osmolality keeps calculated osmolality available','boundary',expect=>{
  const e=createEngine(),r=e.compute({...base,Osm_in:NaN});
  expect('Osm_calc retains independent literal',r.b.Osm_calc,279.9,1e-10);
  expect('Osm_gap unavailable without measurement',Number.isNaN(r.b.Osm_gap),true);
});
group('unavailable albumin is not a negative anion diagnosis with normal gases','regression',expect=>{
  const e=createEngine(),r=e.compute({...normalGas,Alb:NaN});
  expect('normal gas primary remains unchanged',r.p.met,null);
  expect('normal gas respiratory remains unchanged',r.p.resp,null);
  expect('neutral unavailable syndrome title',r.syn.title,'Оценка анионного компонента не рассчитана');
  expect('neutral syndrome explains omission',missingText(r.syn.detail),true);
  expect('no normal/negative anion reassurance',/Расстройств КОС не выявлено|По AG не выявлен/.test(r.syn.title+' '+r.syn.detail),false);
});
group('independent source confirmation cannot fabricate unavailable AGcorr','regression',expect=>{
  const e=createEngine(),r=e.compute({...base,Alb:NaN,Lac:4,anionSourceConfirmed:'yes'});
  expect('AGcorr remains unavailable',Number.isNaN(r.b.AGcorr),true);
  expect('anion confidence unavailable',r.h.confidence,'unavailable');
  expect('no AG-based HAGMA invented',r.h.hasHAGMA,false);
  expect('independent hyperlactatemia finding retained',r.fin.findings.some(x=>x.includes('Гиперлактатемия')),true);
});

for(const key of ['Alb','Ur'])for(const [name,value]of [['empty-string',''],['NaN',NaN]])group(key+' DOM '+name,'regression',expect=>{
  const e=createEngine();e.input({...base,[key]:value});const before=encode(e.read()),chartStart=e.charts.length,report=e.run(),d=e.read(),r=e.compute(d);
  expect('missing input preserved after rendering',Number.isNaN(d[key]),true);
  expect('all inputs preserved after rendering',encode(d),before);
  expect('no runtime error',e.errors.length,0);
  const labels=key==='Alb'?['АП_корр (Alb)','ΔAG','ΔΔ','SBE_Alb (альбумин)','SBE_UA (прочие)','SID_e','SIG']:['Осм_расч','Осмолярный gap'];
  for(const panel of ['results','dash-full-results'])for(const label of labels)expect(panel+' '+label+' explicitly not calculated',missingText(rowValue(e,panel,label)),true);
  expect('explanations explicitly not calculated',missingText(e.text('explanations')),true);
  expect('exported report explicitly not calculated',missingText(report),true);
  expect('QC shown in all panels',['qcResults','qcDash','qcFinal'].every(panel=>e.text(panel).includes(key)),true);
  if(key==='Alb'){
    expect('results show unavailable anion component',missingText(rowValue(e,'results','Анионный компонент')),true);
    expect('diagnosis explains unavailable anion assessment',missingText(e.text('diagnosis')),true);
    expect('syndrome explains unavailable anion assessment',missingText(e.text('syndrome')),true);
    expect('final explains unavailable anion assessment',missingText(e.text('finalResults')),true);
    expect('report no negative AG conclusion',report.includes('По AG не выявлен'),false);
    expect('Gamble summary explicitly not calculated',missingText(e.text('gamble-summary')),true);
    expect('Gamble no hidden-anion or closed-balance diagnostic claim',/баланс сошёлся|есть скрытый анион/.test(e.text('gamble-summary')),false);
    expect('no incomplete Gamble chart constructed',e.charts.slice(chartStart).some(c=>c.canvas.id==='gamble'),false);
    expect('gas chart continues independently',e.charts.slice(chartStart).some(c=>c.canvas.id==='siggaard'),true);
    expect('original independent gas math available',r.b.HCO3,18,1e-10);
  }else{
    expect('no fabricated osmolar-gap diagnosis',e.text('diagnosis').includes('Осмолярный gap '),false);
    expect('no fabricated osmolar-gap final finding',e.text('finalResults').includes('Осмолярный gap '),false);
    expect('exported report names Osm_calc unavailable',/Осм_расч: не рассчитано/.test(report),true);
    expect('exported report names Osm_gap unavailable',/Осмолярный gap: не рассчитано/.test(report),true);
    expect('AGcorr remains correct through DOM',r.b.AGcorr,24.5,1e-10);
  }
});

for(const key of ['Alb','Ur'])group(key+' valid → missing → valid has no stale result','regression',expect=>{
  const e=createEngine();e.input(base);e.run();const first=e.compute(e.read());
  expect('initial finite result',key==='Alb'?first.b.AGcorr:first.b.Osm_calc,key==='Alb'?24.5:279.9,1e-10);
  e.input({[key]:''});const chartStart=e.charts.length;const missingReport=e.run();
  expect('cleared input stays empty',e.elements.get(key).value,'');
  expect('missing replaces numeric result',missingText(rowValue(e,'results',key==='Alb'?'АП_корр (Alb)':'Осм_расч')),true);
  expect('missing replaces dashboard numeric result',missingText(rowValue(e,'dash-full-results',key==='Alb'?'АП_корр (Alb)':'Осм_расч')),true);
  expect('missing report replaced old result',missingText(missingReport),true);
  if(key==='Alb'){
    expect('no replacement Gamble chart while unavailable',e.charts.slice(chartStart).some(c=>c.canvas.id==='gamble'),false);
    expect('stale Gamble diagnostic summary removed',missingText(e.text('gamble-summary')),true);
  }
  e.input({[key]:base[key]});const restoreStart=e.charts.length;const report=e.run(),r=e.compute(e.read());
  expect('restored input preserved',e.read()[key],base[key]);
  expect('restored finite result',key==='Alb'?r.b.AGcorr:r.b.Osm_calc,key==='Alb'?24.5:279.9,1e-10);
  expect('restored result no longer missing',missingText(rowValue(e,'results',key==='Alb'?'АП_корр (Alb)':'Осм_расч')),false);
  expect('omission QC cleared',e.call('clinicalQC',e.read(),r.b).warnings.some(x=>x.code===(key==='Alb'?'MISSING_REQUIRED_MATH_INPUTS':'MISSING_OSMOLARITY_INPUTS')),false);
  if(key==='Alb')expect('restored complete Gamble is constructed',e.charts.slice(restoreStart).some(c=>c.canvas.id==='gamble'),true);
  else expect('restored report contains osmolality literal',report.includes('Осм_расч: 279.9'),true);
  expect('no runtime errors throughout transition',e.errors.length,0);
});

const checks=rows.flatMap(r=>r.checks);
const result={sourcePath,sourceHash,nativeBrowser:false,authority:'Последняя контрольная проверка: отсутствующие Alb/Ur не заменяются нормой/нулём; отдельные регрессии и границы',summary:{groups:rows.length,pass:rows.filter(r=>r.status==='PASS').length,fail:rows.filter(r=>r.status==='FAIL').length,checks:checks.length,checksPass:checks.filter(c=>c.status==='PASS').length,checksFail:checks.filter(c=>c.status==='FAIL').length},rows};
fs.mkdirSync(path.join(root,'reports'),{recursive:true});
fs.writeFileSync(path.join(root,'reports',prefix+'.json'),JSON.stringify(result,null,2)+'\n');
let md='# Контроль отсутствующих albumin/urea\n\nИсточник: `'+sourcePath+'`. SHA256: `'+sourceHash+'`.\n\nPASS '+result.summary.pass+' / FAIL '+result.summary.fail+' групп; '+result.summary.checksPass+' / '+result.summary.checks+' отдельных проверок.\n\nОжидаемые значения независимы: AG22; AGcorr24.5 при Alb30, AGcorr32 при Alb0; Osm_calc279.9 при Ur5, 274.9 при Ur0; Osm_in320 → gaps40.1 и45.1. Оригинальные 35 синтетических сценариев не изменены. Проверяется реальный встроенный JavaScript через изолированный DOM, не нативный браузер.\n\n| Группа | Тип | Результат | Проверки |\n|---|---|---|---|\n';
for(const r of rows)md+='| '+r.id+' | '+r.kind+' | '+r.status+' | '+r.checks.filter(c=>c.status==='PASS').length+'/'+r.checks.length+' |\n';
md+='\nПодробные FAIL:\n\n';
if(!result.summary.checksFail)md+='Нет.\n';
for(const r of rows)for(const c of r.checks.filter(x=>x.status==='FAIL'))md+='- '+r.id+' / '+c.label+': expected='+JSON.stringify(c.expected)+', actual='+JSON.stringify(c.actual)+(c.tolerance===undefined?'':', difference='+c.difference+', tolerance='+c.tolerance)+'.\n';
fs.writeFileSync(path.join(root,'reports',prefix+'.md'),md);
console.log(JSON.stringify(result.summary));
for(const r of rows.filter(x=>x.status==='FAIL'))console.log(r.id+': '+r.checks.filter(c=>c.status==='FAIL').map(c=>c.label).join('; '));
process.exitCode=result.summary.fail?1:0;
