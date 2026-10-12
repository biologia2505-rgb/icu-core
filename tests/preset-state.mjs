import fs from 'node:fs';
import path from 'node:path';
import {createEngine,check,finish,root,encode} from './final-core-testkit.mjs';
const saved=process.env.ICU_SOURCE;process.env.ICU_SOURCE=path.join(root,'reference/zero-review-baseline/index.html');const old=await import('./adapter/icu-html.mjs?canonical-preset-before');if(saved===undefined)delete process.env.ICU_SOURCE;else process.env.ICU_SOURCE=saved;
const before=old.createEngine();before.call('clearAll');const defaultFields=Object.fromEntries([...before.elements].filter(([k,v])=>['INPUT','SELECT','TEXTAREA'].includes(v.tagName)).map(([k,v])=>[k,String(v.value)]));const presets=before.evaluate('presets');
for(const name of ['4.5','4.6','4.8','4.9','d-lactate','dka'])for(const mode of ['same','fresh']){
 const e=createEngine();e.call('applyThemeMode','dark',true);
 for(const [k,value]of Object.entries(defaultFields)){const el=e.elements.get(k);el.value=el.tagName==='SELECT'?el.options.find(x=>x!==value)??value:k==='notes'?'patient A extreme':String(300+Object.keys(defaultFields).indexOf(k));}
 e.input({Plt:9,Bil:150,Cr:700,GCS:3,Age:90,RR:45,SBP:65,DBP:30,infection:'yes',Vaso:'norepi_high',chronicHealth:'yes',surgicalContext:'emergency',news2Scale:'2',gasSampleType:'venous',naSolution:'10',kSolution:'10',chronic:'chronic',anionSourceConfirmed:'yes',notes:'patient A extreme',baselineSOFA:24});
 e.elements.get('chronicHealth').dataset.legacyApacheReview='true';e.elements.get('chronicHealth').dataset.legacyApacheChronicValue='severe';
 // Same VM remains dirty; fresh VM is an independent normal invocation.
 const target=mode==='same'?e:createEngine();if(mode==='fresh')target.call('applyThemeMode','dark',true);
 target.call('loadPreset',name);
 const expected={...defaultFields,...Object.fromEntries(Object.entries(presets[name]).map(([k,v])=>[k,String(v)]))};
 for(const [k,value]of Object.entries(expected))check(`preset-${name}-${mode}-${k}`,'PRESET-STATE',null,value,String(target.elements.get(k).value));
 check(`preset-${name}-${mode}-theme`,'PRESET-STATE',null,'dark',target.document.documentElement.getAttribute('data-theme'));
 check(`preset-${name}-${mode}-legacy`,'PRESET-STATE',null,{legacyApacheReview:'false',legacyApacheChronicValue:''},target.elements.get('chronicHealth').dataset);
 check(`preset-${name}-${mode}-fresh-calculation`,'PRESET-STATE',null,true,target.call('hasCurrentResult'));
 check(`preset-${name}-${mode}-no-errors`,'PRESET-STATE',null,[],target.errors);
}
const cleared=createEngine();cleared.input({Cr:900,notes:'patient A'});cleared.call('clearAll');for(const [k,v]of Object.entries(defaultFields))check('clear-canonical-'+k,'PRESET-STATE',null,v,String(cleared.elements.get(k).value));
finish('preset-state');
