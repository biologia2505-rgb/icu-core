import {gas,engine,basis,check,finish} from './common.mjs';
for(const [h,co,met]of [[18,33,'metabolic acidosis'],[35,46,'metabolic alkalosis']])for(const chronicity of ['unknown','acute','chronic']){
 const d=gas(h,co,{Cl:128-h,chronicity,chronic:chronicity}),r=engine(d).compute(d);
 check('PRIORITY-'+h+'-'+co+'-'+chronicity,'1 explicit user-suspected priority anchors',d,{met,resp:null,adequateCompensation:true},{met:r.p.met,resp:r.p.resp,adequateCompensation:r.p.respIsCompensation},['AB-01'],basis.policy,'Primary metabolic controls from the audit request. Duration metadata must not turn their compensatory PaCO2 into a primary respiratory process.');
}
finish('priority-anchors-matrix');
