import fs from 'node:fs';
import path from 'node:path';
import {root,createEngine,sourceHash} from './adapter/icu-html.mjs';
import {approvedExpectation} from './final-core-approved-expectations.mjs';
const cases=JSON.parse(fs.readFileSync(path.join(root,'reference/clinical-scenarios-original.json')));
const contracts=JSON.parse(fs.readFileSync(path.join(root,'tests/clinical-contracts-300.json')));
const protectedCases=JSON.parse(fs.readFileSync(path.join(root,'tests/cases-35.json')));
const encode=v=>JSON.parse(JSON.stringify(v,(_,x)=>x===undefined?{$undefined:true}:typeof x==='number'&&!Number.isFinite(x)?{$number:String(x)}:x));
const rows=[];
for(let i=0;i<cases.length;i++){
 const c=cases[i],g=contracts[i],e=createEngine(),checks=[];
 const test=(group,label,actual,original)=>{const approved=approvedExpectation('regression-300',c.id,label,original);checks.push({group,label,status:JSON.stringify(encode(actual))===JSON.stringify(encode(approved.expected))?'PASS':'FAIL',actual:encode(actual),...approved,expected:encode(approved.expected)});};
 let actual=null,qc=null,ui=null;
 try{
  const snapshot=JSON.stringify(c),d={...c.input,...c.context};
  for(const key of ['respiratorySupport','adequateResuscitation'])if(typeof d[key]==='boolean')d[key]=d[key]?'yes':'no';
  e.input(d,c.config);if(c.context.chronicity)e.input({chronic:c.context.chronicity});
  actual=e.compute(d);qc=e.call('clinicalQC',d,actual.b);
  if(!g.protected){
   const expectedMet=g.processes.includes('HAGMA')||g.processes.includes('NAGMA')?'metabolic acidosis':g.processes.includes('metabolic alkalosis')?'metabolic alkalosis':null;
   test('clinical','primary metabolic process (independent gold)',actual.p.met,expectedMet);
   test('clinical','primary respiratory process (independent gold)',actual.p.resp,g.processes.find(x=>x.startsWith('respiratory '))??null);
   test('clinical','confirmed/probable process composition',[...(actual.syn.processes??[])].sort(),[...g.processes].sort());
   test('clinical','possible processes are not proven',[...(actual.syn.possibleProcesses??[])].sort(),[...g.possibleProcesses].sort());
   test('clinical','cautious acidifying shift',!!actual.syn.acidifyingShift,g.acidifyingShift);
   if(g.processes.length>1)test('clinical','multiple processes cannot be isolated',actual.syn.title.includes('Изолированное'),false);
   if(g.processes.length===1)test('clinical','single primary with compensation is isolated',actual.syn.title,'Изолированное нарушение');
   if(i>=285)test('clinical','normal controls',actual.syn.title,'Расстройств КОС не выявлено');
  }else{
   const f=protectedCases.find(x=>x.number===i+1);
   for(const [label,actualValue,expected]of [['primary',actual.p.met,f.clinical.primary],['HAGMA supported',actual.h.hasHAGMA,f.clinical.hagma],['confidence',actual.h.confidence,f.clinical.anionConfidence],['ratio applicability',actual.dd.applicable,f.clinical.deltaApplicable]])test('clinical','protected35 '+label,actualValue,expected);
  }
  test('clinical','no generic hidden mixed sentence',/скрытое смешанное нарушение/.test(actual.syn.detail+' '+actual.ph.detail),false);
  const sbeConflict=qc.warnings.some(w=>w.code==='SBE_CONFLICT');
  if(!sbeConflict)test('qc','no invented SBE conflict in clinical text',/QC-конфликте SBE|конфликт SBE_input/.test(actual.dd.classification+' '+actual.syn.detail+' '+actual.h.reason),false);
  if([237,238,239,246,247,248].includes(i+1))test('clinical','possible anion alone is not mixed',actual.h.reason.includes('на фоне смешанного нарушения'),false);
  if(g.chronicity){test('clinical','respiratory primary has no metabolic primary',actual.p.met,null);test('clinical','respiratory expected compensation match',actual.p.respiratoryCompensationMatch,true);}
  const inputBefore=encode(e.read());e.run();ui=e.compute(e.read());
  test('input','synthetic original never changed',JSON.stringify(c),snapshot);test('ui','form never silently corrected',encode(e.read()),inputBefore);test('ui','runtime errors',e.errors,[]);
  test('ui','same clinical result through actual form',ui.syn.title,actual.syn.title);test('ui','same interpretation through actual form',ui.syn.detail,actual.syn.detail);
  test('ui','report generated',e.evaluate('lastReport').length>0,true);
  if(g.chronicity){
   test('history','explicit form chronicity',e.read().chronicity??e.read().chronic,g.chronicity);
   const history=e.call('makeHistory',e.read(),ui.syn);test('history','history chronicity',history.chronicity??history.chronic,g.chronicity);
   e.call('saveHistory',history);e.call('clearAll');test('history','reset removes chronicity',e.read().chronicity??e.read().chronic,'unknown');
   e.call('loadHistory',0);test('history','restore retains chronicity',e.read().chronicity??e.read().chronic,g.chronicity);
   const restored=e.compute(e.read());test('history','restored diagnosis identical',restored.syn.detail,ui.syn.detail);test('history','restored metabolic compensation not primary',restored.p.met,null);
  }
 }catch(error){checks.push({group:'execution',label:'actual engine',status:'FAIL',actual:String(error.stack||error),expected:'successful execution'});}
 rows.push({number:i+1,id:c.id,status:checks.every(x=>x.status==='PASS')?'PASS':'FAIL',contract:g,actual:encode(actual),qc:encode(qc),checks});
}
const summary={cases:rows.length,pass:rows.filter(x=>x.status==='PASS').length,fail:rows.filter(x=>x.status==='FAIL').length,checks:rows.reduce((n,r)=>n+r.checks.length,0),failedChecks:rows.flatMap(r=>r.checks).filter(x=>x.status==='FAIL').length,sourceHash,nativeBrowser:false};
const suffix=process.env.ICU_REPORT_SUFFIX||'';
fs.writeFileSync(path.join(root,`reports/regression-300${suffix}.json`),JSON.stringify({summary,rows},null,2)+'\n');
console.log(JSON.stringify(summary));
for(const r of rows.filter(x=>x.status==='FAIL'))console.log(JSON.stringify({number:r.number,id:r.id,failures:r.checks.filter(x=>x.status==='FAIL')}));
process.exitCode=summary.fail?1:0;
