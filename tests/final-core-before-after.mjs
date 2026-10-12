import fs from 'node:fs';
import path from 'node:path';
import {root,sourceHash} from './adapter/icu-html.mjs';
import {capture300,encode} from './final-core-capture.mjs';
const before=JSON.parse(fs.readFileSync(path.join(root,'reference/final-core-baseline/outputs-300.json'))),after=capture300();
const ledgerPath=path.join(root,'reference/FINAL_CORE_APPROVED_300_CHANGES.json');
const ledger=fs.existsSync(ledgerPath)?JSON.parse(fs.readFileSync(ledgerPath)):[];
const clinical=r=>({processes:r.ui.syn.processes,possibleProcesses:r.ui.syn.possibleProcesses,syndromeTitle:r.ui.syn.title,metabolic:r.ui.p.met,respiratory:r.ui.p.resp,respiratoryPrimary:r.ui.p.respiratoryPrimary,primaryProcessCertain:r.ui.p.primaryProcessCertain,hagmaConfidence:r.ui.h.confidence,hagmaSupported:r.ui.h.hasHAGMA,deltaApplicable:r.ui.dd.applicable,scales:r.ui.scales.map(s=>({name:s.name,total:s.total,complete:s.complete,missing:s.missing,conditional:s.conditional,items:s.items?.map(x=>({name:x.name,score:x.score,available:x.available,conditional:x.conditional}))})),sepsis:{sepsisConfirmed:r.ui.sepsis.sepsisConfirmed,shockConfirmed:r.ui.sepsis.shockConfirmed,sofaDelta:r.ui.sepsis.sofaDelta}});
const changes=[],rows=[];
for(let i=0;i<before.cases.length;i++){
 const b=before.cases[i],a=after[i];if(b.id!==a.id||b.number!==a.number)throw Error('Case identity/order differs');
 const x=encode(clinical(b)),y=encode(clinical(a));
 for(const field of Object.keys(x))if(JSON.stringify(x[field])!==JSON.stringify(y[field])){
  const approval=ledger.find(v=>v.id===b.id&&v.field===field&&JSON.stringify(encode(v.before))===JSON.stringify(x[field])&&JSON.stringify(encode(v.after))===JSON.stringify(y[field]));
  changes.push({number:b.number,id:b.id,field,before:x[field],after:y[field],why:approval?.why??'UNAPPROVED — requires explicit scope/gold review',defectIds:approval?.defectIds??[],status:approval?'APPROVED':'UNAPPROVED'});
 }
 rows.push({number:b.number,id:b.id,before:x,after:y,reportChanged:b.report!==a.report,compositionChanged:['processes','possibleProcesses','syndromeTitle','metabolic','respiratory','hagmaConfidence','hagmaSupported'].some(k=>JSON.stringify(x[k])!==JSON.stringify(y[k]))});
}
const unused=ledger.filter(v=>!changes.some(c=>c.id===v.id&&c.field===v.field&&JSON.stringify(c.before)===JSON.stringify(encode(v.before))&&JSON.stringify(c.after)===JSON.stringify(encode(v.after))));
const summary={sourceHash,beforeSHA:before.sourceSHA256,cases:rows.length,changedCases:new Set(changes.map(c=>c.id)).size,compositionChangedCases:rows.filter(r=>r.compositionChanged).length,changedFields:changes.length,unapprovedChanges:changes.filter(c=>c.status==='UNAPPROVED').length,unusedApprovals:unused.length};
fs.writeFileSync(path.join(root,'reports/final-core-before-after-300.json'),JSON.stringify({summary,changes,unusedApprovals:unused,rows},null,2)+'\n');
fs.writeFileSync(path.join(root,'reports/final-core-after-300.json'),JSON.stringify({sourceSHA256:sourceHash,cases:after},null,2)+'\n');
console.log(JSON.stringify(summary));process.exitCode=summary.unapprovedChanges||summary.unusedApprovals?1:0;
