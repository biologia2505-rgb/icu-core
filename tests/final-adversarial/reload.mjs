import {base,gas,createEngine,basis,check,encode,finish} from './common.mjs';
// Recreate the entire VM/DOM with serialized localStorage, rather than loading
// into the same form. This is functional reload coverage, not a native browser.
for(const chronicity of ['unknown','acute','chronic'])for(const flags of ['unknown','yes','no'])for(const sample of ['unknown','arterial','venous']){
 const d=gas(24,40,{chronicity,chronic:chronicity,anionSourceConfirmed:flags,acuteRenalFailure:flags,respiratorySupport:flags,infection:flags,infectionRelatedOrganDysfunction:flags,adequateResuscitation:flags,vasopressorRequirement:flags,sampleSimultaneity:flags,gasSampleType:sample});
 const storage=new Map(),first=createEngine({storage});first.input(d);first.run();const before=first.read(),result=first.compute(before);first.call('saveHistory',first.call('makeHistory',before,result.syn));
 const restarted=createEngine({storage:new Map([...storage.entries()])});restarted.call('loadHistory',0);const after=restarted.read(),other=restarted.compute(after);
 const fields=['chronicity','anionSourceConfirmed','acuteRenalFailure','respiratorySupport','infection','infectionRelatedOrganDysfunction','adequateResuscitation','vasopressorRequirement','sampleSimultaneity','gasSampleType'];
 check('RELOAD-context-'+chronicity+'-'+flags+'-'+sample,'10 fresh runtime / persisted context',d,{fieldsEqual:true,resultsEqual:true},{fieldsEqual:fields.every(k=>before[k]===after[k]),resultsEqual:JSON.stringify(encode({p:result.p,ards:result.ards,sepsis:result.sepsis}))===JSON.stringify(encode({p:other.p,ards:other.ards,sepsis:other.sepsis}))},[],basis.history,'Two independent VM/DOM instances share only serialized persisted storage.');
}
for(const field of ['Alb','Ur','Osm_in','baselineSOFA','AGupperLimit']){
 const d={...base,[field]:NaN},storage=new Map(),first=createEngine({storage});first.input(d);first.run();const before=first.read();first.call('saveHistory',first.call('makeHistory',before,first.compute(before).syn));
 const restarted=createEngine({storage:new Map([...storage.entries()])});restarted.call('loadHistory',0);
 check('RELOAD-missing-'+field,'10 fresh runtime / missing input',d,{unknown:true},{unknown:Number.isNaN(restarted.read()[field])},[],basis.history,'JSON null from missing numeric input must stay unavailable after fresh runtime reload.');
}
{
 const storage=new Map(),first=createEngine({storage});first.input({...base,Na:130,K:3,naSolution:'3',kSolution:'7.5'});first.run();const before=first.read(),bal=first.compute(before).bal;first.call('saveHistory',first.call('makeHistory',before,first.compute(before).syn));
 const restarted=createEngine({storage:new Map([...storage.entries()])});restarted.call('loadHistory',0);const after=restarted.compute(restarted.read()).bal;
 check('RELOAD-solutions','10 fresh runtime / solution selection',{...before,naSolution:'3',kSolution:'7.5'},{naVolume:bal.naVolume,kVolume:bal.kVolume},{naVolume:after.naVolume,kVolume:after.kVolume},['HIST-02'],basis.history,'Reload defaults cannot replace the original chosen concentrations without changing the calculated volume.');
}
finish('reload-matrix');
