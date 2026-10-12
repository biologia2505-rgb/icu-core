import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createEngine} from './adapter/icu-html.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fixtures=JSON.parse(fs.readFileSync(path.join(root,'tests/cases-35.json'),'utf8'));
const checks=[];
function check(id,fn){try{fn();checks.push({id,status:'PASS'})}catch(e){checks.push({id,status:'FAIL',error:String(e.stack||e)})}}
for(const f of fixtures){
  check('history/context roundtrip '+f.id,()=>{
    const e=createEngine();const input={...f.scenario.input,...f.scenario.context,anionSourceConfirmed:'yes',acuteRenalFailure:'yes',sampleSimultaneity:'yes',gasSampleType:'arterial'};
    for(const key of ['respiratorySupport','adequateResuscitation'])if(typeof input[key]==='boolean')input[key]=input[key]?'yes':'no';
    e.input(input,f.scenario.config);e.run();const before=e.read(),syn=e.compute(before).syn;
    e.call('saveHistory',e.call('makeHistory',before,syn));e.call('clearAll');
    assert.equal(e.read().anionSourceConfirmed,'unknown');assert.equal(e.read().acuteRenalFailure,'unknown');assert.equal(e.read().respiratorySupport,'unknown');assert(Number.isNaN(e.read().baselineSOFA));
    e.call('loadHistory',0);const after=e.read();assert.equal(after.SBE_input,before.SBE_input);
    for(const key of ['anionSourceConfirmed','acuteRenalFailure','respiratorySupport','baselineSOFA','infectionRelatedOrganDysfunction','adequateResuscitation','vasopressorRequirement','sampleSimultaneity','gasSampleType'])assert.equal(after[key],before[key]);
    assert.equal(e.errors.length,0);
    if(f.number>=266){const r=e.compute(after);assert.equal(e.text('dash-apache'),String(r.scales[4].total));
      assert.equal(e.text('dash-PF-status'),r.ards.status);assert(!e.text('finalResults').includes('· Критерии септического шока подтверждены'));
    }
  });
}
check('old history cannot inherit new context',()=>{
  const e=createEngine();e.input({...fixtures[0].scenario.input,anionSourceConfirmed:'yes',acuteRenalFailure:'yes',baselineSOFA:5});
  e.call('saveHistory',{data:{pH:7.4,pCO2:40,HCO3in:24,SBE:0},sbeMode:'input'});e.call('loadHistory',0);
  assert.equal(e.read().anionSourceConfirmed,'unknown');assert.equal(e.read().acuteRenalFailure,'unknown');assert(Number.isNaN(e.read().baselineSOFA));
});
check('preset clears clinical context',()=>{
  const e=createEngine();e.input({anionSourceConfirmed:'yes',acuteRenalFailure:'yes',respiratorySupport:'yes',vasopressorRequirement:'yes',baselineSOFA:3});e.call('loadPreset','4.5');
  assert.equal(e.read().anionSourceConfirmed,'unknown');assert.equal(e.read().acuteRenalFailure,'unknown');assert.equal(e.read().respiratorySupport,'unknown');assert.equal(e.read().vasopressorRequirement,'unknown');assert(Number.isNaN(e.read().baselineSOFA));
});
check('SBE conflict does not introduce opposite metabolic process',()=>{
  const e=createEngine();const d={...fixtures[7].scenario.input,SBE_input:15};const r=e.compute(d);
  assert.equal(r.p.met,'metabolic acidosis');assert.equal(r.h.hasHAGMA,true);assert.equal(r.dd.applicable,true);assert.equal(r.b.SBE,15);
  assert(e.call('clinicalQC',d,r.b).warnings.some(w=>w.code==='SBE_CONFLICT'));
});
check('gas conflict actually blocks syndrome and leaves mathematics',()=>{
  const e=createEngine();const d={...fixtures[7].scenario.input,HCO3in:30};const r=e.compute(d);
  assert.equal(r.b.HCO3,30);assert.equal(r.p.invalid,true);assert.equal(r.h.hasHAGMA,false);assert.equal(r.dd.applicable,false);assert.equal(r.syn.interpretationBlocked,true);assert.equal(r.syn.components.length,0);
  e.input(d);e.run();assert(e.text('syndrome').includes('клинический диагноз КОС не сформирован'));assert(e.text('qcResults').includes('HCO₃⁻ расходится'));
});
check('unknown Berlin pressure cannot become confirmed',()=>{
  const e=createEngine();const d={...fixtures[16].scenario.input,PEEP:NaN};assert.equal(e.compute(d).ards.confirmed,false);
});
check('both Stewart profiles remain different and visible',()=>{
  const e=createEngine();const d=fixtures[0].scenario.input,simple=e.compute({...d,sidModel:'simple'}),charged=e.compute({...d,sidModel:'charged'});
  assert(Math.abs(charged.st.SIDa-simple.st.SIDa-d.Ca-d.Mg)<1e-8);
  assert(simple.st.formula.includes('Ca + Mg'));assert(charged.st.formula.includes('2×Ca + 2×Mg'));
});
check('explicit shock remains positive despite MAP above65 on pressor',()=>{
  const e=createEngine();const d={...fixtures[18].scenario.input,baselineSOFA:0,infection:'yes',respiratorySupport:'yes',infectionRelatedOrganDysfunction:'yes',adequateResuscitation:'yes',vasopressorRequirement:'yes',Vaso:'norepi_low',Lac:3};
  e.input(d);e.run();assert(e.compute(d).sepsis.shockConfirmed);assert(e.text('finalResults').includes('Критерии септического шока подтверждены'));
});
// Fully executed input→math→diagnosis→UI/report cases, with independent expected categories.
// Variants are separate from the 35 original synthetic cases; no original inputs are edited.
const base={...fixtures[0].scenario.input,...fixtures[0].scenario.config,pH:7.4,pCO2:40,HCO3in:24,SBE_input:0,Na:160,Cl:115,Alb:40,Lac:1,Gluc:5.5,anionSourceConfirmed:'unknown'};
const variants=[
  ['hypernatremia AG alone',{},'possible',false,false],
  ['hypernatremia lactate evidence',{Lac:3},'supported',true,false],
  ['hypernatremia source independently confirmed',{anionSourceConfirmed:'yes'},'supported',true,false],
  ['hypernatremia acidifying gas',{pH:7.3,pCO2:30,HCO3in:14.3},'supported',true,false],
  ['normal pH acidifying gas',{Na:140,Cl:100,pH:7.4,pCO2:33.4,HCO3in:20},'supported',true,true],
  ['alkalemia high HCO3 lactate',{pH:7.45,pCO2:42,HCO3in:28,Lac:3},'supported',true,false],
  ['alkalemia high HCO3 confirmed source',{pH:7.45,pCO2:42,HCO3in:28,anionSourceConfirmed:'yes'},'supported',true,false],
  ['glucose and negated notes not source',{Gluc:30,notes:'Кетоны не подтверждены. Кетоацидоза нет.'},'possible',false,false],
  ['confirmed source cannot override gas conflict',{HCO3in:30,anionSourceConfirmed:'yes',Lac:4},'unreliable',false,false]
];
for(const [id,changes,confidence,supported,ratio]of variants)check('HAGMA confidence pipeline: '+id,()=>{
  const e=createEngine(),input={...base,...changes};e.input(input);const before=JSON.stringify(e.read());e.run();const d=e.read(),r=e.compute(d);
  assert.equal(JSON.stringify(d),before);assert.equal(r.h.confidence,confidence);assert.equal(r.h.hasHAGMA,supported);assert.equal(r.dd.applicable,ratio);
  assert.equal(r.h.componentPossible,true);
  if(confidence==='unreliable'){assert.equal(r.syn.interpretationBlocked,true);assert(e.text('qcResults').includes('HCO₃⁻ расходится'));}
  else{
    assert(!r.syn.title.includes('Расстройств КОС не выявлено'));
    for(const panel of ['diagnosis','dash-findings','results-findings','finalResults'])assert(e.text(panel).includes(e.call('escapeHTML',r.h.reason)),panel);
    assert(e.evaluate('lastReport').includes(r.h.reason));
    if(!ratio){assert(!r.syn.detail.includes(r.dd.classification));assert(e.text('results').includes(r.dd.classification));}
    if(confidence==='possible'&&!r.syn.components.length)assert(!e.text('finalResults').includes('Нарушение КОС:'));
  }
  if(d.Na>145)assert(e.text('qcResults').includes('Гипернатриемия ограничивает интерпретацию'));
  assert.equal(e.errors.length,0);
});
check('all numerical fixtures and original cases remain identical after confidence amendment',()=>{
  const before=JSON.parse(fs.readFileSync(path.join(root,'reference/cases-35-before-hagma.json'),'utf8'));
  assert.equal(fixtures.length,before.length);
  for(let i=0;i<fixtures.length;i++){assert.deepEqual(fixtures[i].scenario,before[i].scenario);assert.deepEqual(fixtures[i].math,before[i].math);assert.deepEqual(fixtures[i].qcCodes,before[i].qcCodes);}
});
const result={pass:checks.filter(c=>c.status==='PASS').length,fail:checks.filter(c=>c.status==='FAIL').length,nativeBrowser:false,checks};
fs.writeFileSync(path.join(root,'reports/integration.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({pass:result.pass,fail:result.fail}));for(const x of checks.filter(c=>c.status==='FAIL'))console.log(x.id,x.error);process.exitCode=result.fail?1:0;
