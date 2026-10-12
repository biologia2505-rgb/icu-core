import fs from 'node:fs';
import path from 'node:path';
import {root} from './adapter/icu-html.mjs';
const file=path.join(root,'reference/FINAL_CORE_APPROVED_ASSERTIONS.json');
const ledger=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):[];
const v31Ledger=JSON.parse(fs.readFileSync(path.join(root,'tests/v31-approved-300-expectations.json')));
const encode=v=>JSON.parse(JSON.stringify(v,(_,x)=>x===undefined?{$undefined:true}:typeof x==='number'&&!Number.isFinite(x)?{$number:String(x)}:x));
function previousExpectation(suite,id,label,original){
 const v31=v31Ledger.find(x=>x.suite===suite&&x.id===id&&x.label===label);
 const entry=ledger.find(x=>x.suite===suite&&x.id===id&&x.label===label);
 if(v31){const previous=entry?entry.after:encode(original);if(JSON.stringify(previous)!==JSON.stringify(v31.before))throw Error('v31 amendment does not match retained v30 expectation: '+id+' / '+label);return{expected:v31.after,originalExpected:encode(original),v30Expected:previous,approval:v31};}
 if(!entry)return {expected:original};
 if(JSON.stringify(encode(original))!==JSON.stringify(entry.before))throw Error('Approved amendment does not match immutable original expectation: '+id+' / '+label);
 return {expected:entry.after,originalExpected:encode(original),approval:entry};
}

const contributorsLedger=JSON.parse(fs.readFileSync(path.join(root,'tests/v31-contributors-expectations.json')));
export function approvedExpectation(suite,id,label,original){
 const previous=previousExpectation(suite,id,label,original);
 const amendment=contributorsLedger.find(x=>x.suite===suite&&x.id===id&&x.label===label);
 if(!amendment)return previous;
 if(JSON.stringify(encode(previous.expected))!==JSON.stringify(amendment.before))throw Error('Contributor amendment does not match retained previous expectation: '+id+' / '+label);
 return{...previous,expected:amendment.after,previousV31Expected:encode(previous.expected),previousApproval:previous.approval,approval:amendment};
}
