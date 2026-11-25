import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {addFremontGinkgos} from '../app/fremont-ginkgos.ts';
import {waterfrontGardens} from '../app/waterfront-gardens.ts';
import {addSurveyBlocks} from '../app/survey-blocks.ts';

const material=new T.MeshBasicMaterial();
function plants(month){
  const group=new T.Group();
  const sites=addFremontGinkgos((g,_c,x,y,z)=>{
    const m=new T.Mesh(g,material);m.position.set(x,y,z);group.add(m);return m;
  },month);
  group.updateMatrixWorld(true);
  return {group,sites};
}
const world=(u,v)=>new T.Vector3(-27.00800104+.0012973094*u-.0084729829*v,.045,-33.37263659+.0084728164*u+.001296584*v);
const uv=[[192.25,751.60],[191.85,709.33],[191.80,664.09],[191.54,491.92],[195.75,447.65],[196.02,403.83],[194.84,364.08]];
test('seven inventory trunks and their curb-fitted plots sit on the finished Fremont sidewalk',()=>{
  const {group,sites}=plants(7),street=[];
  addSurveyBlocks(g=>{g.computeBoundingBox();const m=new T.Mesh(g,material);street.push(m);return m;});
  for(const [i,p] of sites.entries()){
    const source=world(...uv[i]);
    assert.equal(p.id,190465+i);assert.ok(Math.hypot(p.x-source.x,p.z-source.z)<.0001);
    const [u,v]=uv[i],half=(i<4?3:4)*.3048*7/2;
    const sample=(u,v)=>{
      const pt=world(u,v);pt.y=.10;
      const hits=new T.Raycaster(pt,new T.Vector3(0,-1,0),0,.12)
        .intersectObjects(street.filter(({geometry:{boundingBox:q}})=>q.containsPoint(new T.Vector3(pt.x,q.min.y,pt.z))));
      return hits.map(h=>({color:new T.Color().fromBufferAttribute(h.object.geometry.attributes.color,h.face.a).getHexString(),y:h.point.y}));
    };
    const trunk=sample(u,v);
    assert.equal(trunk[0].color,'665b48');
    assert.ok(Math.abs(trunk[0].y-p.y)<.00002);
    for(const dv of [-half+.05,.09,half-.05]){
      for(const du of [-.09,half-.05]){
        const ground=sample(u+du,v+dv);
        assert.equal(ground[0].color,'665b48');
        assert.equal(ground.filter(h=>h.y>.040).length,1,'no buried paving');
      }
    }
    for(const delta of [-half-.06,half+.06])assert.notEqual(sample(u+.04,v+delta)[0].color,'665b48');
    assert.notEqual(sample(u+half+.06,v+.12)[0].color,'665b48');
    // The fit stops at the back of the existing cap even if the nominal box
    // extends farther streetward. The vertical curb remains intact.
    const cap=sample(189.37-.00455*(v-365)+.6,v+.14);
    assert.equal(cap[0].color,'d2cdc0');
  }
  assert.ok(Math.abs(Math.hypot(sites[2].x-sites[3].x,sites[2].z-sites[3].z)/.06-24.6)<.1);
});
test('the row clears the arcade and uses the seasonal Ginkgo scaffold and foliage batches',()=>{
  const july=plants(7),autumn=plants(11),winter=plants(1);
  for(const [i,s] of july.sites.entries()){
    const parts=july.group.children.filter(m=>m.position.x===s.x&&m.userData.plantAnchor);
    assert.deepEqual(parts.map(m=>m.name),['ginkgo branches','ginkgo foliage']);
    assert.equal(parts[0].userData.plantAnchor,parts[1].userData.plantAnchor);
    const leaf=parts[1];assert.equal(leaf.userData.plantCrown,true);
    assert.ok(winter.group.children.every(m=>!m.userData.plantCrown));
    const gold=autumn.group.children.find(m=>m.position.x===s.x&&m.userData.plantCrown);
    assert.notDeepEqual(leaf.geometry.attributes.color.array,gold.geometry.attributes.color.array);
    const wall=world(206,uv[i][1]),normal=new T.Vector3(.1513,0,.9885);
    for(const part of parts){
      const pos=part.geometry.attributes.position;
      for(let n=0;n<pos.count;n++){
        const pt=part.localToWorld(new T.Vector3().fromBufferAttribute(pos,n));
        assert.ok(pt.sub(wall).dot(normal)<0,'wall envelope '+s.id);
      }
    }
  }
});
test('the assembled garden retains the opposite ten figs and has a single stem at each Ginkgo site',()=>{
  const {treeAnchors}=waterfrontGardens([]);
  for(const {x,z,id} of plants(7).sites){
    assert.deepEqual(treeAnchors.filter(a=>Math.hypot(a.x-x,a.z-z)<.12).map(a=>a.id),[id]);
  }
  assert.equal(treeAnchors.filter(a=>a.id>=190300&&a.id<=190309).length,10);
});
