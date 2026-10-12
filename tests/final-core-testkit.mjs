import fs from 'node:fs';
import path from 'node:path';
import {createEngine,sourceHash,source,root} from './adapter/icu-html.mjs';
export {createEngine,sourceHash,source,root};
export const encode=v=>JSON.parse(JSON.stringify(v,(_,x)=>x===undefined?{$undefined:true}:typeof x==='number'&&!Number.isFinite(x)?{$number:String(x)}:x));
export const base={...createEngine().read(),Age:30,Weight:70,acuteRenalFailure:'no',baselineSOFA:0,gasSampleType:'arterial',sampleSimultaneity:'yes',chronic:'unknown',chronicity:'unknown',Chronic:'none',chronicHealth:'no',surgicalContext:'unknown',news2Scale:'1'};
export function gas(h,co,x={}){const pH=6.1+Math.log10(h/(.03*co));return{...base,HCO3in:h,pCO2:co,pH,SBE_input:h-24.4+16.2*(pH-7.4),...x};}
export function engine(d,options){const e=createEngine(options);e.input(d);return e;}
export function score(s,n){return s.items.find(i=>i.name===n)?.score;}
export const cases=[];
export function check(id,defectId,input,expected,actual,note='',mode='exact'){
 const actualEncoded=encode(actual),expectedEncoded=encode(expected);
 const approx=(a,b)=>typeof a==='number'&&typeof b==='number'&&Number.isFinite(a)&&Number.isFinite(b)?Math.abs(a-b)<=1e-10*Math.max(1,Math.abs(b)):JSON.stringify(encode(a))===JSON.stringify(encode(b));
 const passed=mode==='approx'?Object.keys(expected).every(k=>approx(actual[k],expected[k])):JSON.stringify(actualEncoded)===JSON.stringify(expectedEncoded);
 const row={id,defectIds:Array.isArray(defectId)?defectId:[defectId],input:encode(input),expected:expectedEncoded,actual:actualEncoded,status:mode==='review'?'REVIEW':passed?'PASS':'FAIL',note};cases.push(row);return row;
}
export function finish(name){
 const summary={sourceHash,cases:cases.length,pass:cases.filter(c=>c.status==='PASS').length,fail:cases.filter(c=>c.status==='FAIL').length,review:cases.filter(c=>c.status==='REVIEW').length};
 const output={summary,cases};const folder=path.join(root,'reports');fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,name+'.json'),JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify({suite:name,...summary}));for(const c of cases.filter(c=>c.status==='FAIL'))console.log(JSON.stringify(c));process.exitCode=summary.fail?1:0;return output;
}
