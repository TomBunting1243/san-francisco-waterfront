import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {addRinconCenter} from '../app/rincon-center.ts';

const data=JSON.parse(readFileSync(new URL('../public/data/sf-waterfront.json',import.meta.url)));
const buildings=data.buildings,root=new THREE.Group(),windows=[];
const podium=buildings.find(b=>b.id===944891685);
assert.ok(addRinconCenter(podium,root,windows));
root.updateMatrixWorld(true);
const norm=Math.hypot(.158,.987);
function world(u,v,y=0){return new THREE.Vector3(-20.224+(-.158*u-.987*v)/norm,y,-7.707+(-.987*u+.158*v)/norm);}
function down(u,v){
  return new THREE.Raycaster(world(u,v,7),new THREE.Vector3(0,-1,0)).intersectObject(root)[0]?.point.y;
}
const metres=y=>(y-.045)/.06;
test('the mixed-use podium claims its mapped footprint and leaves the Annex and adjoining residential parts distinct',()=>{
  for(const id of [32862406,44106213,944891683,944891684,944891686,944891687,944891688])
    assert.equal(addRinconCenter(buildings.find(b=>b.id===id),root,windows),false);
  for(const u of [.55,4.50])assert.equal(down(u,2.67),undefined,'under separate residential tower');
  assert.equal(root.children.length,1);
  const mesh=root.children[0],geometry=mesh.geometry;
  assert.ok(geometry.index.count/3<12000);
  assert.equal(geometry.attributes.position.count,geometry.attributes.color.count);
  assert.ok(windows.length>130&&windows.length<420);
  for(const w of windows)assert.ok([w.x,w.y,w.z,w.ry,w.w,w.h].every(Number.isFinite)&&w.w>0&&w.h>0);
});
test('cross-sections reach the raised central barrel, two lower roofs and street setbacks',()=>{
  // 2023 USGS ground-normalized cells: ridge ~29.3 m, wings ~24.6 m,
  // low Steuart/Spear setbacks ~17 m. A single generic 21 m extrusion misses every class.
  for(const [u,v,h] of [[.40,.48,24.6],[4.40,.48,24.6],[.10,.52,17.1],[4.78,.33,17.1],[2.49,2.8,29.32]])
    assert.ok(Math.abs(metres(down(u,v))-h)<.1,JSON.stringify([u,v,h,down(u,v)]));
  assert.ok(metres(down(2.17,2.8))<metres(down(2.49,2.8))-1);
});
test('both covered approaches are open below the vaults and the central court stays open to the sky',()=>{
  for(const u of [.65,4.29]){
    const vaultStation=-.395+4*.457/8+.002;
    assert.ok(metres(down(u,vaultStation))>13.6);
    const soffit=new THREE.Raycaster(world(u,vaultStation,.15),new THREE.Vector3(0,1,0)).intersectObject(root)[0];
    assert.ok(soffit&&metres(soffit.point.y)>13.4,'visible soffit when looking up from the passage');
    const eye=world(u,-.19,.145),heading=world(2.48,-.19,.145).sub(eye);
    assert.equal(new THREE.Raycaster(eye,heading.clone().normalize(),0,heading.length()).intersectObject(root).length,0);
  }
  assert.equal(down(2.48,.70),undefined);
  assert.ok(Math.abs(metres(down(1.49,.87))-6.3)<.03);
  const faceRay=new THREE.Raycaster(world(2.48,1.55,1.55),world(2.48,2,1.55).sub(world(2.48,1.55,1.55)).normalize());
  const glass=faceRay.intersectObject(root)[0];
  assert.ok(glass&&glass.distance>.28&&glass.distance<.31);
});
