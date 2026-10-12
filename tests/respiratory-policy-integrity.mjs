import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {root,createEngine,sourceHash} from './adapter/icu-html.mjs';
const saved=process.env.ICU_SOURCE;process.env.ICU_SOURCE=path.join(root,'reference/final-core-baseline/index.html');
const baseline=await import('./adapter/icu-html.mjs?consolidated-policy-before');
if(saved===undefined)delete process.env.ICU_SOURCE;else process.env.ICU_SOURCE=saved;
const now=createEngine(),old=baseline.createEngine(),checks=[];
const check=(id,fn)=>{try{fn();checks.push({id,status:'PASS'});}catch(error){checks.push({id,status:'FAIL',error:String(error.stack||error)});}};
const body=(e,n)=>e.evaluate(n+'.toString()');
check('approved source before SHA',()=>assert.equal(baseline.sourceHash,'b1e7d49af5a211f3a6e25f587b99424719b1960327f245209573c317ce877a3f'));
for(const name of ['calcStewart','getTBWCoeff','respiratoryCompensationRange','phCompensation','calcDeltaDelta','deltaDeltaApplicable'])check('frozen formula/policy; only approved pH representation guard '+name,()=>assert.equal(body(now,name).replaceAll('normalisePHBoundary(d.pH)','d.pH'),body(old,name)));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'reference/final-core-baseline/original-manifest.json'))),hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const name of ['reference/clinical-scenarios-original.json','tests/cases-265.json','tests/cases-35.json','tests/clinical-contracts-300.json','reference/numerical-before-300.json'])check('independent source/gold not overwritten '+name,()=>assert.equal(hash(path.join(root,name)),manifest.files[name]));
check('approved primary amendment retained',()=>assert(fs.readFileSync(path.join(root,'reference/FINAL_CORE_PRIMARY_AND_FIO2_AMENDMENT.md'),'utf8').length>100));
// Literal ranges independently approved by the user. No added clinical tolerance.
const anchors=[['acute',50,25,26],['chronic',50,27,28],['acute',60,26,28],['chronic',60,30,32],['acute',80,28,32],['chronic',80,36,40],['acute',30,22,23],['chronic',30,19,20],['acute',25,21,22.5],['chronic',25,16.5,18]];
for(const [chronicity,pCO2,low,high]of anchors)check('respiratory arithmetic range '+chronicity+' '+pCO2,()=>{const r=now.call('respiratoryCompensationRange',{pCO2,chronicity});assert.deepEqual(encRange(r.selected),{low,high});});
function encRange(r){return JSON.parse(JSON.stringify(r));}
check('respiratory unknown does not infer duration',()=>{const r=now.call('respiratoryCompensationRange',{pCO2:60,chronicity:'unknown',notes:'COPD chronic'});assert.equal(r.selected,null);assert.equal(r.chronicity,'unknown');assert.deepEqual(encRange(r.acute),{low:26,high:28});assert.deepEqual(encRange(r.chronic),{low:30,high:32});});
for(const expression of ['1.5*b.HCO3+8-2','1.5*b.HCO3+8+2'])check('Winter original formula remains '+expression,()=>assert(body(now,'compensation').includes(expression)&&body(old,'compensation').includes(expression)));
const scenarios=JSON.parse(fs.readFileSync(path.join(root,'reference/clinical-scenarios-original.json'))),clinicalChanges=[];
const enc=v=>JSON.parse(JSON.stringify(v));
const clinical=r=>enc({met:r.p.met,resp:r.p.resp,processes:r.syn.processes,possibleProcesses:r.syn.possibleProcesses,title:r.syn.title,confidence:r.h.confidence,hasHAGMA:r.h.hasHAGMA,deltaApplicable:r.dd.applicable});
for(let i=0;i<scenarios.length;i++){const c=scenarios[i],d={...c.input,...c.context};for(const k of ['respiratorySupport','adequateResuscitation'])if(typeof d[k]==='boolean')d[k]=d[k]?'yes':'no';now.input(d,c.config);old.input(d,c.config);const a=clinical(now.compute(d)),b=clinical(old.compute(d));if(JSON.stringify(a)!==JSON.stringify(b))clinicalChanges.push({number:i+1,id:c.id,before:b,after:a});}
const comparisonPath=path.join(root,'reports/final-core-before-after-300.json');
check('all current 300 before/after changes reviewed under explicit user rules',()=>{const c=JSON.parse(fs.readFileSync(comparisonPath));assert.equal(c.summary.sourceHash,sourceHash,'before/after report must come from current source');assert.equal(c.summary.unapprovedChanges,0);assert.equal(c.summary.unusedApprovals,0);});
const result={sourceHash,beforeSourceHash:hash(path.join(root,'reference/index-before-respiratory-range.html')),consolidatedBaselineSHA:baseline.sourceHash,pass:checks.filter(c=>c.status==='PASS').length,fail:checks.filter(c=>c.status==='FAIL').length,clinicalChanges,wordingChanges:[],checks,scope:'Consolidated authorized patch; original formulas/oracles preserved; old whole-function/UI freezes retained as historical evidence, replaced by explicit formula and approved-policy checks.'};
fs.writeFileSync(path.join(root,'reports/respiratory-policy-integrity.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({policy:'respiratory-policy-integrity',pass:result.pass,fail:result.fail,changedClinicalScenarios:clinicalChanges.length}));for(const c of checks.filter(c=>c.status==='FAIL'))console.log(c.id,c.error);process.exitCode=result.fail?1:0;
