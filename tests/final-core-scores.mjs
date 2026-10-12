import {base,createEngine,engine,score,check,finish} from './final-core-testkit.mjs';
const scale=(d,name)=>{const e=engine(d),b=e.call('calcBasic',d);return e.call(name,d,b);};
const component=(d,fn,name)=>score(scale(d,fn),name);
const baseline={...base,chronicHealth:'no',surgicalContext:'unknown',Vaso:'none',respiratorySupport:'no',O2support:'no',news2Scale:'1'};

// Missing components are deliberately asserted independently, rather than expected totals derived from ICU functions.
for(const field of ['Plt','Bil','GCS','SBP','DBP','pO2','FiO2']){
 const d={...baseline,[field]:NaN,infection:'yes',infectionRelatedOrganDysfunction:'yes'},r=engine(d).compute(d);
 const name={Plt:'Тромбоциты',Bil:'Билирубин',GCS:'GCS',SBP:'ССС',DBP:'ССС',pO2:'PaO₂/FiO₂',FiO2:'PaO₂/FiO₂'}[field],item=r.scales[3].items.find(i=>i.name===name);
 check('SC01-SOFA-missing-'+field,'SC-01',d,{complete:false,score:null,available:false,total:null,sepsisConfirmed:false},{complete:r.scales[3].complete,score:item.score,available:item.available,total:r.scales[3].total,sepsisConfirmed:r.sepsis.sepsisConfirmed});
}
for(const pf of [99.99,100,100.01,199.99,200,200.01,299.99,300,300.01,399.99,400,400.01])for(const support of ['yes','no','unknown']){
 const d={...baseline,FiO2:50,pO2:pf*.5,respiratorySupport:support},r=scale(d,'calcSOFA'),item=r.items[0];
 const expected=pf>=400?0:pf>=300?1:pf>=200?2:support==='no'?2:support==='yes'?(pf>=100?3:4):null;
 const range=expected===null?{low:2,high:pf>=100?3:4}:null;
 check('SC02-SOFA-PF-'+pf+'-'+support,'SC-02',d,{score:expected,available:expected!==null,complete:expected!==null,range},{score:item.score,available:item.available,complete:r.complete,range:item.range});
}
for(const [cr,urine,expected,determined]of [[80,NaN,0,false],[NaN,1500,0,false],[2*88.4,NaN,2,false],[NaN,300,3,false],[5*88.4,NaN,4,true],[NaN,100,4,true],[NaN,NaN,null,false]]){
 const d={...baseline,Cr:cr,Urine:urine},r=scale(d,'calcSOFA'),item=r.items.at(-1);
 check('SC01-renal-partial-'+cr+'-'+urine,'SC-01',d,{score:expected,complete:determined,lowerBound:expected!==null&&!determined},{score:item.score,complete:r.complete,lowerBound:item.lowerBound},'One known criterion supplies a lower bound; a known maximum4 mathematically determines max even when the other criterion is unavailable.');
}
for(const cr of [.59,1.19,1.2,1.21,1.99,2,2.01,3.49,3.5,3.51,4.99,5,5.01])for(const urine of [199.99,200,200.01,499.99,500,500.01,1500]){
 const d={...baseline,Cr:cr*88.4,Urine:urine},cs=cr>=5?4:cr>=3.5?3:cr>=2?2:cr>=1.2?1:0,us=urine<200?4:urine<500?3:0;
 check('SC01-renal-max-'+cr+'-'+urine,'SC-01',d,{score:Math.max(cs,us),complete:true},{score:component(d,'calcSOFA','Креатинин / диурез 24 ч'),complete:scale(d,'calcSOFA').complete});
}
for(const map of [65,70,80]){
 const d={...baseline,Vaso:'dobutamine',SBP:map,DBP:map};
 check('SC09-dobutamine-'+map,'SC-09',d,{score:2,complete:true},{score:component(d,'calcSOFA','ССС'),complete:scale(d,'calcSOFA').complete});
}
for(const [extra,riskBand,total,singleRedTrigger]of [[{RR:25},'low-medium-red',3,true],[{RR:25,O2support:'yes'},'medium',5,true],[{RR:25,SBP:90,O2support:'yes'},'high',8,true],[{RR:21,O2support:'yes'},'low',4,false],[{},'low',0,false]]){
 const d={...baseline,...extra},r=scale(d,'calcNEWS2');
 check('SC04-red-trigger-'+JSON.stringify(extra),'SC-04',d,{riskBand,total,singleRedTrigger},{riskBand:r.riskBand,total:r.total,singleRedTrigger:r.singleRedTrigger});
}
const scale2Anchors=[[83,3,3],[84,2,2],[85,2,2],[86,1,1],[87,1,1],[88,0,0],[90,0,0],[92,0,0],[93,0,1],[94,0,1],[95,0,2],[96,0,2],[97,0,3],[98,0,3]];
for(const [spo,air,oxygen]of scale2Anchors)for(const support of ['no','yes']){
 const d={...baseline,news2Scale:'2',SpO2:spo,O2support:support},r=scale(d,'calcNEWS2');
 check('SC06-scale2-'+spo+'-'+support,'SC-06',d,{score:support==='no'?air:oxygen,complete:true,scale:'2'},{score:score(r,'SpO2'),complete:r.complete,scale:r.news2Scale},'Independent official RCP NEWS2 Scale2 anchors; selection is an explicit clinician input.');
}
for(const threshold of [83,85,87,92,94,96])for(const delta of [-.01,0,.01])for(const oxygen of ['yes','no']){
 const spo=threshold+delta,d={...baseline,news2Scale:'2',SpO2:spo,O2support:oxygen},expected=spo<=83?3:spo<=85?2:spo<=87?1:spo<=92?0:oxygen==='no'?0:spo<=94?1:spo<=96?2:3;
 check('SC06-scale2-boundary-'+threshold+'-'+delta+'-'+oxygen,'SC-06',d,{score:expected},{score:component(d,'calcNEWS2','SpO2')});
}
for(const chronicity of ['acute','chronic','unknown']){
 const d={...baseline,news2Scale:undefined,chronic:chronicity,chronicity,pCO2:70,SpO2:90,O2support:'yes',notes:'COPD / chronic hypercapnia'},r=scale(d,'calcNEWS2');
 check('SC06-no-inference-'+chronicity,'SC-06',d,{score:3,scale:'1'},{score:score(r,'SpO2'),scale:r.news2Scale});
}
for(const [fn,fields]of [['calcNEWS2',['RR','SpO2','SBP','HR','Temp','O2support','ACVPU']],['calcQSOFA',['RR','SBP','GCS']],['calcSIRS',['Temp','HR','RR','pCO2','WBC','Bands']]])for(const field of fields){
 const d={...baseline,[field]:['O2support','ACVPU'].includes(field)?'unknown':NaN},r=scale(d,fn);
 check('SC07-missing-'+fn+'-'+field,'SC-07',d,{complete:false,total:null,disclosed:true},{complete:r.complete,total:r.total,disclosed:/[Нн]еполн/.test(r.interp)&&r.missing.length>0});
}
for(const extra of [{RR:25,pCO2:NaN},{WBC:15,Bands:NaN}]){
 const d={...baseline,...extra},r=scale(d,'calcSIRS');
 check('SC07-known-positive-alternative-'+JSON.stringify(extra),'SC-07',d,{complete:true,total:1},{complete:r.complete,total:r.total},'A known positive alternative determines the criterion without treating the missing alternate measurement as negative.');
}
const apacheComponent={Temp:'Температура',SBP:'Среднее АД',DBP:'Среднее АД',HR:'ЧСС',RR:'ЧД',pO2:'Оксигенация',FiO2:'Оксигенация',pH:'pH',Na:'Na',K:'K',Cr:'Креатинин',Hct:'Гематокрит',WBC:'Лейкоциты',GCS:'GCS (дефицит)',Age:'Возраст'};
for(const [field,name]of Object.entries(apacheComponent)){
 const d={...baseline,[field]:NaN},r=scale(d,'calcAPACHE2'),item=r.items.find(i=>i.name===name);
 check('SC03-APACHE-missing-'+field,'SC-03',d,{score:null,available:false,complete:false,total:null},{score:item.score,available:item.available,complete:r.complete,total:r.total});
}
for(const extra of [{chronicHealth:'unknown'},{chronicHealth:'yes',surgicalContext:'unknown'}]){
 const d={...baseline,...extra},r=scale(d,'calcAPACHE2');
 check('SC03-APACHE-missing-chronic-'+JSON.stringify(extra),['SC-03','SC-08'],d,{complete:false,total:null,chronic:null},{complete:r.complete,total:r.total,chronic:score(r,'Хроническое')});
}
for(const [criterion,operation,expected]of [['no','unknown',0],['yes','non-operative',5],['yes','emergency',5],['yes','elective',2],['yes','unknown',null],['unknown','elective',null]]){
 const d={...baseline,chronicHealth:criterion,surgicalContext:operation},r=scale(d,'calcAPACHE2');
 check('SC08-context-'+criterion+'-'+operation,'SC-08',d,{points:expected,complete:expected!==null},{points:score(r,'Хроническое'),complete:r.complete});
}
for(const legacy of ['mild','severe']){
 const d={...baseline,chronicHealth:undefined,Chronic:legacy},r=scale(d,'calcAPACHE2');
 check('SC08-legacy-'+legacy,'SC-08',d,{points:null,complete:false,legacyReview:true},{points:score(r,'Хроническое'),complete:r.complete,legacyReview:r.legacyReview});
 const neutral={...baseline,Chronic:legacy},old=scale(neutral,'calcAPACHE2');
 check('SC08-legacy-fresh-neutral-'+legacy,'SC-08',neutral,{points:null,complete:false,legacyReview:true},{points:score(old,'Хроническое'),complete:old.complete,legacyReview:old.legacyReview},'A fresh no-valued selector must not silently resolve an explicitly supplied legacy mild/severe context. Reviewed UI clears the legacy value.');
}
{
 const d={...baseline,chronicHealth:'yes',surgicalContext:'elective',legacyApacheReview:true},r=scale(d,'calcAPACHE2');
 check('SC08-legacy-flag','SC-08',d,{points:null,legacyReview:true},{points:score(r,'Хроническое'),legacyReview:r.legacyReview});
}
for(const arf of ['no','yes','unknown'])for(const [cr,points]of [[.6,0],[1.5,2],[2,3],[3.5,4]]){
 const d={...baseline,Cr:cr*88.4,acuteRenalFailure:arf},r=scale(d,'calcAPACHE2');
 check('SC03-ARF-'+arf+'-'+cr,'SC-03',d,{score:arf==='unknown'?null:arf==='yes'?2*points:points,complete:arf!=='unknown',unknownTotal:arf==='unknown'},{score:score(r,'Креатинин'),complete:r.complete,unknownTotal:Number.isNaN(r.total)});
}
for(const invalid of [2.99,15.01,NaN]){
 const d={...baseline,GCS:invalid};
 for(const fn of ['calcQSOFA','calcSOFA','calcAPACHE2'])check('SC03-GCS-domain-'+fn+'-'+invalid,['SC-03','SC-01','SC-07'],d,{complete:false},{complete:scale(d,fn).complete});
}
for(const gasSampleType of ['venous'])for(const fi of [21,50,100]){
 const d={...baseline,gasSampleType,FiO2:fi,pO2:60,respiratorySupport:'yes'},sofa=scale(d,'calcSOFA'),apache=scale(d,'calcAPACHE2');
 check('OX01-score-venous-'+fi,'OX-01',d,{sofa:null,apache:null},{sofa:score(sofa,'PaO₂/FiO₂'),apache:score(apache,'Оксигенация')});
}
for(const fi of [0,-1,.5,100.01,NaN]){
 const d={...baseline,FiO2:fi},sofa=scale(d,'calcSOFA'),apache=scale(d,'calcAPACHE2');
 check('QC02-score-FiO2-'+fi,'QC-02',d,{sofa:null,apache:null},{sofa:score(sofa,'PaO₂/FiO₂'),apache:score(apache,'Оксигенация')});
}
for(const extra of [{},{Temp:41,HR:180,RR:50,pH:7.7,Na:180,K:7,Cr:4*88.4,Hct:60,WBC:40,GCS:3,Age:80,chronicHealth:'yes',surgicalContext:'non-operative'}]){
 const d={...baseline,...extra},r=scale(d,'calcAPACHE2');
 check('EXTRA-APACHE01-'+JSON.stringify(extra),'EXTRA-APACHE-01',d,{complete:true,noPercent:true},{complete:r.complete,noPercent:!/%/.test(r.interp+' '+r.totalDisplay)});
 check('EXTRA-APACHE02-'+JSON.stringify(extra),'EXTRA-APACHE-02',d,{has24hNote:true},{has24hNote:r.applicabilityNote.includes('первых 24 часов')&&r.applicabilityNote.includes('snapshot')&&r.interp.includes(r.applicabilityNote)});
}
// Numeric oracle tables are independent constants, not calculations from the functions under test.
const table=[['Temp','Температура',[30,32,34,36,38.5,39,41],[4,3,2,1,0,1,3,4]],['MAP','Среднее АД',[50,70,110,130,160],[4,2,0,2,3,4]],['HR','ЧСС',[40,55,70,110,140,180],[4,3,2,0,2,3,4]],['RR','ЧД',[6,10,12,25,35,50],[4,2,1,0,1,3,4]],['pH','pH',[7.15,7.25,7.33,7.5,7.6,7.7],[4,3,2,0,1,3,4]],['Na','Na',[111,120,130,150,155,160,180],[4,3,2,0,1,2,3,4]],['K','K',[2.5,3,3.5,5.5,6,7],[4,2,1,0,1,3,4]],['Cr-mg','Креатинин',[.6,1.5,2,3.5],[2,0,2,3,4]],['Hct','Гематокрит',[20,30,46,50,60],[4,2,0,1,2,4]],['WBC','Лейкоциты',[1,3,15,20,40],[4,2,0,1,2,4]]];
for(const [field,name,thresholds,points]of table)for(const threshold of thresholds)for(const delta of [-.01,0,.01]){
 const x=threshold+delta,d={...baseline,...(field==='MAP'?{SBP:x,DBP:x}:field==='Cr-mg'?{Cr:x*88.4}:{[field]:x})};let index=0;while(index<thresholds.length&&x>=thresholds[index])index++;
 check('SC03-frozen-numeric-'+field+'-'+threshold+'-'+delta,'SC-03',d,{score:points[index]},{score:component(d,'calcAPACHE2',name)});
}
finish('final-core-scores');
