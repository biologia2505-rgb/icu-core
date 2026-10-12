import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {root,sourceHash,createEngine} from './adapter/icu-html.mjs';
const saved=process.env.ICU_SOURCE;process.env.ICU_SOURCE=path.join(root,'reference/final-core-baseline/index.html');
const beforeAdapter=await import('./adapter/icu-html.mjs?final-core-math-before');
if(saved===undefined)delete process.env.ICU_SOURCE;else process.env.ICU_SOURCE=saved;
const prior=beforeAdapter.createEngine(),current=createEngine();
if(beforeAdapter.sourceHash!=='b1e7d49af5a211f3a6e25f587b99424719b1960327f245209573c317ce877a3f')throw Error('Final-core math before source SHA differs');
const originalPath=path.join(root,'reference/clinical-scenarios-original.json');
const scenarios=JSON.parse(fs.readFileSync(originalPath)),f265=JSON.parse(fs.readFileSync(path.join(root,'tests/cases-265.json'))),f35=JSON.parse(fs.readFileSync(path.join(root,'tests/cases-35.json')));
const oracles=new Map([...f265.map(f=>[f.originalNumber,{math:f.mathExpected,qc:f.qcExpected}]),...f35.map(f=>[f.number,{math:f.math,qc:f.qcCodes}])]);
const historicalPath=path.join(root,'reference/numerical-before-300.json');
const hashFile=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const enc=v=>JSON.parse(JSON.stringify(v,(_,x)=>typeof x==='number'&&!Number.isFinite(x)?{$number:String(x)}:x));
const body=(e,n)=>e.evaluate(n+'.toString()');
const checks=[],rows=[];
const integrity=(label,actual,expected)=>checks.push({label,status:JSON.stringify(enc(actual))===JSON.stringify(enc(expected))?'PASS':'FAIL',actual:enc(actual),expected:enc(expected)});
// Approved patch changes availability/context/composition/scoring. Whole vectors
// containing these semantics are no longer a mathematical freeze. Old vectors,
// historical capture, independent numerical oracle, and old harness remain intact.
for(const n of ['calcStewart','getTBWCoeff','respiratoryCompensationRange'])integrity(n+' full mathematical body unchanged',body(current,n),body(prior,n));
const declaration=(text,name)=>{const match=text.match(new RegExp('(?:const|let)\\s+'+name+'=([^;]+);'));return match?.[1]??null;};
const basicNames=['HCO3calc','HCO3','AG','AGcorr','Na_measured','Na_glucose','AG_Na_corr','AG_Kellum','deltaAG','deltaHCO3','deltaDelta','SBE_calc','SBE','Alb','SBE_FW','SBE_Cl','SBE_Alb','SBE_UA','Osm_calc','Osm_gap'];
for(const name of basicNames){const b=declaration(body(prior,'calcBasic'),name),a=declaration(body(current,'calcBasic'),name);integrity('calcBasic '+name+' formula unchanged',a,b);integrity('calcBasic '+name+' formula captured',a!==null,true);}
for(const expression of ['d.Na+1.6*((d.Gluc-5.5)/5.5)','d.pO2/(d.FiO2/100)','d.FiO2/100*713-d.pCO2/0.8-d.pO2'])integrity('calcBasic frozen arithmetic '+expression,body(current,'calcBasic').includes(expression)&&body(prior,'calcBasic').includes(expression),true);
for(const expression of ['1.5*b.HCO3+8-2','1.5*b.HCO3+8+2','0.7*b.HCO3+21-2','0.7*b.HCO3+21+2'])integrity('compensation frozen arithmetic '+expression,body(current,'compensation').includes(expression)&&body(prior,'compensation').includes(expression),true);
for(const expression of ['dd<0.4','dd<0.9','dd<=1.5','dd<=2'])integrity('delta categories unchanged '+expression,body(current,'calcDeltaDelta').includes(expression)&&body(prior,'calcDeltaDelta').includes(expression),true);
for(const expression of ['tbwCoef*W*(d.Na-naTarget)/naTarget','tbwCoef*W*(naTarget-d.Na)','W*0.4*(kTarget-d.K)','W*0.5*(clTarget-d.Cl)','res.naDeficit/res.naSol.perMl','res.kDeficit/res.kSol.perMl'])integrity('balance arithmetic unchanged '+expression,body(current,'calcBalance').includes(expression)&&body(prior,'calcBalance').includes(expression),true);
for(const expression of ['b.HCO3<22&&b.SBE_calc<-2','d.Lac>2','d.anionSourceConfirmed==="yes"'])integrity('HAGMA evidence trigger unchanged '+expression,body(current,'detectHAGMA').includes(expression)&&body(prior,'detectHAGMA').includes(expression),true);
const deltaBody=body(current,'deltaDeltaApplicable'),beforeDelta=body(prior,'deltaDeltaApplicable');integrity('delta applicability unchanged except approved pH representation guard',deltaBody.replaceAll('normalisePHBoundary(d.pH)','d.pH'),beforeDelta);
integrity('original300 SHA unchanged',hashFile(originalPath),'1df00b47246a194bad3db4226b2bba74175c0e88082956d85cca369a4efe0791');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'reference/final-core-baseline/original-manifest.json')));
const files=manifest.files??manifest;for(const file of ['tests/cases-265.json','tests/cases-35.json','tests/clinical-contracts-300.json','reference/numerical-before-300.json']){const expected=files[file]?.sha256??files[file];if(typeof expected==='string')integrity('immutable independent oracle '+file,hashFile(path.join(root,file)),expected);else integrity('immutable independent oracle '+file+' manifest entry',false,true);}
for(let i=0;i<scenarios.length;i++){
 const c=scenarios[i],d={...c.input,...c.context};for(const key of ['respiratorySupport','adequateResuscitation'])if(typeof d[key]==='boolean')d[key]=d[key]?'yes':'no';
 const e=createEngine(),be=beforeAdapter.createEngine();e.input(d,c.config);be.input(d,c.config);const r=e.compute(d),b=be.compute(d),oracle=oracles.get(i+1),caseChecks=[];
 const check=(label,actual,expected,tolerance=null)=>{const pass=tolerance===null?JSON.stringify(enc(actual))===JSON.stringify(enc(expected)):Number.isFinite(actual)&&Math.abs(actual-expected)<=tolerance;caseChecks.push({label,status:pass?'PASS':'FAIL',actual:enc(actual),expected:enc(expected),difference:tolerance!==null&&Number.isFinite(actual)?actual-expected:null,tolerance});};
 for(const[group,fields]of Object.entries(oracle.math))for(const[key,expected]of Object.entries(fields)){
  if(i+1===123&&group==='b'&&key==='deltaDelta'&&Number.isNaN(r.b.deltaDelta)&&Math.abs(expected)<1e-12){caseChecks.push({label:'b.deltaDelta',status:'ACCEPTED_NUMERIC_ARTIFACT',actual:enc(r.b.deltaDelta),expected,approval:'Preserved final300 accepted #123; ratio clinically inapplicable'});continue;}
  if(expected?.$number==='NaN')check(group+'.'+key,Number.isNaN(r[group][key]),true);else check(group+'.'+key,r[group][key],expected,1e-6+1e-9*Math.abs(expected));
 }
 // Same current adapter/runtime on preserved source gives a comparable exact
 // before vector. Only numerical outputs are selected; acuity/availability,
 // score metadata and report text are tested in separate approved-policy suites.
 const numeric=x=>Object.fromEntries(['b','st','bal'].map(group=>[group,Object.fromEntries(Object.entries(x[group]).filter(([_,v])=>typeof v==='number'))]));
 const vector=enc(numeric(r)),beforeVector=enc(numeric(b));check('all numerical core fields equal same-harness before',vector,beforeVector);
 rows.push({number:i+1,id:c.id,status:caseChecks.some(x=>x.status==='FAIL')?'FAIL':'PASS',vector,beforeVector,checks:caseChecks});
}
const summary={cases:300,pass:rows.filter(r=>r.status==='PASS').length,fail:rows.filter(r=>r.status==='FAIL').length,checks:rows.reduce((n,r)=>n+r.checks.length,checks.length),frozenFunctionPass:checks.filter(c=>c.status==='PASS').length,frozenFunctionFail:checks.filter(c=>c.status==='FAIL').length,acceptedNumericArtifacts:rows.flatMap(r=>r.checks).filter(c=>c.status==='ACCEPTED_NUMERIC_ARTIFACT').length,sourceHash,datasetSHA:hashFile(originalPath),comparableBaseline:'reference/final-core-baseline/index.html (same current adapter/runtime)',historicalBaseline:'reference/numerical-before-300.json'};
const report={summary,provenance:{schema:'final-core-scoped-math-freeze-v1',beforeSourceSHA256:beforeAdapter.sourceHash,historicalBaselineSHA256:hashFile(historicalPath),adapterSHA256:hashFile(path.join(root,'tests/adapter/icu-html.mjs')),nodeVersion:process.version,v8Version:process.versions.v8,approvedScope:'FINAL_CORE_SPEC_USER.md sections 15-17,33; no clinical/scoring output frozen as unchanged mathematics'},checks,rows};
fs.writeFileSync(path.join(root,'reports/math-freeze-300'+(process.env.ICU_REPORT_SUFFIX||'')+'.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(summary));for(const c of checks.filter(c=>c.status==='FAIL'))console.log(JSON.stringify(c));for(const r of rows.filter(r=>r.status==='FAIL'))console.log(JSON.stringify({number:r.number,failures:r.checks.filter(c=>c.status==='FAIL')}));process.exitCode=summary.fail||summary.frozenFunctionFail?1:0;
