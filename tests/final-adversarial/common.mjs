import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {createEngine,sourceHash,source} from '../adapter/icu-html.mjs';
export {createEngine,sourceHash,source};
export const auditRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../reports');
// Current patch executes preserved probes; before source and old expected remain immutable in reference/final-core-baseline/adversarial.
export const base={...createEngine().read(),Age:30,acuteRenalFailure:'no',baselineSOFA:0,gasSampleType:'arterial',sampleSimultaneity:'yes',chronic:'unknown',chronicity:'unknown'};
export const basis={policy:'User-approved ICU CORE policies (reference/RESPIRATORY_RANGE_POLICY_APPROVED.md, METABOLIC_ALKALOSIS_COMPENSATION_POLICY_APPROVED.md, HAGMA_confidence_update_2026-10-08.md, QC_thresholds_approved_2026-10-08.md) and final adversarial audit requirements',sofa:'https://pmc.ncbi.nlm.nih.gov/articles/PMC4968574/#T1',sepsis:'https://pmc.ncbi.nlm.nih.gov/articles/PMC4968574/',news:'https://www.rcp.ac.uk/media/a4ibkkbf/news2-final-report_0_0.pdf',apache:'https://www.ncbi.nlm.nih.gov/books/n/ukeme0810/pdf/',berlin:'https://jamanetwork.com/journals/jama/article-abstract/1160659',math:'Independent arithmetic from explicit ICU CORE version30.1 formula profile; no alternative formula treated as a defect',history:'User requirement10: clinical context must preserve meaning; unknown/missing must not become false/0 or another patient value'};
export function gas(h,co,x={}){const pH=6.1+Math.log10(h/(.03*co));return{...base,HCO3in:h,pCO2:co,pH,SBE_input:h-24.4+16.2*(pH-7.4),...x};}
export function engine(d){const e=createEngine();e.input(d);return e;}
export const encode=v=>JSON.parse(JSON.stringify(v,(_,x)=>x===undefined?{$missing:true}:typeof x==='number'&&!Number.isFinite(x)?{$number:String(x)}:x));
export const cases=[];
export function check(id,area,input,expected,actual,defectIds=[],clinicalBasis=basis.policy,note='',mode='exact'){
 const close=(a,b)=> typeof a==='number'&&typeof b==='number'&&Number.isFinite(a)&&Number.isFinite(b)?Math.abs(a-b)<=1e-10*Math.max(1,Math.abs(b)):JSON.stringify(encode(a))===JSON.stringify(encode(b));
 const ok=mode==='approx'?Object.keys(expected).every(k=>close(actual[k],expected[k])):JSON.stringify(encode(actual))===JSON.stringify(encode(expected));
 cases.push({id,area,input:encode(input),expected:encode(expected),actual:encode(actual),status:mode==='review'?'REVIEW':ok?'PASS':'FAIL',defectIds:ok?[]:defectIds,basis:clinicalBasis,note});
}
export function record(id,area,input,expected,actual,clinicalBasis,note){cases.push({id,area,input:encode(input),expected,actual:encode(actual),status:'REVIEW',defectIds:[],basis:clinicalBasis,note});}
export const score=(s,n)=>s.items.find(i=>i.name===n)?.score;
export const fp=x=>Number.EPSILON*Math.max(1,Math.abs(x));
export function finish(name){const counts={};for(const c of cases)counts[c.status]=(counts[c.status]||0)+1;const out={sourceSHA256:sourceHash,caseCount:cases.length,counts,cases};fs.writeFileSync(path.join(auditRoot,'final-adversarial-raw-'+name+'.json'),JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({matrix:name,...counts,cases:cases.length}));}
