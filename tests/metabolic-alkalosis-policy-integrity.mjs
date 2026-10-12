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
// The formula and ±2 are frozen; availability/selection/representation are
// covered by explicitly authorized primary-process and technical-boundary tests.
for(const h of [27,28,30,35,40,45])check('metabolic alkalosis literal formula h='+h,()=>{const low=.7*h+19,high=.7*h+23;assert.equal(high-low,4);const d={...now.read(),HCO3in:h,pCO2:(low+high)/2,pH:7.5};d.SBE_input=h-24.4+16.2*(d.pH-7.4);const b={...now.call('calcBasic',d),HCO3calc:h};const p={met:'metabolic alkalosis',resp:null,respIsCompensation:true},r=now.call('compensation',d,b,p);assert.deepEqual(Array.from(r.checks),['адекватна']);assert(r.text.includes(low.toFixed(1)+'–'+high.toFixed(1)));});
for(const expression of ['0.7*b.HCO3+21-2','0.7*b.HCO3+21+2'])check('metabolic alkalosis original formula remains '+expression,()=>assert(body(now,'compensation').includes(expression)&&body(old,'compensation').includes(expression)));
for(const expression of ['1.5*b.HCO3+8-2','1.5*b.HCO3+8+2'])check('Winter formula remains '+expression,()=>assert(body(now,'compensation').includes(expression)&&body(old,'compensation').includes(expression)));
const scenarios=JSON.parse(fs.readFileSync(path.join(root,'reference/clinical-scenarios-original.json'))),clinicalChanges=[];
const enc=v=>JSON.parse(JSON.stringify(v));
const clinical=r=>enc({met:r.p.met,resp:r.p.resp,processes:r.syn.processes,possibleProcesses:r.syn.possibleProcesses,title:r.syn.title,confidence:r.h.confidence,hasHAGMA:r.h.hasHAGMA,deltaApplicable:r.dd.applicable});
for(let i=0;i<scenarios.length;i++){const c=scenarios[i],d={...c.input,...c.context};for(const k of ['respiratorySupport','adequateResuscitation'])if(typeof d[k]==='boolean')d[k]=d[k]?'yes':'no';now.input(d,c.config);old.input(d,c.config);const a=clinical(now.compute(d)),b=clinical(old.compute(d));if(JSON.stringify(a)!==JSON.stringify(b))clinicalChanges.push({number:i+1,id:c.id,before:b,after:a});}
const comparisonPath=path.join(root,'reports/final-core-before-after-300.json');
check('all current 300 before/after changes reviewed under explicit user rules',()=>{const c=JSON.parse(fs.readFileSync(comparisonPath));assert.equal(c.summary.sourceHash,sourceHash,'before/after report must come from current source');assert.equal(c.summary.unapprovedChanges,0);assert.equal(c.summary.unusedApprovals,0);});
const result={sourceHash,beforeSourceHash:hash(path.join(root,'reference/index-before-metabolic-alkalosis-compensation.html')),consolidatedBaselineSHA:baseline.sourceHash,pass:checks.filter(c=>c.status==='PASS').length,fail:checks.filter(c=>c.status==='FAIL').length,clinicalChanges,wordingChanges:[],checks,scope:'Consolidated authorized patch; original formulas/oracles preserved; old whole-function/UI freezes retained as historical evidence, replaced by explicit formula and approved-policy checks.'};
fs.writeFileSync(path.join(root,'reports/metabolic-alkalosis-policy-integrity.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({policy:'metabolic-alkalosis-policy-integrity',pass:result.pass,fail:result.fail,changedClinicalScenarios:clinicalChanges.length}));for(const c of checks.filter(c=>c.status==='FAIL'))console.log(c.id,c.error);process.exitCode=result.fail?1:0;
