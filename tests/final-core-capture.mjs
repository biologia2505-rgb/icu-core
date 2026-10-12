import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {root,createEngine,sourceHash,sourcePath} from './adapter/icu-html.mjs';
export const encode=v=>JSON.parse(JSON.stringify(v,(_,x)=>x===undefined?{$undefined:true}:typeof x==='number'&&!Number.isFinite(x)?{$number:String(x)}:x));
export function capture300(){
 const cases=JSON.parse(fs.readFileSync(path.join(root,'reference/clinical-scenarios-original.json')));
 return cases.map((c,i)=>{
  const d={...c.input,...c.context};
  for(const key of ['respiratorySupport','adequateResuscitation'])if(typeof d[key]==='boolean')d[key]=d[key]?'yes':'no';
  const e=createEngine();e.input(d,c.config);if(c.context.chronicity)e.input({chronic:c.context.chronicity});
  const direct=e.compute(d),formBefore=e.read();e.run();const form=e.read(),ui=e.compute(form),qc=e.call('clinicalQC',form,ui.b);
  return encode({number:i+1,id:c.id,input:d,config:c.config,formBefore,form,direct,ui,qc,report:e.evaluate('lastReport'),dashboard:Object.fromEntries([...e.elements.keys()].filter(k=>k.startsWith('tile')||k.startsWith('dash')||k==='riskBadge').map(k=>[k,e.text(k)])),history:e.call('makeHistory',form,ui.syn)});
 });
}
if(process.argv.includes('--capture-baseline')){
 const expected='b1e7d49af5a211f3a6e25f587b99424719b1960327f245209573c317ce877a3f';
 if(sourceHash!==expected)throw Error('Baseline capture refuses source SHA '+sourceHash);
 const file=path.join(root,'reference/final-core-baseline/outputs-300.json');
 if(fs.existsSync(file))throw Error('Refuses to overwrite before capture '+file);
 const cases=capture300();const out={schema:'final-core-before-300-v1',sourceSHA256:sourceHash,sourcePath,adapterSHA256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'tests/adapter/icu-html.mjs'))).digest('hex'),caseCount:cases.length,cases};
 fs.writeFileSync(file,JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({captured:cases.length,sourceHash,file}));
}
