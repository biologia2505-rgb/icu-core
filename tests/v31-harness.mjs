import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
import {root,sourceHash} from './adapter/icu-html.mjs';import {check,finish} from './final-core-testkit.mjs';import {buildReport,sha} from './v31-report.mjs';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'icu-v31-harness-'));
try{
 fs.mkdirSync(path.join(temp,'reports'));fs.copyFileSync(path.join(root,'index.html'),path.join(temp,'index.html'));
 const file=path.join(temp,'reports/probe.json'),data={summary:{sourceHash,pass:1,fail:0}};
 fs.writeFileSync(file,JSON.stringify(data));
 const manifest=()=>({sourceHash,baseline:{exitCode:0,suites:21},suites:[{name:'probe',exitCode:0,report:'reports/probe.json',reportHash:sha(file)}]});
 check('current-success-generates-PASS','v31 harness',null,0,buildReport(temp,manifest()).exitCode);
 const stale=manifest();fs.writeFileSync(file,JSON.stringify({...data,stale:true}));check('changed-report-digest-rejects-PASS','v31 harness',null,1,buildReport(temp,stale).exitCode);
 fs.writeFileSync(file,JSON.stringify({summary:{sourceHash,pass:0,fail:1}}));check('actual-failure-rejects-PASS','v31 harness',null,1,buildReport(temp,manifest()).exitCode);
 fs.writeFileSync(file,JSON.stringify({summary:{sourceHash:'wrong',pass:1,fail:0}}));check('wrong-source-rejects-PASS','v31 harness',null,1,buildReport(temp,manifest()).exitCode);
 fs.writeFileSync(file,JSON.stringify(data));const m=manifest();m.baseline.exitCode=1;check('failed-original-baseline-rejects-PASS','v31 harness',null,1,buildReport(temp,m).exitCode);
 // A fault in the protected HH formula must fail both source freeze and independent gold.
 fs.mkdirSync(path.join(temp,'tests'));fs.cpSync(path.join(root,'tests'),path.join(temp,'tests'),{recursive:true});fs.cpSync(path.join(root,'reference'),path.join(temp,'reference'),{recursive:true,filter:p=>!p.endsWith('v30.1-frozen-package.zip')});
 const text=fs.readFileSync(path.join(temp,'index.html'),'utf8'),corrupted=text.replace('const HCO3calc=.03*','const HCO3calc=.04*');assert.notEqual(corrupted,text);fs.writeFileSync(path.join(temp,'index.html'),corrupted);
 const fault=spawnSync(process.execPath,[path.join(temp,'tests/v31-freeze.mjs')],{encoding:'utf8',env:{...process.env,ICU_SOURCE:path.join(temp,'index.html')},maxBuffer:12*1024*1024});
 check('HH-fault-fails-independent-math-checks','v31 harness',null,true,fault.status!==0);
}finally{fs.rmSync(temp,{recursive:true,force:true});}
finish('v31-harness');
