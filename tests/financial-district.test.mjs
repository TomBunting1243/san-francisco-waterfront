import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {mappedBuildings} from '../app/sf-map.ts';
import {addFinancialDistrictBuilding} from '../app/financial-district.ts';

function models(){
  const root=new THREE.Group(),windows=[];
  const ids=mappedBuildings.filter(b=>addFinancialDistrictBuilding(b,root,windows)).map(b=>b.id);
  root.updateMatrixWorld(true);
  return {root,windows,ids};
}
const bounds=object=>new THREE.Box3().setFromObject(object);
const at=(u,v)=>[-.6179+u*.89057-v*.45485,-33.2755+u*.45485+v*.89057];
function surface(root,u,v){
  const [x,z]=at(u,v);
  return new THREE.Raycaster(new THREE.Vector3(x,15,z),new THREE.Vector3(0,-1,0)).intersectObject(root)[0];
}

test('101 California preserves its 600-foot drum above the seven-story colonnade, inclined atrium and plaza',()=>{
  const {root}=models(),tower=root.getObjectByName('101 California'),base=root.getObjectByName('101 California plaza and annex');
  const drum=tower.getObjectByName('Serrated granite and glass drum'),slope=tower.getObjectByName('Inclined atrium glazing and transoms');
  const enclosure=bounds(slope);
  assert.ok(Math.abs(bounds(drum).max.y-600*.3048*.06)<.001);
  assert.ok(Math.abs(bounds(drum).min.y-1.56)<.001);
  assert.ok(enclosure.max.y-enclosure.min.y>.95);
  assert.ok(slope.geometry.getAttribute('normal').getY(0)>.3);
  assert.ok(surface(base,1.35,1.04).point.y<1.33,'The roof court is physically recessed');
  assert.ok(surface(base,1.7,.4).point.y>1.55,'The surrounding annex roof is continuous');
  assert.ok(surface(root,4.19,4.88).point.y<.10,'Open granite crossing at the plaza entrance');
  assert.equal(base.children.filter(o=>o.name==='Courtyard tree').length,6);
});

test('50 California retains four ribbed walls, a dark spandrel grid and the corrected architectural height',()=>{
  const {root,windows,ids}=models(),tower=root.getObjectByName('50 California');
  assert.deepEqual(ids.sort((a,b)=>a-b),[32612484,436484078,944093113,1279505488]);
  const fins=tower.getObjectByName('Continuous precast fins and crown');
  const glazing=tower.getObjectByName('36 floors of gray glazing and dark spandrels');
  assert.ok(fins.geometry.index.count>1600&&glazing.geometry.index.count>23000);
  assert.ok(Math.abs(bounds(tower).max.y-148.4*.06)<.001);
  assert.ok(bounds(fins).min.z<bounds(glazing).min.z);
  assert.ok(windows.length>400&&windows.length<650);
  assert.ok(windows.every(p=>p.w>0&&p.h>0&&Number.isFinite(p.ry)));
  let triangles=0;root.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});
  assert.ok(triangles<27000);
});
