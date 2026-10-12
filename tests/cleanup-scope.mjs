import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {root,createEngine,sourceHash,source,check,finish,encode} from './final-core-testkit.mjs';import {capture300} from './final-core-capture.mjs';
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const baselineFolder=path.join(root,'reference/zero-review-baseline');check('before-c44-SHA','CLEANUP-SCOPE',null,'c44d705c94bb8669dd49ea1e7da1624be18ee5db127d42d3f84f140e34a14eda',sha(path.join(baselineFolder,'index.html')));
const saved=process.env.ICU_SOURCE;process.env.ICU_SOURCE=path.join(baselineFolder,'index.html');const old=await import('./adapter/icu-html.mjs?zero-scope');if(saved===undefined)delete process.env.ICU_SOURCE;else process.env.ICU_SOURCE=saved;const before=old.createEngine(),now=createEngine();
const allowed=['detectPrimary','phCompensation','deltaDeltaApplicable','updateDash','liveValidate','clinicalQC','calcAPACHE2','clearAll','loadPreset','runCalculation','render','renderFinal','markResultStale'];
for(const n of old.functionNames)if(!allowed.includes(n))check('unchanged-function-'+n,'CLEANUP-SCOPE',null,before.evaluate(n+'.toString()'),now.evaluate(n+'.toString()'));
for(const n of ['detectPrimary','phCompensation','deltaDeltaApplicable'])check('representation-only-change-'+n,'CLEANUP-SCOPE',null,before.evaluate(n+'.toString()'),now.evaluate(n+'.toString()').replaceAll('normalisePHBoundary(d.pH)','d.pH'));
check('SBE-specific-logic-unmodified','CLEANUP-SCOPE',null,before.evaluate('detectHAGMA.toString()'),now.evaluate('detectHAGMA.toString()'));
const newNames=source.match(/^function (\w+)\(/gm).map(s=>s.slice(9,-1)).filter(n=>!old.functionNames.includes(n));check('only-approved-new-helpers','CLEANUP-SCOPE',null,['normalisePHBoundary','calcEGFR','egfrDisplay','resetPatientFormToDefaults'],newNames);
const style=s=>[...s.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
// Preserve every existing CSS rule outside the explicitly approved hero/grid/workflow/footer edits.
const exempt=/^\.hero-(side|signal)(:hover| [bi]| span)?$|^html\[data-theme="dark"\] \.hero-signal(?: [bi]| span)?$|^\.hero-content$|^\.elegant-hero$|^\.dash-grid$|^\.dash-grid>#tile-eGFR$|^\.workflow-card p$|^\.patient-actions$|^body$/;
const cssContract=s=>[...style(s).matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m=>({selector:m[1].replace(/\/\*[\s\S]*?\*\//g,'').trim(),body:m[2]})).filter(x=>!exempt.test(x.selector));
check('UI-preserves-palette-fonts-radii-shadows-other-CSS','CLEANUP-SCOPE',null,cssContract(old.source),cssContract(source));
const current=capture300(),previous=JSON.parse(fs.readFileSync(path.join(baselineFolder,'outputs-300.json')));const changes=[];
const clinical=r=>encode({processes:r.ui.syn.processes,possibleProcesses:r.ui.syn.possibleProcesses,title:r.ui.syn.title,primary:r.ui.p,delta:r.ui.dd,hagma:r.ui.h,scales:r.ui.scales.map(({applicable,...s})=>s),sepsis:r.ui.sepsis,math:r.ui.b,stewart:r.ui.st,waterElectrolytes:r.ui.bal});
for(let i=0;i<300;i++){const b=previous.cases[i],a=current[i],x=clinical(b),y=clinical(a);check('zero-cleanup-300-'+b.id,'ZERO-CLEANUP-300',null,x,y);if(JSON.stringify(x)!==JSON.stringify(y))changes.push({id:b.id,number:b.number,before:x,after:y});}
fs.writeFileSync(path.join(root,'reports/cleanup-before-after-300.json'),JSON.stringify({summary:{sourceHash,beforeSHA:previous.sourceSHA256,cases:300,pass:300-changes.length,fail:changes.length,compositionChangedCases:changes.length},changes,approvedMetadataChange:'APACHE applicable=true for existing adult cases; no score/clinical change'},null,2)+'\n');
const resolutions=JSON.parse(fs.readFileSync(path.join(baselineFolder,'approved-resolutions.json')));check('all12-review-resolutions-documented','CLEANUP-SCOPE',null,12,resolutions.length);check('no-resolution-active-review','CLEANUP-SCOPE',null,false,resolutions.some(r=>r.remainReview));
finish('cleanup-scope');
