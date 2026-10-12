import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';
import {sha,buildReport} from './v31-report.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),reports=path.join(root,'reports');
const expectedArchive='65db1dd7b0c59e7a4fa23c766af8d2dbf6fc2a31ae3515c719910ae3814203ff';
const archive=path.join(root,'reference/v30.1-frozen-package.zip');
const outputs=['regression-35','integration','missing-inputs','regression-300','classification-boundaries','respiratory-range-boundaries','metabolic-alkalosis-boundaries','final-core-defects','final-core-scores','final-core-state','zero-review-cleanup','preset-state','final-adversarial-run','v31-synthesis','v31-contributors','v31-freeze','v31-ui','v31-harness'];
const manifest={sourceHash:sha(path.join(root,'index.html')),startedAt:new Date().toISOString(),baseline:null,suites:[]};
try{
 if(sha(archive)!==expectedArchive)throw Error('Frozen baseline archive hash differs; refuses to overwrite or replace the baseline');
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'icu-v31-original-suite-'));
 try{
  const python=process.env.ICU_REPORT_PYTHON||'python3';
  const unzip=spawnSync(python,['-c','import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])',archive,temp],{encoding:'utf8'});
  if(unzip.status!==0)throw Error('Cannot extract frozen baseline: '+unzip.stderr);
  const baseline=spawnSync(process.execPath,[path.join(temp,'tests/run-all.mjs')],{encoding:'utf8',env:{...process.env,ICU_SOURCE:path.join(temp,'index.html')},maxBuffer:16*1024*1024});
  fs.writeFileSync(path.join(reports,'v30.1-repeated-suite.log'),baseline.stdout+baseline.stderr);
  const suite=JSON.parse(fs.readFileSync(path.join(temp,'reports/suite-run.json')));
  manifest.baseline={sourceHash:sha(path.join(temp,'index.html')),archiveHash:expectedArchive,exitCode:baseline.status??1,suites:suite.suites.length,originalSuiteManifest:suite};
  fs.writeFileSync(path.join(reports,'v30.1-repeated-suite.json'),JSON.stringify(manifest.baseline,null,2)+'\n');
  console.log('Frozen v30.1:',manifest.baseline.exitCode===0?'21/21 PASS':'FAIL');
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
 for(const name of outputs){
  const reportName=name==='final-adversarial-run'?'final-adversarial':name,file=path.join(reports,reportName+'.json');
  fs.rmSync(file,{force:true});
  const result=spawnSync(process.execPath,[path.join(root,'tests',name+'.mjs')],{encoding:'utf8',env:{...process.env,ICU_SOURCE:path.join(root,'index.html')},maxBuffer:24*1024*1024});
  fs.writeFileSync(path.join(reports,name+'.log'),result.stdout+result.stderr);
  const row={name,exitCode:result.status??1,report:fs.existsSync(file)?'reports/'+reportName+'.json':null,reportHash:fs.existsSync(file)?sha(file):null};
  manifest.suites.push(row);console.log(name+': '+(row.exitCode===0?'PASS':'FAIL'));
 }
 manifest.completedAt=new Date().toISOString();
 fs.writeFileSync(path.join(reports,'v31-suite-run.json'),JSON.stringify(manifest,null,2)+'\n');
 const final=buildReport(root,manifest);console.log(JSON.stringify({status:final.exitCode?'FAIL':'PASS',baselineSuites:21,v31Suites:final.suites.length,failures:final.failures}));process.exitCode=final.exitCode;
}catch(e){
 manifest.error=String(e.stack??e);fs.writeFileSync(path.join(reports,'v31-suite-run.json'),JSON.stringify(manifest,null,2)+'\n');
 fs.writeFileSync(path.join(reports,'TEST_SUMMARY_v31.md'),'# ICU CORE v31.0-dev\n\n**FAIL** — проверка не завершена.\n\n'+manifest.error+'\n');console.error(e);process.exitCode=1;
}
