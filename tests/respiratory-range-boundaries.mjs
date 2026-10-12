import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {root, createEngine, sourceHash} from './adapter/icu-html.mjs';

// These clinical interval endpoints are literal, independently approved anchors.
// Expected ranges and classifications are never obtained from the application.
const anchors = [
  {id:'acute-RA-50', chronicity:'acute', co:50, low:25, high:26, acute:[25,26], chronic:[27,28], resp:'respiratory acidosis'},
  {id:'acute-RA-60', chronicity:'acute', co:60, low:26, high:28, acute:[26,28], chronic:[30,32], resp:'respiratory acidosis'},
  {id:'acute-RA-80', chronicity:'acute', co:80, low:28, high:32, acute:[28,32], chronic:[36,40], resp:'respiratory acidosis'},
  {id:'chronic-RA-50', chronicity:'chronic', co:50, low:27, high:28, acute:[25,26], chronic:[27,28], resp:'respiratory acidosis'},
  {id:'chronic-RA-60', chronicity:'chronic', co:60, low:30, high:32, acute:[26,28], chronic:[30,32], resp:'respiratory acidosis'},
  {id:'chronic-RA-80', chronicity:'chronic', co:80, low:36, high:40, acute:[28,32], chronic:[36,40], resp:'respiratory acidosis'},
  {id:'acute-RAlk-30', chronicity:'acute', co:30, low:22, high:23, acute:[22,23], chronic:[19,20], resp:'respiratory alkalosis'},
  {id:'acute-RAlk-25', chronicity:'acute', co:25, low:21, high:22.5, acute:[21,22.5], chronic:[16.5,18], resp:'respiratory alkalosis'},
  {id:'chronic-RAlk-30', chronicity:'chronic', co:30, low:19, high:20, acute:[22,23], chronic:[19,20], resp:'respiratory alkalosis'},
  {id:'chronic-RAlk-25', chronicity:'chronic', co:25, low:16.5, high:18, acute:[21,22.5], chronic:[16.5,18], resp:'respiratory alkalosis'},
];
const base=JSON.parse(fs.readFileSync(path.join(root,'reference/clinical-scenarios-original.json'),'utf8'))[0].input;
const checks=[];
// Literal amended expectations: normal-pH competing models cannot establish primary order.
const ambiguous={
 'chronic-RA-50:below':{met:null,processes:['respiratory acidosis'],possible:['metabolic acidosis','metabolic alkalosis']},
 'chronic-RA-50:above':{met:'metabolic alkalosis',processes:['metabolic alkalosis','respiratory acidosis'],possible:[]},
 'chronic-RA-60:above':{met:'metabolic alkalosis',processes:['metabolic alkalosis','respiratory acidosis'],possible:[]},
 'chronic-RAlk-30:below':{met:'metabolic acidosis',processes:['NAGMA','respiratory alkalosis'],possible:[]},
 'chronic-RAlk-30:above':{met:null,processes:['respiratory alkalosis'],possible:['metabolic acidosis','metabolic alkalosis']},
 'chronic-RAlk-25:below':{met:'metabolic acidosis',processes:['NAGMA','respiratory alkalosis'],possible:[]},
};
const unknownWarning='Хроничность респираторного нарушения не указана; автоматическая оценка дополнительного метаболического процесса по компенсации ограничена.';
function check(id, expected, fn) {
  try { fn(); checks.push({id,status:'PASS',expected,...(Object.keys(ambiguous).some(k=>id.startsWith(k.split(':')[0])&&(id.includes('low minus')||id.includes('high plus')))||id.endsWith('32.99')?{amendment:'AB-01 primary-process amendment D: preserve ranges and components; do not assign a primary order in incompatible normal-pH models.'}:{})}); }
  catch(error) { checks.push({id,status:'FAIL',expected,error:String(error.stack||error)}); }
}
// New boundary fixtures are coherent by an independent Henderson–Hasselbalch
// construction; this never corrects or modifies any existing synthetic case.
function gas(h,co,changes={}) {
  const pH=6.1+Math.log10(h/(0.03*co));
  const SBE=h-24.4+16.2*(pH-7.4);
  return {...base, pH, pCO2:co, HCO3in:h, SBE_input:SBE, sbeMode:'input',
    chronic:'unknown', chronicity:'unknown', Na:140, Cl:128-h, Alb:40, Lac:1,
    Gluc:5.5, Ur:5, anionSourceConfirmed:'unknown', ...changes};
}
function interval(actual,expected,label) {
  assert(actual,`${label}: missing interval`);
  assert.equal(actual.low,expected[0],`${label}: low`);
  assert.equal(actual.high,expected[1],`${label}: high`);
}
function intervalText(text,expected,label) {
  const number=x=>String(x).replace('.', '[.,]')+(Number.isInteger(x)?'(?:[.,]0)?':'');
  const re=new RegExp(`(?:^|[^0-9])${number(expected[0])}\\s*[–—-]\\s*${number(expected[1])}(?:[^0-9]|$)`);
  assert(re.test(text),`${label}: interval ${expected.join('–')} not shown: ${text}`);
}
function numericAndQC(e,d,r) {
  assert.equal(r.b.HCO3,d.HCO3in,'entered bicarbonate is preserved');
  assert.equal(r.b.SBE,d.SBE_input,'entered SBE is preserved');
  assert(Math.abs(r.b.AG-12)<1e-10,'independent AG=140-Cl-HCO3=12');
  assert(Math.abs(r.b.AGcorr-12)<1e-10,'albumin 40: AGcorr=12');
  const qc=e.call('clinicalQC',d,r.b);
  assert(!qc.warnings.some(w=>w.code==='HCO3_CONFLICT'||w.code==='SBE_CONFLICT'),'coherent fixture must not acquire gas/SBE QC conflict');
  assert(Math.abs(r.b.HCO3calc-d.HCO3in)<1e-10,'independent coherent H-H fixture');
}
function evaluateKnown(a,h,status) {
  const e=createEngine(),d=gas(h,a.co,{chronicity:a.chronicity}),r=e.compute(d);
  const met=status==='below'?'metabolic acidosis':status==='above'?'metabolic alkalosis':null;
  const expectedProcesses=met==='metabolic acidosis'?[a.resp,'NAGMA']:met?[a.resp,met]:[a.resp];
  const ranges=e.call('respiratoryCompensationRange',d);
  interval(ranges.acute,a.acute,'independent acute range');
  interval(ranges.chronic,a.chronic,'independent chronic range');
  interval(ranges.selected,[a.low,a.high],'selected range');
  assert.equal(ranges.chronicity,a.chronicity);
  const amended=ambiguous[a.id+':'+status];
  if(amended){
    assert.equal(r.p.primaryProcessCertain,false);assert(!r.p.respiratoryPrimary);
    assert.equal(r.p.resp,a.resp);assert.equal(r.p.met,amended.met);
    assert.equal(e.call('compareExpectedRange',h,a.low,a.high),status);
    assert.equal(r.p.respiratoryCompensationMatch,false);
    assert.deepEqual(Array.from(r.syn.processes).sort(),amended.processes.slice().sort());
    assert.deepEqual(Array.from(r.syn.possibleProcesses).sort(),amended.possible.slice().sort());
    assert.equal(r.syn.title,amended.processes.length>1?'Смешанное нарушение':'Установленный процесс; возможен дополнительный метаболический компонент');
    assert.equal(r.comp.checks[0],amended.met==='metabolic acidosis'&&h<22?'ниже ожид.':'первичность не определена');
    intervalText(r.comp.text,[a.low,a.high],'ambiguous model preserves approved range');
    numericAndQC(e,d,r);e.input(d);e.run();
    assert.equal(e.read().chronicity,a.chronicity);assert.equal(e.compute(e.read()).p.primaryProcessCertain,false);
    assert.equal(e.errors.length,0);return;
  }
  assert.equal(r.p.respiratoryPrimary,true);
  assert.equal(r.p.resp,a.resp);
  assert.equal(r.p.met,met);
  assert.equal(r.p.respiratoryRangeStatus,status);
  assert.equal(r.p.respiratoryCompensationMatch,status==='within');
  interval(r.p.expectedHCO3Range,[a.low,a.high],'classification range');
  assert.equal(r.p.respIsCompensation,false,'primary respiratory process is not Winter compensation');
  assert.deepEqual(Array.from(r.syn.processes).sort(),expectedProcesses.sort(),'composition reflects relative compensation deficit/excess');
  assert.equal(r.syn.title,met?'Смешанное нарушение':'Изолированное нарушение');
  interval(r.comp.range,[a.low,a.high],'compensation range');
  assert.equal(r.comp.checks[0],status==='within'?'совместима':status==='below'?'ниже ожид.':'выше ожид.');
  intervalText(r.comp.text,[a.low,a.high],'compensation text');
  intervalText(r.syn.detail,[a.low,a.high],'clinical conclusion');
  numericAndQC(e,d,r);
  e.input(d); e.run();
  assert.equal(e.read().chronicity,a.chronicity,'input reaches calculation');
  assert.equal(e.compute(e.read()).p.respiratoryRangeStatus,status);
  intervalText(e.text('syndrome'),[a.low,a.high],'actual UI conclusion');
  assert.equal(e.errors.length,0);
}
for(const a of anchors) {
  const points=[
    ['low',a.low,'within'], ['high',a.high,'within'],
    ['inside',(a.low+a.high)/2,'within'],
    ['low minus 0.01',a.low-.01,'below'],
    ['high plus 0.01',a.high+.01,'above'],
    ['floating representation just below low',a.low-Number.EPSILON*Math.max(1,Math.abs(a.low)),'within'],
    ['floating representation just above high',a.high+Number.EPSILON*Math.max(1,Math.abs(a.high)),'within'],
  ];
  for(const [name,h,status] of points)check(`${a.id}: ${name}`,{PaCO2:a.co,HCO3:h,chronicity:a.chronicity,range:[a.low,a.high],status},()=>evaluateKnown(a,h,status));
  check(`${a.id}: explicit context alias and history roundtrip`,{range:[a.low,a.high],chronicity:a.chronicity},()=>{
    const e=createEngine(),d=gas((a.low+a.high)/2,a.co,{chronicity:undefined,chronic:'',context:{chronicity:a.chronicity}});
    const r=e.compute(d); assert.equal(r.p.met,null); assert.equal(r.p.respiratoryRangeStatus,'within');
    e.input(d); e.run(); const before=e.read();
    e.call('saveHistory',e.call('makeHistory',before,e.compute(before).syn)); e.call('clearAll'); e.call('loadHistory',0);
    const after=e.read(); assert.equal(after.chronicity,a.chronicity);
    interval(e.compute(after).comp.range,[a.low,a.high],'restored compensation range');
    assert.equal(e.compute(after).p.met,null);
  });
}
for(const [id,h,co,acute,chronic] of [
  ['unknown RA',24,60,[26,28],[30,32]],
  ['unknown RAlk',24,30,[22,23],[19,20]],
])check(`${id}: both ranges, no history/age/notes inference`,{chronicity:'unknown',acute,chronic,warning:unknownWarning},()=>{
  // SBE_input=0 is intentionally preserved. For RA, its isolated QC conflict
  // keeps the established metabolic-priority branch from introducing a process.
  const e=createEngine(),d=gas(h,co,{SBE_input:0,Age:85,notes:'COPD; хроническое респираторное нарушение',history:'COPD',chronicity:'unknown'}),r=e.compute(d);
  const ranges=e.call('respiratoryCompensationRange',d);
  assert.equal(ranges.chronicity,'unknown'); assert.equal(ranges.selected,null);
  interval(ranges.acute,acute,'unknown acute'); interval(ranges.chronic,chronic,'unknown chronic');
  assert.equal(r.p.met,null); assert.equal(r.p.respiratoryPrimary,true); assert.equal(r.p.respiratoryRangeStatus,'unknown');
  assert.equal(r.p.respiratoryCompensationMatch,false); assert.equal(r.comp.range??null,null,'unknown has no selected interval');
  interval(r.comp.ranges.acute,acute,'unknown compensation acute'); interval(r.comp.ranges.chronic,chronic,'unknown compensation chronic');
  assert.equal(r.comp.checks[0],'хроничность неизвестна');
  assert(r.comp.text.includes(unknownWarning)); assert(r.syn.detail.includes(unknownWarning));
  intervalText(r.comp.text,acute,'unknown acute display'); intervalText(r.comp.text,chronic,'unknown chronic display');
  e.input(d); e.run(); assert.equal(e.read().chronicity,'unknown'); assert(e.text('syndrome').includes(unknownWarning));
});
// Literal existing Winter range for HCO3=18 remains 33–37 mmHg inclusive.
for(const [co,resp,adequate] of [[32.99,'respiratory alkalosis',false],[33,null,true],[35,null,true],[37,null,true],[37.01,'respiratory acidosis',false],[40,'respiratory acidosis',false]])check(`unknown chronicity: original Winter priority at PaCO2 ${co}`,{HCO3:18,PaCO2:co,Winter:[33,37],resp,adequate},()=>{
  const e=createEngine(),d=gas(18,co),r=e.compute(d);
  assert.equal(r.p.met,'metabolic acidosis'); assert.equal(r.p.resp,resp); assert.equal(r.p.respIsCompensation,adequate);
  assert(!r.p.respiratoryPrimary); assert.equal(r.comp.checks[0],adequate?'адекватна':co<33?'ниже ожид.':'выше ожид.'); if(co===32.99)assert.equal(r.p.primaryProcessCertain,false);
  intervalText(r.comp.text,[33,37],'Winter remains unchanged'); assert(!r.comp.text.includes(unknownWarning));
  numericAndQC(e,d,r);
});
for(const co of [35,45])check(`respiratory threshold inclusive exclusion at PaCO2 ${co}`,{PaCO2:co,resp:null},()=>{
  const e=createEngine(),d=gas(24,co,{chronicity:'acute'}),range=e.call('respiratoryCompensationRange',d),r=e.compute(d);
  assert.equal(range,null); assert(!r.p.respiratoryPrimary); assert.equal(r.p.resp,null); assert.equal(r.p.met,null);
});
check('gas QC conflict still blocks respiratory classification without correcting inputs',{HCO3:26,PaCO2:60,pH:7.6,blocked:true},()=>{
  const e=createEngine(),d=gas(26,60,{chronicity:'acute',pH:7.6}),r=e.compute(d);
  assert.equal(r.b.HCO3,26); assert.equal(r.p.invalid,true); assert.equal(r.syn.interpretationBlocked,true);
  assert(r.comp.text.includes('заблокирована')); assert(!r.p.respiratoryCompensationMatch);
});
const result={schema:1,sourceHash,policy:'User-approved inclusive respiratory compensation ranges; technical floating representation epsilon only.',
  anchors,pass:checks.filter(x=>x.status==='PASS').length,fail:checks.filter(x=>x.status==='FAIL').length,checks};
fs.writeFileSync(path.join(root,'reports/respiratory-range-boundaries'+(process.env.ICU_REPORT_SUFFIX||'')+'.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({test:'respiratory-range-boundaries',sourceHash,pass:result.pass,fail:result.fail}));
for(const item of checks.filter(x=>x.status==='FAIL'))console.log(item.id,item.error);
process.exitCode=result.fail?1:0;
