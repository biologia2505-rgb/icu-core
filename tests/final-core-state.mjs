import {createEngine,source,gas,check,finish,encode} from './final-core-testkit.mjs';

const own=(object,key)=>Object.hasOwn(object,key);
const call=(e,name,...args)=>typeof e.context[name]==='function'?e.call(name,...args):undefined;
const report=e=>e.evaluate('lastReport');
const fresh=e=>call(e,'hasCurrentResult')===true;
const numeric=['pH','pCO2','HCO3in','SBE','Lac','pO2','FiO2','PEEP','Na','Cl','K','Ca','Mg','Alb','PO4','Gluc','Ur','Osm_in','Weight','RR','SpO2','SBP','DBP','HR','Temp','GCS','Age','Plt','WBC','Bands','Hct','Cr','Bil','Urine','baselineSOFA','AGupperLimit'];
const contexts=['infection','bilateral','timing','noncardiac','Vaso','O2support','Sex','ACVPU','chronic','anionSourceConfirmed','acuteRenalFailure','respiratorySupport','infectionRelatedOrganDysfunction','adequateResuscitation','vasopressorRequirement','sampleSimultaneity','gasSampleType','chronicHealth','surgicalContext'];
const valid=gas(24,40,{chronicHealth:'no',surgicalContext:'unknown',Vaso:'none',O2support:'no',Sex:'M',ACVPU:'A',news2Scale:'1',notes:''});

// Fill patient A, then restore a sparse old patient B. No omitted patient value may survive.
{
 const e=createEngine();const extreme={...valid,Alb:20,Ur:40,pO2:30,Plt:15,Bil:250,Cr:600,GCS:6,infection:'yes',bilateral:'yes',timing:'yes',noncardiac:'yes',Vaso:'norepi_high',O2support:'yes',Sex:'F',Age:80,ACVPU:'U',notes:'patient A',chronic:'chronic',chronicity:'chronic',anionSourceConfirmed:'yes',acuteRenalFailure:'yes',respiratorySupport:'yes',baselineSOFA:9,infectionRelatedOrganDysfunction:'yes',adequateResuscitation:'yes',vasopressorRequirement:'yes',sampleSimultaneity:'yes',gasSampleType:'arterial',AGupperLimit:18,news2Scale:'2',chronicHealth:'yes',surgicalContext:'elective',naSolution:'10',kSolution:'10'};
 e.input(extreme);e.run();const sparse={data:{pH:7.4,pCO2:40,HCO3in:24,SBE:0,Na:140,Cl:103,K:4,Lac:1,Gluc:5.5}};
 e.call('saveHistory',sparse);e.call('loadHistory',0);const d=e.read();
 for(const id of numeric.filter(id=>!own(sparse.data,id))){const key=id==='SBE'?'SBE_input':id;check('HIST-01-clear-numeric-'+id,'HIST-01',{patientA:extreme,patientB:sparse},{missing:true},{missing:Number.isNaN(d[key])});}
 for(const id of contexts)check('HIST-01-clear-context-'+id,'HIST-01',{patientA:extreme,patientB:sparse},{value:'unknown'},{value:d[id]});
 check('HIST-01-clear-notes','HIST-01',{patientA:extreme,patientB:sparse},{notes:''},{notes:d.notes});
 check('HIST-01-neutral-profiles','HIST-01',sparse,{news2Scale:'1',naSolution:'0.9',kSolution:'4'},{news2Scale:d.news2Scale,naSolution:d.naSolution,kSolution:d.kSolution});
}

// JSON null is intentional: it round-trips to an empty input / NaN, never 0 or string "null".
{
 const e=createEngine();e.input({...valid,Alb:NaN,Ur:NaN,pO2:NaN,baselineSOFA:NaN,AGupperLimit:NaN,notes:'missing preserved'});const d=e.read();const record=e.call('makeHistory',d,{title:'missing test',detail:''});
 check('HIST-01-explicit-missing-serialization','HIST-01',d,{Alb:null,Ur:null,pO2:null,baselineSOFA:null,AGupperLimit:null},{Alb:record.data.Alb,Ur:record.data.Ur,pO2:record.data.pO2,baselineSOFA:record.baselineSOFA,AGupperLimit:record.AGupperLimit});
 e.call('saveHistory',record);const independent=createEngine({storage:new Map(e.storage)});independent.input({...valid,Alb:40,Ur:5,pO2:90,baselineSOFA:0,AGupperLimit:14});independent.call('loadHistory',0);const restored=independent.read();
 check('HIST-01-independent-null-reload','HIST-01',record,{Alb:true,Ur:true,pO2:true,baselineSOFA:true,AGupperLimit:true},{Alb:Number.isNaN(restored.Alb),Ur:Number.isNaN(restored.Ur),pO2:Number.isNaN(restored.pO2),baselineSOFA:Number.isNaN(restored.baselineSOFA),AGupperLimit:Number.isNaN(restored.AGupperLimit)});
}

// Explicit clinical selectors and solutions survive a fresh VM, not only the current form.
for(const news2Scale of ['1','2'])for(const chronicHealth of ['yes','no','unknown'])for(const surgicalContext of ['non-operative','emergency','elective','unknown']){
 const input={...valid,news2Scale,chronicHealth,surgicalContext,Vaso:'dobutamine',O2support:'yes',respiratorySupport:'yes',chronic:'chronic',chronicity:'chronic',sampleSimultaneity:'no',gasSampleType:'venous',Na:130,K:3,naSolution:'3',kSolution:'7.5',notes:'clinician chosen context'};
 const e=createEngine();e.input(input);e.call('runCalculation',true);const before=e.compute(e.read()),beforeFields=e.read(),beforeReport=report(e),saved=e.call('getHistory')[0];
 e.input({...valid,news2Scale:news2Scale==='1'?'2':'1',chronicHealth:'no',surgicalContext:'unknown',Vaso:'none',O2support:'no',respiratorySupport:'no',chronic:'acute',chronicity:'acute',sampleSimultaneity:'yes',gasSampleType:'arterial',Na:155,K:5,naSolution:'0.9',kSolution:'4',notes:'mutated next patient'});e.run();e.call('loadHistory',0);e.run();
 check('STATE-full-pipeline-results-'+news2Scale+'-'+chronicHealth+'-'+surgicalContext,['HIST-01','HIST-02','SC-06','SC-08','SC-09','OX-01','UI-04'],{input,mutate:'next patient then history load and calculate'},before,e.compute(e.read()),'Metamorphic persistence check: complete numerical, composition, QC, scales, sepsis and balance outputs must remain identical after save/mutate/reload/calculate.');
 check('STATE-full-pipeline-fields-report-'+news2Scale+'-'+chronicHealth+'-'+surgicalContext,['HIST-01','HIST-02','SC-06','SC-08','SC-09','OX-01','UI-04'],input,{fields:beforeFields,report:beforeReport,fresh:true},{fields:e.read(),report:report(e),fresh:fresh(e)});
 const reload=createEngine({storage:new Map(e.storage)});reload.call('loadHistory',0);reload.run();const actual=reload.read();const keys=['news2Scale','chronicHealth','surgicalContext','Vaso','O2support','respiratorySupport','chronic','chronicity','sampleSimultaneity','gasSampleType','naSolution','kSolution','notes'];
 check('STATE-independent-context-'+news2Scale+'-'+chronicHealth+'-'+surgicalContext,['HIST-01','HIST-02','SC-06','SC-08','SC-09'],input,Object.fromEntries(keys.map(k=>[k,input[k]])),Object.fromEntries(keys.map(k=>[k,actual[k]])));
 check('STATE-independent-full-results-'+news2Scale+'-'+chronicHealth+'-'+surgicalContext,['HIST-01','HIST-02','SC-06','SC-08','SC-09','OX-01','UI-04'],saved,{results:before,fields:beforeFields,report:beforeReport,fresh:true},{results:reload.compute(actual),fields:actual,report:report(reload),fresh:fresh(reload)},'Fresh VM reuses only serialized storage; no previous form or calculation state is shared.');
 const news=reload.compute(actual).scales[0],sofa=reload.compute(actual).scales[3],apache=reload.compute(actual).scales[4];
 const expectedChronic=chronicHealth==='no'?0:chronicHealth==='yes'&&surgicalContext==='elective'?2:chronicHealth==='yes'&&['non-operative','emergency'].includes(surgicalContext)?5:null;
 check('STATE-restored-context-used-by-scores-'+news2Scale+'-'+chronicHealth+'-'+surgicalContext,['SC-06','SC-08','SC-09','OX-01'],input,{news2Scale,spo:news2Scale==='1'?0:3,cv:2,chronic:expectedChronic,sofaOxygenAvailable:false,apacheOxygenAvailable:false},{news2Scale:news.news2Scale,spo:news.items.find(i=>i.name==='SpO2').score,cv:sofa.items.find(i=>i.name==='ССС').score,chronic:apache.items.find(i=>i.name==='Хроническое').score,sofaOxygenAvailable:sofa.items.find(i=>i.name==='PaO₂/FiO₂').available,apacheOxygenAvailable:apache.items.find(i=>i.name==='Оксигенация').available});
}

// Unknown context and missing optional quantities retain both their values and their downstream availability.
for(const [name,changes]of [
 ['unknown-context',{chronic:'unknown',chronicity:'unknown',chronicHealth:'unknown',surgicalContext:'unknown',Vaso:'unknown',O2support:'unknown',Sex:'unknown',ACVPU:'unknown',sampleSimultaneity:'unknown',gasSampleType:'unknown',respiratorySupport:'unknown',infection:'unknown',baselineSOFA:NaN}],
 ['missing-albumin-urea',{Alb:NaN,Ur:NaN}],
 ['missing-oxygen',{pO2:NaN,FiO2:NaN,PEEP:NaN}],
 ['missing-scores',{Plt:NaN,Bil:NaN,GCS:NaN,Cr:NaN,Urine:NaN,Age:NaN}],
 ['missing-weight',{Weight:NaN}],
 ['unknown-ARF',{acuteRenalFailure:'unknown',Cr:200}]
]){
 const input={...valid,...changes},e=createEngine();e.input(input);e.call('runCalculation',true);const expected={fields:e.read(),results:e.compute(e.read()),report:report(e),fresh:true};
 e.input(valid);e.run();e.call('loadHistory',0);e.run();check('STATE-missing-unknown-full-pipeline-'+name,['HIST-01','HIST-02'],input,expected,{fields:e.read(),results:e.compute(e.read()),report:report(e),fresh:fresh(e)});
 const independent=createEngine({storage:new Map(e.storage)});independent.call('loadHistory',0);independent.run();check('STATE-missing-unknown-independent-results-'+name,['HIST-01','HIST-02'],input,expected,{fields:independent.read(),results:independent.compute(independent.read()),report:report(independent),fresh:fresh(independent)});
}

for(const oldValue of ['mild','severe']){
 const e=createEngine();e.input(valid);const old={data:{...Object.fromEntries(numeric.filter(k=>k!=='baselineSOFA'&&k!=='AGupperLimit').map(k=>[k,k==='SBE'?valid.SBE_input:valid[k]]))},Chronic:oldValue};e.call('saveHistory',old);e.call('loadHistory',0);let d=e.read();
 check('SC-08-legacy-'+oldValue,['HIST-01','SC-08'],old,{chronicHealth:'unknown',review:true,oldValue},{chronicHealth:d.chronicHealth,review:d.legacyApacheReview,oldValue:d.legacyApacheChronicValue});
 const record=e.call('makeHistory',d,{title:'legacy',detail:''});e.call('saveHistory',record);const independent=createEngine({storage:new Map(e.storage)});independent.call('loadHistory',0);d=independent.read();
 check('SC-08-legacy-review-survives-independent-reload-'+oldValue,['HIST-01','SC-08'],record,{review:true,oldValue},{review:d.legacyApacheReview,oldValue:d.legacyApacheChronicValue});
 independent.input({chronicHealth:'no'});call(independent,'patientInputChanged',{target:{id:'chronicHealth'}});d=independent.read();
 check('SC-08-explicit-clinician-review-'+oldValue,'SC-08',{chronicHealth:'no'},{chronicHealth:'no',review:false},{chronicHealth:d.chronicHealth,review:d.legacyApacheReview});
}

for(const [action,args]of [['clearAll',[]],['loadPreset',['4.5']]]){
 const e=createEngine();e.input({...valid,news2Scale:'2',chronicHealth:'yes',surgicalContext:'elective',naSolution:'3',kSolution:'7.5'});const holder=e.elements.get('chronicHealth');holder.dataset.legacyApacheReview='true';holder.dataset.legacyApacheChronicValue='severe';e.call(action,...args);const d=e.read();
 check('STATE-reset-new-selectors-'+action,['HIST-01','HIST-02','SC-06','SC-08'],{action,args,prior:{news2Scale:'2',chronicHealth:'yes',surgicalContext:'elective',naSolution:'3',kSolution:'7.5',legacyApacheReview:true}},{news2Scale:'1',chronicHealth:'unknown',surgicalContext:'unknown',naSolution:'0.9',kSolution:'4',legacyApacheReview:false,legacyApacheChronicValue:''},{news2Scale:d.news2Scale,chronicHealth:d.chronicHealth,surgicalContext:d.surgicalContext,naSolution:d.naSolution,kSolution:d.kSolution,legacyApacheReview:d.legacyApacheReview,legacyApacheChronicValue:d.legacyApacheChronicValue});
}

{
 const e=createEngine();const input={...valid,Na:130,K:3,Weight:70,Age:30,Sex:'M',naSolution:'3',kSolution:'7.5'};e.input(input);const before=e.call('calcBalance',e.read());e.call('saveHistory',e.call('makeHistory',e.read(),{title:'balance',detail:''}));e.input({naSolution:'0.9',kSolution:'4'});e.call('loadHistory',0);const restored=e.read(),after=e.call('calcBalance',restored);
 check('HIST-02-volume-solution-invariance','HIST-02',input,{naSolution:'3',kSolution:'7.5',naVolume:before.naVolume,kVolume:before.kVolume},{naSolution:restored.naSolution,kSolution:restored.kSolution,naVolume:after.naVolume,kVolume:after.kVolume});
 const independent=createEngine({storage:new Map(e.storage)});independent.call('loadHistory',0);const second=independent.call('calcBalance',independent.read());
 check('HIST-02-fresh-VM-volume-invariance','HIST-02',input,{naVolume:before.naVolume,kVolume:before.kVolume},{naVolume:second.naVolume,kVolume:second.kVolume});
 e.input({naSolution:'0.9',kSolution:'4'});const direct=e.call('calcBalance',{...restored,naSolution:'3',kSolution:'7.5'});
 check('HIST-02-calculation-state-not-DOM','HIST-02',restored,{naVolume:before.naVolume,kVolume:before.kVolume},{naVolume:direct.naVolume,kVolume:direct.kVolume});
}

// Browser events are not needed for the export fingerprint guard: programmatic input mutation is checked too.
for(const [field,value]of [['Na',NaN],['Cl',NaN],['pH',NaN],['Na',141],['notes','different patient context'],['naSolution','3'],['news2Scale','2'],['chronic','acute']]){
 const e=createEngine();e.input(valid);e.run();const hadReport=Boolean(report(e));const originalFresh=fresh(e),clipboard=[],shares=[];e.context.navigator.clipboard={writeText:async text=>clipboard.push(text)};e.context.navigator.share=async payload=>shares.push(payload);e.input({[field]:value});const changedFingerprintFresh=fresh(e);e.call('copyResult');e.call('shareResult');await Promise.resolve();
 check('HIST-03-export-rejects-changed-'+field,'HIST-03',{initial:valid,changed:{[field]:value}},{hadReport:true,originalFresh:true,changedFingerprintFresh:false,copies:0,shares:0,reportCleared:true},{hadReport,originalFresh,changedFingerprintFresh,copies:clipboard.length,shares:shares.length,reportCleared:!report(e)});
}
for(const field of ['Na','Cl','pH']){
 const e=createEngine();e.input(valid);e.run();e.input({[field]:NaN});e.run();
 check('HIST-03-invalid-calculation-clears-'+field,'HIST-03',{[field]:NaN},{reportCleared:true,fresh:false,dashboardStale:true},{reportCleared:!report(e),fresh:fresh(e),dashboardStale:e.text('dash-syn-title').includes('не актуален')});
}
{
 const e=createEngine();e.input(valid);e.run();call(e,'patientInputChanged',{target:{id:'notes'}});
 check('HIST-03-event-invalidates-current-result','HIST-03',{event:'input',target:'notes'},{reportCleared:true,fresh:false},{reportCleared:!report(e),fresh:fresh(e)});
 const inputCapture=/document\.addEventListener\(\s*["']input["']\s*,\s*patientInputChanged\s*,\s*true\s*\)/.test(source),changeCapture=/document\.addEventListener\(\s*["']change["']\s*,\s*patientInputChanged\s*,\s*true\s*\)/.test(source);
 check('HIST-03-capture-handlers-before-inline-preview','HIST-03',{requiredEvents:['input','change']},{inputCapture:true,changeCapture:true},{inputCapture,changeCapture});
}
{
 const e=createEngine();e.input(valid);e.run();const copies=[],shares=[];e.context.navigator.clipboard={writeText:async text=>copies.push(text)};e.context.navigator.share=async data=>shares.push(data);const expected=report(e);e.call('copyResult');e.call('shareResult');await Promise.resolve();
 check('HIST-03-current-report-export-positive-control','HIST-03',valid,{copies:[expected],shares:[{title:'ICU CORE',text:expected}]},{copies,shares});
}
{
 const e=createEngine();e.input(valid);e.run();let rejectCopy;let fallbackCopies=0;e.context.navigator.clipboard={writeText:()=>new Promise((_,reject)=>{rejectCopy=reject;})};e.document.execCommand=()=>{fallbackCopies++;return true;};e.call('copyResult');e.input({notes:'later patient'});rejectCopy(new Error('clipboard unavailable'));await Promise.resolve();await Promise.resolve();
 check('HIST-03-async-fallback-cannot-export-previous-input','HIST-03',{action:'clipboard rejection after input changes'},{fallbackCopies:0},{fallbackCopies});
}
finish('final-core-state');
