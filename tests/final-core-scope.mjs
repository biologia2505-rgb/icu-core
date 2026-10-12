import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {root,sourceHash,source,createEngine} from './adapter/icu-html.mjs';
const manifest=JSON.parse(fs.readFileSync(path.join(root,'reference/final-core-baseline/original-manifest.json'))),checks=[];
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const test=(id,actual,expected)=>checks.push({id,status:JSON.stringify(actual)===JSON.stringify(expected)?'PASS':'FAIL',actual,expected});
for(const [file,hash]of Object.entries(manifest.files)){
 test('Sealed original authorized package snapshot: '+file,sha(path.join(root,'reference/final-core-baseline/original-package',file)),hash);
 const original=path.join(manifest.originalFolder,file);if(fs.existsSync(original))test('Original external package remains unchanged: '+file,sha(original),hash);
}
test('Preserved baseline source',sha(path.join(root,'reference/final-core-baseline/index.html')),manifest.sourceSHA256);
const before=fs.readFileSync(path.join(root,'reference/final-core-baseline/index.html'),'utf8');
test('CSS change has explicit user-authorized UI addendum',fs.existsSync(path.join(root,'reference/FINAL_UI_EGFR_ADDENDUM.txt')),true);
const e=createEngine();
test('No invented weighted probability',e.evaluate('updateRisk.toString()').includes('risk+='),false);
test('No old APACHE individual mortality bands',/10–15%|25–40%|55–75%|>80%|<10%/.test(e.evaluate('calcAPACHE2.toString()')),false);
for(const file of ['tests/cases-265.json','tests/cases-35.json','tests/clinical-contracts-300.json','reference/clinical-scenarios-original.json','reference/numerical-before-300.json'])test('Original independent oracle/inputs: '+file,sha(path.join(root,file)),manifest.files[file]);
const ids=['AB-01','AB-02','AB-04','SC-01','SC-02','SC-03','SC-04','SC-06','SC-07','SC-08','SC-09','OX-01','SEP-01','EL-01','EL-02','QC-01','QC-02','HIST-01','HIST-02','HIST-03','UI-01','UI-02','UI-03','UI-04','UI-05','UI-06','UI-07','EXTRA-RISK-01','EXTRA-APACHE-01','EXTRA-APACHE-02'];
const rows=['final-core-defects','final-core-scores','final-core-state'].flatMap(n=>{const d=JSON.parse(fs.readFileSync(path.join(root,'reports',n+'.json')));test('Current source/new suite provenance: '+n,d.summary.sourceHash,sourceHash);return d.cases;});
for(const id of ids){const subset=rows.filter(r=>r.defectIds.includes(id));test('Separate regression coverage '+id,subset.length>0,true);test('All new assertions PASS '+id,subset.every(r=>r.status==='PASS'),true);}
const summary={sourceHash,cases:checks.length,pass:checks.filter(c=>c.status==='PASS').length,fail:checks.filter(c=>c.status==='FAIL').length,coveredDefectIds:ids};
fs.writeFileSync(path.join(root,'reports/final-core-scope.json'),JSON.stringify({summary,checks},null,2)+'\n');console.log(JSON.stringify(summary));process.exitCode=summary.fail?1:0;
