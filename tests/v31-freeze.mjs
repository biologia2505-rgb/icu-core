import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {root,createEngine,source,sourceHash,functionNames} from './adapter/icu-html.mjs';
import {check,finish} from './final-core-testkit.mjs';
const saved=process.env.ICU_SOURCE;process.env.ICU_SOURCE=path.join(root,'reference/v30.1-index.html');
const old=await import('./adapter/icu-html.mjs?v31-frozen');
if(saved===undefined)delete process.env.ICU_SOURCE;else process.env.ICU_SOURCE=saved;
assert.equal(old.sourceHash,'48dd6fda126fe9e10501ef114f11ad8e8c1230d5b6b7ff6f2ba37efe1afa468c');
const before=old.createEngine(),now=createEngine();
const permitted=['compensation','calcDeltaDelta','clinicalQC','renderQC','syndrome','calcBalance','renderBalance','renderBalanceExplanations','renderFinal','updateDash','render','makeHistory','runCalculation'];
for(const n of old.functionNames)if(!permitted.includes(n))check('unchanged-function-'+n,'v31 scope',null,before.evaluate(n+'.toString()'),now.evaluate(n+'.toString()'));
check('legacy-compensation-arithmetic-preserved','v31 scope',null,before.evaluate('compensation.toString()'),now.evaluate('legacyCompensation.toString()').replace('function legacyCompensation(','function compensation('));
const added=functionNames.filter(n=>!old.functionNames.includes(n));
check('only-v31-new-helpers','v31 scope',null,['legacyCompensation','correctedBicarbonate','winterAssessment','synthesizeAcidBase','conditionalGasScenarios','clinicalProcessLabel'],added);
check('styles-unchanged','v31 scope',null,[...old.source.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/g)].map(x=>x[0]),[...source.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/g)].map(x=>x[0]));
check('dependencies-unchanged','v31 scope',null,old.source.match(/<script[^>]*src="[^"]+"/g),source.match(/<script[^>]*src="[^"]+"/g));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'reference/final-core-baseline/original-manifest.json')));
for(const file of ['tests/cases-265.json','tests/cases-35.json','tests/clinical-contracts-300.json','reference/numerical-before-300.json'])check('immutable-gold-'+file,'v31 scope',null,(manifest.files??manifest)[file].sha256??(manifest.files??manifest)[file],hash(file));
const scenarios=JSON.parse(fs.readFileSync(path.join(root,'reference/clinical-scenarios-original.json')));
const anchors=new Map([...JSON.parse(fs.readFileSync(path.join(root,'tests/cases-265.json'))).map(f=>[f.originalNumber,f.mathExpected]),...JSON.parse(fs.readFileSync(path.join(root,'tests/cases-35.json'))).map(f=>[f.number,f.math])]);
const rows=[];
for(let i=0;i<scenarios.length;i++){
 const c=scenarios[i],d={...c.input,...c.context};
 for(const key of ['respiratorySupport','adequateResuscitation'])if(typeof d[key]==='boolean')d[key]=d[key]?'yes':'no';
 const a=now.compute({...d,...c.config}),b=before.compute({...d,...c.config});
 const numeric=x=>Object.fromEntries(['b','st','bal'].map(g=>[g,Object.fromEntries(Object.entries(x[g]).filter(([k,v])=>typeof v==='number'&&!(g==='bal'&&k==='naVolume')))]));
 const fixture=anchors.get(i+1);let oracleChecks=0,oracleFailures=[];
 for(const [g,fields] of Object.entries(fixture))for(const [key,value] of Object.entries(fields)){
  if(g==='bal'&&key==='naVolume')continue;
  const actual=a[g][key];oracleChecks++;
  if(i===122&&g==='b'&&key==='deltaDelta'&&Math.abs(value)<1e-12&&Number.isNaN(actual))continue;
  if(value?.$number==='NaN'? !Number.isNaN(actual):!(Number.isFinite(actual)&&Math.abs(actual-value)<=1e-6+1e-9*Math.abs(value)))oracleFailures.push({g,key,actual,value});
 }
 check('case-'+c.id+'-all-frozen-numbers','v31 math 300',c.id,numeric(b),numeric(a));
 check('case-'+c.id+'-independent-oracle','v31 math 300',c.id,[],oracleFailures);
 check('case-'+c.id+'-scores-sepsis-egfr','v31 math 300',c.id,{scales:b.scales,sepsis:b.sepsis,egfr:before.call('calcEGFR',d)},{scales:a.scales,sepsis:a.sepsis,egfr:now.call('calcEGFR',d)});
 check('case-'+c.id+'-no-sodium-volume','v31 sodium P1',c.id,true,Number.isNaN(a.bal.naVolume));
 rows.push({id:c.id,number:i+1,oracleChecks,oracleFailures,removedSodiumVolume:Number.isNaN(a.bal.naVolume)});
}
fs.writeFileSync(path.join(root,'reports/v31-math-300.json'),JSON.stringify({sourceHash,baselineHash:old.sourceHash,cases:300,pass:rows.filter(x=>!x.oracleFailures.length).length,fail:rows.filter(x=>x.oracleFailures.length).length,independentOracleChecks:rows.reduce((n,r)=>n+r.oracleChecks,0),numericException:'Only bal.naVolume is deliberately removed (NaN), v31 rule 11. All other numerical fields are exactly equal to frozen v30.1 in the same runtime.',rows},null,2)+'\n');
finish('v31-freeze');
