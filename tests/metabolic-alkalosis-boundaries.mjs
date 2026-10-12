import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {root, createEngine, sourceHash} from './adapter/icu-html.mjs';

// Literal independent anchors for the unchanged 0.7 × HCO3 + 21 ± 2 formula.
// Clinical expectations are prescribed by the approved policy, never by ICU CORE.
const anchors = [
  {id:'MA-HCO3-27', h:27, low:37.9, high:41.9},
  {id:'MA-HCO3-28', h:28, low:38.6, high:42.6},
  {id:'MA-HCO3-35', h:35, low:43.5, high:47.5},
  {id:'MA-HCO3-40', h:40, low:47, high:51},
];
const base=JSON.parse(fs.readFileSync(path.join(root,'reference/clinical-scenarios-original.json'),'utf8'))[0].input;
const checks=[];
function check(id, expected, fn) {
  try { fn(); checks.push({id,status:'PASS',expected,...(/MA-HCO3-(27|28): high plus/.test(id)?{amendment:'AB-01 primary-process amendment D: normal-pH mixed components remain confirmed without falsely ordering a primary process.'}:{})}); }
  catch(error) { checks.push({id,status:'FAIL',expected,error:String(error.stack||error)}); }
}
// New fixtures alone are constructed independently by Henderson–Hasselbalch.
// This never corrects or modifies any original synthetic clinical case.
function gas(h,co,changes={}) {
  const pH=6.1+Math.log10(h/(0.03*co));
  const SBE=h-24.4+16.2*(pH-7.4);
  return {...base,pH,pCO2:co,HCO3in:h,SBE_input:SBE,sbeMode:'input',
    chronic:'unknown',chronicity:'unknown',Na:140,Cl:128-h,Alb:40,Lac:1,
    Gluc:5.5,Ur:5,anionSourceConfirmed:'unknown',...changes};
}
function intervalText(text,a,label) {
  const literal=`${a.low.toFixed(1)}–${a.high.toFixed(1)}`;
  assert(text.includes(literal),`${label}: expected ${literal}, actual ${text}`);
}
function evaluate(a,co,status) {
  const e=createEngine(),d=gas(a.h,co),original=JSON.stringify(d),r=e.compute(d);
  const resp=status==='below'?'respiratory alkalosis':status==='above'?'respiratory acidosis':null;
  const processes=resp?['metabolic alkalosis',resp]:['metabolic alkalosis'];
  assert.equal(r.p.met,'metabolic alkalosis','established primary metabolic alkalosis');
  assert(!r.p.respiratoryPrimary,'unknown chronicity preserves primary metabolic precedence');
  assert.equal(r.p.resp,resp,'relative compensation deviation determines the extra respiratory process');
  assert.equal(r.p.respIsCompensation,status==='within','inclusive expected range is compensated');
  assert.equal(r.p.bothOpposite,resp==='respiratory acidosis');
  assert.deepEqual(Array.from(r.syn.processes).sort(),processes.sort(),'full acid-base composition');
  assert.deepEqual(Array.from(r.syn.possibleProcesses),[],'no unrequested possible processes');
  const ambiguous=(a.h===27||a.h===28)&&status==='above';
  assert.equal(r.syn.title,resp?'Смешанное нарушение':'Изолированное нарушение');
  if(ambiguous)assert.equal(r.p.primaryProcessCertain,false);
  assert.equal(r.comp.checks[0],ambiguous?'первичность не определена':status==='within'?'адекватна':status==='below'?'ниже ожид.':'выше ожид.');
  intervalText(r.comp.text,a,'display uses unchanged compensation formula');
  if(status==='within')assert(r.syn.detail.includes('респираторная компенсация в ожидаемом диапазоне'));
  if(resp)assert(r.syn.detail.includes(resp==='respiratory alkalosis'?'респираторный алкалоз':'респираторный ацидоз'));
  assert.equal(r.b.HCO3,d.HCO3in,'entered bicarbonate preserved');
  assert.equal(r.b.SBE,d.SBE_input,'entered SBE preserved');
  assert(Math.abs(r.b.HCO3calc-a.h)<1e-10,'independent coherent H-H fixture');
  assert(Math.abs(r.b.AG-12)<1e-10,'independent normal AG: 140 − Cl − HCO3 = 12');
  assert(Math.abs(r.b.AGcorr-12)<1e-10,'albumin 40 gives AGcorr = 12');
  const qc=e.call('clinicalQC',d,r.b);
  assert(!qc.warnings.some(w=>w.code==='HCO3_CONFLICT'||w.code==='SBE_CONFLICT'),'no gas/SBE QC veto');
  assert.equal(JSON.stringify(d),original,'calculation never mutates the input');
  e.input(d); e.run();
  assert.equal(e.read().chronicity,'unknown');
  assert.equal(e.compute(e.read()).p.resp,resp,'form input reaches the same classification');
  assert.equal(e.compute(e.read()).comp.checks[0],r.comp.checks[0],'calculation and display agree');
  assert(e.text('syndrome').includes(resp?'Смешанное нарушение':'Изолированное нарушение'));
  assert.equal(e.errors.length,0);
}
for(const a of anchors) {
  const points=[
    ['low minus 0.01',a.low-.01,'below'],
    ['low',a.low,'within'],
    ['inside',(a.low+a.high)/2,'within'],
    ['high',a.high,'within'],
    ['high plus 0.01',a.high+.01,'above'],
    ['floating representation just below low',a.low-Number.EPSILON*Math.max(1,Math.abs(a.low)),'within'],
    ['floating representation just above high',a.high+Number.EPSILON*Math.max(1,Math.abs(a.high)),'within'],
    ['low minus 0.000000001: no extra tolerance',a.low-1e-9,'below'],
    ['high plus 0.000000001: no extra tolerance',a.high+1e-9,'above'],
  ];
  for(const [name,co,status] of points)check(`${a.id}: ${name}`,{HCO3:a.h,PaCO2:co,range:[a.low,a.high],status,insideAbsolute35to45:co>=35&&co<=45},()=>evaluate(a,co,status));
}
const example=anchors.find(a=>a.h===35);
for(const [co,status] of [[42,'below'],[43.5,'within'],[46,'within'],[47.5,'within'],[48,'above']])check(`approved example HCO3 35 / PaCO2 ${co}`,{HCO3:35,PaCO2:co,range:[43.5,47.5],status},()=>evaluate(example,co,status));
// Existing absolute respiratory thresholds must not gate established metabolic alkalosis.
for(const co of [35,45])check(`metabolic alkalosis at absolute PaCO2 boundary ${co}`,{HCO3:35,PaCO2:co,range:[43.5,47.5],status:co<43.5?'below':'within'},()=>evaluate(example,co,co<43.5?'below':'within'));
check('gas QC conflict still blocks diagnosis without changing inputs',{HCO3:35,PaCO2:42,pH:7.2,blocked:true},()=>{
  const e=createEngine(),d=gas(35,42,{pH:7.2}),original=JSON.stringify(d),r=e.compute(d);
  assert.equal(r.b.HCO3,35); assert.equal(r.b.SBE,d.SBE_input);
  assert.equal(r.p.invalid,true); assert.equal(r.p.met,null); assert.equal(r.p.resp,null);
  assert.equal(r.syn.interpretationBlocked,true); assert(r.comp.text.includes('заблокирована'));
  assert.equal(JSON.stringify(d),original);
});
const result={schema:1,sourceHash,policy:'Approved primary metabolic alkalosis: always compare PaCO2 to unchanged 0.7 × HCO3 + 21 ± 2; inclusive limits; representation epsilon only.',
  anchors,pass:checks.filter(x=>x.status==='PASS').length,fail:checks.filter(x=>x.status==='FAIL').length,checks};
const report=path.join(root,'reports/metabolic-alkalosis-boundaries'+(process.env.ICU_REPORT_SUFFIX||'')+'.json');
fs.writeFileSync(report,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({test:'metabolic-alkalosis-boundaries',sourceHash,pass:result.pass,fail:result.fail}));
for(const item of checks.filter(x=>x.status==='FAIL'))console.log(item.id,item.error.split('\n')[0]);
process.exitCode=result.fail?1:0;
