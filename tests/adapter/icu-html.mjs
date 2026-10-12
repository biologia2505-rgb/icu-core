import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const sourcePath = process.env.ICU_SOURCE ? path.resolve(process.env.ICU_SOURCE) : path.join(root, 'index.html');
export const source = fs.readFileSync(sourcePath, 'utf8');
export const sourceHash = crypto.createHash('sha256').update(source).digest('hex');
export const BASE_SHA = 'cfda8ab227da9e5e78b4f4a3f23bc5a66ead3fb6e261b3b68fa1c28c5a0676b4';
const scripts = [...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(m => !/\bsrc=/.test(m[1]) && m[2].includes('function calcBasic'));
if (scripts.length !== 1) throw new Error(`Expected one ICU engine script, found ${scripts.length}`);
export const engineScript = scripts[0][2];
export const sourceLineOffset = source.slice(0, scripts[0].index + scripts[0][0].indexOf('>') + 1).split('\n').length - 1;
const compiled = new vm.Script(engineScript, {filename: sourcePath, lineOffset: sourceLineOffset});
export const functionNames = [...engineScript.matchAll(/^function (\w+)\(/gm)].map(m => m[1]);
export const analyticalNames = ['validate','physiologicWarnings','getTBWCoeff','getAcuity','calcBasic','calcStewart','detectPrimary','compensation','phCompensation','calcDeltaDelta','detectHAGMA','clinicalFindings','dataQuality','syndrome','ardsAssessment','calcBalance','calcNEWS2','calcQSOFA','calcSIRS','calcSOFA','calcAPACHE2','calcSepsis'];

class ClassList {
  constructor(initial = '') { this.values = new Set(initial.split(/\s+/).filter(Boolean)); }
  add(...values) { values.forEach(v => this.values.add(v)); }
  remove(...values) { values.forEach(v => this.values.delete(v)); }
  contains(value) { return this.values.has(value); }
  toggle(value, force) { const add = force ?? !this.contains(value); add ? this.add(value) : this.remove(value); return add; }
}
function element(tag, attrs) {
  const properties = Object.fromEntries([...attrs.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
  const el = {tagName:tag.toUpperCase(), id:properties.id, value:properties.value??'', innerHTML:'', textContent:'', classList:new ClassList(properties.class), style:{}, dataset:{}, attributes:properties, animate(){return {finished:Promise.resolve()}}, contains(){return false}, select(){}, remove(){}};
  for (const [k,v] of Object.entries(properties)) if(k.startsWith('data-')) el.dataset[k.slice(5).replace(/-([a-z])/g,(_,x)=>x.toUpperCase())] = v;
  el.setAttribute = (k,v) => {el.attributes[k] = String(v); if(k.startsWith('data-'))el.dataset[k.slice(5).replace(/-([a-z])/g,(_,x)=>x.toUpperCase())] = String(v)};
  el.getAttribute = k => el.attributes[k]??null;
  Object.defineProperty(el,'className',{get(){return [...el.classList.values].join(' ')},set(v){el.classList=new ClassList(v)}});
  return el;
}

// This DOM shim records UI transformations. It is deliberately not described as a browser.
// Native browser/visual verification is not performed by this adapter.
export function createEngine({storage = new Map(), confirmation = true} = {}) {
  const elements = new Map();
  const nodes = [];
  for (const m of source.matchAll(/<([a-z][\w-]*)\b([^>]*\bid="[^"]+"[^>]*)>/gi)) {
    const el=element(m[1],m[2]); elements.set(el.id,el); nodes.push(el);
  }
  for (const m of source.matchAll(/<select\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)) {
    const el=elements.get(m[1]); el.options=[...m[2].matchAll(/<option value="([^"]+)"/g)].map(x=>x[1]); el.value=el.options[0]??'';
  }
  const all = (selector) => {
    if(selector.startsWith('.')) {const cs=selector.slice(1).split('.');return nodes.filter(n=>cs.every(c=>n.classList.contains(c)))}
    return [];
  };
  const document = {getElementById:id=>elements.get(id)??null, querySelectorAll:all, querySelector:s=>all(s)[0]??null, documentElement:element('html',''), addEventListener(){}, body:{appendChild(){}}, createElement:t=>element(t,''),execCommand(){return true}};
  const errors=[], confirmations=[], charts=[], timers=[];
  const localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
  const matchMedia=q=>({matches:q.includes('reduced-motion'),addEventListener(){},addListener(){}});
  class FixedDate extends Date {constructor(...a){super(...(a.length?a:['2026-10-06T10:00:00Z']))}static now(){return Date.parse('2026-10-06T10:00:00Z')}}
  const setTimeout=(fn,ms)=>{timers.push({fn,ms});return timers.length};
  function Chart(ctx,config){this.config=config;this.canvas=ctx;this.destroy=()=>{};this.resize=()=>{};charts.push(this)}
  const context=vm.createContext({document,window:{addEventListener(){},matchMedia,setTimeout},console:{error:(...x)=>errors.push(x.map(String).join(' ')),log(){}},localStorage,navigator:{},confirm:msg=>{confirmations.push(msg);return confirmation},Chart,Date:FixedDate,setTimeout,clearTimeout(){}});
  compiled.runInContext(context);
  const api = {
    context,elements,document,storage,errors,charts,confirmations,
    call(name,...args){if(typeof context[name]!=='function')throw new Error(`Unknown function ${name}`);return context[name](...args)},
    evaluate(code){return vm.runInContext(code,context)},
    input(d,config={}){const values={...d,...config};const explicit=values.chronicity??values.context?.chronicity;if(explicit!==undefined)values.chronic=explicit;for(const[k,v]of Object.entries(values)){const id=k==='SBE_input'?'SBE':k;const el=elements.get(id);if(el)el.value=v===null||v===undefined||Number.isNaN(v)?'':String(v)}},
    read(){return context.readInputs()},
    text(id){const el=elements.get(id);return el?.innerHTML||el?.textContent||''},
    run(){context.runCalculation(false);if(errors.length)throw new Error(errors.join('\n'));return api.evaluate('lastReport')},
    compute(d){const b=context.calcBasic(d),st=context.calcStewart(d,b),p=context.detectPrimary(d,b),dd=context.calcDeltaDelta(d,b),h=context.detectHAGMA(d,b,st),ph=context.phCompensation(d);const syn=context.syndrome(d,b,p,dd,st,h,ph);const scales=[context.calcNEWS2(d),context.calcQSOFA(d),context.calcSIRS(d),context.calcSOFA(d,b),context.calcAPACHE2(d,b)];const balanceInput={...d,naSolution:d.naSolution??elements.get('naSolution')?.value,kSolution:d.kSolution??elements.get('kSolution')?.value};return {b,st,p,dd,h,ph,syn,comp:context.compensation(d,b,p),fin:context.clinicalFindings(d,b,st,p,dd,h),ards:context.ardsAssessment(d,b),scales,sepsis:context.calcSepsis(d,b,scales[3],scales[1]),bal:context.calcBalance(balanceInput),quality:context.dataQuality(d,b,st,scales[3])}}
  };
  return api;
}
