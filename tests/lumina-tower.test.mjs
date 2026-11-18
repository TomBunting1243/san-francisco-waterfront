import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {addLuminaTower} from '../app/lumina-tower.ts';

const sf=JSON.parse(readFileSync(new URL('../public/data/sf-waterfront.json',import.meta.url)));
const root=new THREE.Group(),windows=[];
const b=sf.buildings.find(b=>b.id===421816060);
assert.equal(addLuminaTower(b,root,windows),true);
const [mesh]=root.children;
function ray(x,y,z,dx,dy,dz) {
  return new THREE.Raycaster(new THREE.Vector3(x,y,z),new THREE.Vector3(dx,dy,dz)).intersectObject(mesh)[0];
}
function roof(x,z){return ray(x,10,z,0,-1,0)?.point.y/.06;}
test('the Tower B builder leaves Tower D, both plaza buildings and the shared podium to their owners',()=>{
  for(const id of [421816059,421816064,421816065,1328554757])assert.equal(addLuminaTower({id},root,windows),false);
  mesh.geometry.computeBoundingBox();
  assert.ok(Math.abs(mesh.geometry.boundingBox.min.y-b.minH)<.00001);
  assert.equal(root.children.length,1);
});
test('vertical rays resolve the opposite low wings and the surveyed upper decks',()=>{
  // Cell centres in the 2023 USGS surface. Ground-normalized returns at
  // these locations are 82.0, 81.6, 117.0, 123.6 and 129.6 metres.
  const spots=[[-39.915,-20.935,81.5],[-41.715,-22.645,81.5],[-41.445,-22.645,116.8],[-39.915,-21.565,123],[-40.185,-21.745,129.8]];
  for (const [x,z,height] of spots) assert.ok(Math.abs(roof(x,z)-height)<.1,JSON.stringify([x,z,height,roof(x,z)]));
  assert.ok(roof(-40.905,-22.195)>132);
});
test('the glazing faces outward and the balconies project in front of the apartment walls',()=>{
  // Sample lit glazing from outside along its mapped normal.
  for(const w of windows.filter((_,i)=>i%9===0)) {
    const nx=Math.sin(w.ry),nz=Math.cos(w.ry);
    const hit=ray(w.x+nx*.009,w.y,w.z+nz*.009,-nx,0,-nz);
    assert.ok(hit && hit.distance<.03);
  }
  const lo=b.minH+(81.5*.06-b.minH)*12/26;
  // Compare the rail with the glazing above it on the Folsom side.
  const depths=[];
  for(let z=-22.96;z<-20.52;z+=.025) {
    const rail=ray(-38,lo+.040,z,-1,0,0),pane=ray(-38,lo+.110,z,-1,0,0);
    if(rail && pane)depths.push(rail.point.x-pane.point.x);
  }
  assert.ok(Math.max(...depths)>.045);
});
test('one indexed painted mesh supports residential night lights on rounded bays',()=>{
  assert.ok(mesh.geometry.index.count/3<16000);
  assert.equal(mesh.geometry.userData.paintVertices,true);
  assert.equal(mesh.geometry.attributes.position.count,mesh.geometry.attributes.color.count);
  assert.ok(windows.length>150 && windows.every(w=>w.h>0 && w.w>0));
  assert.ok(new Set(windows.map(w=>Math.round(w.ry*10))).size>30);
});
