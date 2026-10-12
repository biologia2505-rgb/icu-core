import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {root,createEngine,sourceHash} from './adapter/icu-html.mjs';

const reports=path.join(root,'reports'),folder=path.join(root,'tests/final-adversarial');
const matrixNames=['acidbase','scores','context','supplement','reload','priority-anchors'];
const reportNames=['acidbase-matrix','scores-oxygen-matrix','qc-history-sepsis-electrolytes-matrix','supplement-matrix','reload-matrix','priority-anchors-matrix'];
const baselineFolder=path.join(root,'reference/final-core-baseline/adversarial');
const ledgerPath=path.join(root,'tests/final-adversarial-approved-ledger.json');
const ledger=JSON.parse(fs.readFileSync(ledgerPath,'utf8'));
const v31File=path.join(root,'tests/v31-approved-adversarial-expectations.json');
const v31Entries=fs.existsSync(v31File)?JSON.parse(fs.readFileSync(v31File)):[];
const v31Map=new Map(v31Entries.map(x=>[x.id,x]));
const digest=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const encode=v=>JSON.parse(JSON.stringify(v,(_,x)=>x===undefined?{$missing:true}:typeof x==='number'&&!Number.isFinite(x)?{$number:String(x)}:x));
const same=(a,b)=>JSON.stringify(encode(a))===JSON.stringify(encode(b));
const decode=x=>Array.isArray(x)?x.map(decode):x&&typeof x==='object'?x.$number?Number(x.$number):x.$missing||x.$undefined?undefined:Object.fromEntries(Object.entries(x).map(([k,v])=>[k,decode(v)])):x;
const entries=new Map(ledger.entries.map(x=>[x.probeId,x]));
if(entries.size!==ledger.entries.length)throw Error('Duplicate approved ledger probe IDs');
const suites=[];
for(let i=0;i<matrixNames.length;i++){
 const name=matrixNames[i],file=path.join(folder,name+'.mjs'),beforeFile=path.join(baselineFolder,'matrix',name+'.mjs');
 if(digest(file)!==digest(beforeFile))throw Error('Original adversarial probe script changed: '+name);
 const output=path.join(reports,'final-adversarial-raw-'+reportNames[i]+'.json');fs.rmSync(output,{force:true});
 const result=spawnSync(process.execPath,[file],{encoding:'utf8',env:process.env});
 if(result.status!==0||!fs.existsSync(output))throw Error('Adversarial execution failed: '+name+'\n'+result.stderr+'\n'+result.stdout);
 const actual=JSON.parse(fs.readFileSync(output,'utf8'));
 if(actual.sourceSHA256!==sourceHash)throw Error('Stale source hash for '+name);
 suites.push({name,probeScriptSHA256:digest(file),rawReport:'reports/'+path.basename(output),rawReportSHA256:digest(output),caseCount:actual.caseCount,counts:actual.counts});
}

// Projections migrate textual/API extraction only. The comparator still uses explicit old or user-approved independent expected values.
function projection(row,entry){
 if(entry.projection==='raw')return row.actual;
 const d=decode(row.input),e=createEngine();e.input(d);const b=e.call('calcBasic',d);
 switch(entry.projection){
  case 'apache-population':{const r=e.call('calcAPACHE2',d,b);return{applicable:r.applicable,finalTotalAvailable:r.complete===true&&Number.isFinite(r.total),status:r.status};}
  case 'independent-support':{const r=e.call('calcSOFA',d,b),n=e.call('calcNEWS2',d),qc=e.call('clinicalQC',d,b);return{BerlinConfirmed:e.call('ardsAssessment',d,b).confirmed,SOFARespiratory:r.items[0].score,PEEP:d.PEEP,respiratorySupport:d.respiratorySupport,O2support:d.O2support,NEWSOxygen:n.items.find(x=>x.name==="Кислород").score,contextWarning:qc.warnings.some(w=>w.code==="PRESSURE_SUPPORT_CONTEXT")};}
  case 'apache-availability':{const r=e.call('calcAPACHE2',d,b);return{unqualifiedFinal:r.complete===true&&Number.isFinite(r.total)};}
  case 'news-risk':return{risk:e.call('calcNEWS2',d).riskBand};
  case 'nonsynchronous-report':{e.run();const qc=e.call('clinicalQC',d,b),warning=qc.warnings.find(x=>x.code==='NON_SIMULTANEOUS_SAMPLE'),report=e.evaluate('lastReport');return{contextDisclosed:!!warning&&report.includes(warning.code)&&report.includes(warning.message)};}
  case 'invalid-report':{e.run();const qc=e.call('clinicalQC',d,b),warning=qc.warnings.find(x=>x.code===entry.warningCode),report=e.evaluate('lastReport');return{invalidDisclosed:!!warning&&report.includes(warning.code)&&report.includes(warning.message)};}
  case 'ambiguous-primary':{const p=e.call('detectPrimary',d,b);return{resp:p.resp,met:p.met,primaryProcessCertain:p.primaryProcessCertain,possibleMetabolicProcesses:[...(p.possibleMetabolicProcesses??[])].sort(),selectedHCO3Range:p.respiratoryRange?.selected};}
  case 'qc-risk-status':{e.run();const text=e.text('riskValue');return{noPercent:!/%/.test(text),statusAllowed:['Данные полные','Есть предупреждения','Интерпретация ограничена'].includes(text)};}
  case 'renal-partial':{const r=e.call('calcSOFA',d,b),i=r.items.find(x=>x.name==='Креатинин / диурез 24 ч');return{score:i.score,fullyDetermined:i.fullyDetermined,lowerBound:i.lowerBound,complete:r.complete};}
  default:throw Error('Unknown approved projection '+entry.projection);
 }
}
const contributorEntries=JSON.parse(fs.readFileSync(path.join(root,'tests/v31-contributors-adversarial-expectations.json')));
const contributorMap=new Map(contributorEntries.map(x=>[x.id,x]));
const rows=[],seen=new Set(),errors=[];
for(const name of reportNames){
 const raw=JSON.parse(fs.readFileSync(path.join(reports,'final-adversarial-raw-'+name+'.json'),'utf8'));
 const before=JSON.parse(fs.readFileSync(path.join(baselineFolder,name+'.json'),'utf8'));
 const originals=new Map(before.cases.map(x=>[x.id,x]));
 if(raw.cases.length!==before.cases.length)throw Error('Original adversarial cases deleted/added in '+name);
 for(const row of raw.cases){
  if(seen.has(row.id))throw Error('Duplicate original probe '+row.id);seen.add(row.id);
  const old=originals.get(row.id);if(!old)throw Error('Unknown original probe '+row.id);
  if(!same(row.expected,old.expected)){
   const dynamicNa=['HISTORY-solution-context','RELOAD-solutions'].includes(row.id)&&same({...row.expected,naVolume:old.expected.naVolume},old.expected)&&same(row.expected.naVolume,{$number:'NaN'});
   if(!dynamicNa)throw Error('Raw expected modified: '+row.id);
  }
  // Only approved selector scaffolding may be new; every original numerical fixture is preserved.
  for(const [key,value]of Object.entries(old.input??{}))if(typeof value==='number'||value&&typeof value==='object'&&'$number'in value){if(!same(row.input?.[key],value))throw Error('Synthetic numeric input changed: '+row.id+'/'+key);}
  const entry=entries.get(row.id);
  if(entry&&!same(entry.oldExpected,old.expected))throw Error('Ledger old expected does not match immutable baseline: '+row.id);
  const previousExpected=entry?entry.newApprovedExpected:row.expected;
  const v31=v31Map.get(row.id);
  if(v31&&!same(v31.before,previousExpected))throw Error('v31 adversarial expectation no longer matches retained v30 assertion: '+row.id);
  const initialExpected=v31?v31.after:previousExpected;
  const contributor=contributorMap.get(row.id);
  if(contributor&&!same(contributor.before,initialExpected))throw Error('Contributor adversarial expectation does not match retained v31 expectation: '+row.id);
  const expected=contributor?contributor.after:initialExpected;
  let actual=entry?projection(row,entry):row.actual;
  if((contributor?.projection??v31?.projection)==='alkalinizing-components'){
   const d=decode(row.input),r=createEngine().compute(d);
   actual={NAGMA:r.syn.processes.includes('NAGMA'),alk:r.syn.processes.includes('metabolic alkalosis'),possible:r.syn.possibleProcesses.includes('metabolic alkalinizing component'),supportedComponent:r.syn.processes.includes('metabolic alkalinizing component')};
  }
  if(contributor?.projection==='probable-alkalinizing-component'){
   const d=decode(row.input),r=createEngine().compute(d);
   actual={NAGMA:r.syn.processes.includes('NAGMA'),alk:r.syn.processes.includes('metabolic alkalosis'),possible:r.syn.possibleProcesses.includes('metabolic alkalinizing component'),probableComponent:r.syn.processConfidence['metabolic alkalinizing component']==='probable'};
  }
  const review=entry?.remainReview===true||(!entry&&row.status==='REVIEW');
  // Existing numeric-only comparisons retain the original arithmetic tolerance; no clinical comparison is broadened.
  let pass=same(actual,expected);
  if(!entry&&!v31&&!contributor&&row.status==='PASS')pass=true;
  const status=review?'REVIEW':pass?'PASS':'FAIL';
  rows.push({...row,rawStatus:row.status,rawExpected:row.expected,rawActual:row.actual,expected:encode(expected),actual:encode(actual),status,assessment:entry??null,v31Amendment:v31??null,contributorAmendment:contributor??null,previousV31Expected:initialExpected,before:{status:old.status,actual:old.actual,expected:old.expected},sourceMatrix:name});
  if(status==='FAIL')errors.push({id:row.id,expected,actual,defectIds:row.defectIds});
 }
}
for(const entry of ledger.entries)if(!seen.has(entry.probeId))throw Error('Ledger entry refers to absent probe '+entry.probeId);
if(rows.length!==1970)throw Error('Required1970 original probes not all present: '+rows.length);
const counts={PASS:rows.filter(x=>x.status==='PASS').length,FAIL:rows.filter(x=>x.status==='FAIL').length,REVIEW:rows.filter(x=>x.status==='REVIEW').length};
const summary={schema:'final-adversarial-result-v1',sourceHash,cases:rows.length,pass:counts.PASS,fail:counts.FAIL,review:counts.REVIEW,confirmedDefectFailures:counts.FAIL,rawCounts:rows.reduce((a,r)=>(a[r.rawStatus]=(a[r.rawStatus]??0)+1,a),{}),approvedLedgerEntries:ledger.entries.length,v31ApprovedEntries:v31Entries.length,contributorAmendments:contributorEntries.length,ledgerSHA256:digest(ledgerPath),originalProbeScriptsUnchanged:true,originalRawExpectedPreservedInBefore:true,dynamicSodiumExpectationChanges:rows.filter(x=>!same(x.rawExpected,x.before.expected)).map(x=>x.id),originalSyntheticNumericInputsUnchanged:true};
fs.writeFileSync(path.join(reports,'final-adversarial.json'),JSON.stringify({summary,suites,rows},null,2)+'\n');
const md=['# Final consolidated adversarial matrix','',`Source SHA: \`${sourceHash}\``,`1970 preserved probes: ${counts.PASS} PASS / ${counts.FAIL} FAIL / ${counts.REVIEW} REVIEW.`,`Confirmed defect failures: ${counts.FAIL}.`,'','Original probe scripts and numerical synthetic inputs are unchanged. Two runtime-derived sodium-volume expectations now return NaN under v31 rule 11; original raw expectations remain in each before record. Initial v31 amendments are retained in v31-approved-adversarial-expectations.json; removal of unapproved heuristics / ratio-label clarification is explicit in v31-contributors-adversarial-expectations.json.','', '## Approved expectation / extraction ledger','', '| Probe ID | Old expected | New approved expected | Rule | Status |','|---|---|---|---|---|',...rows.filter(r=>r.assessment).map(r=>`| ${r.id.replaceAll('|','\\|')} | ${JSON.stringify(r.rawExpected).replaceAll('|','\\|')} | ${JSON.stringify(r.expected).replaceAll('|','\\|')} | ${r.assessment.exactApprovedRule.replaceAll('|','\\|')} | ${r.status} |`),'','## Active REVIEW: '+counts.REVIEW,'',...rows.filter(r=>r.status==='REVIEW').map(r=>`- ${r.id}: ${r.assessment?.note??r.note}`),''];
fs.writeFileSync(path.join(reports,'final-adversarial.md'),md.join('\n'));
console.log(JSON.stringify(summary));for(const error of errors)console.log(JSON.stringify(error));process.exitCode=counts.FAIL||counts.REVIEW?1:0;
