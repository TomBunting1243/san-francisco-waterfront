import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {addAgricultureBuilding} from '../app/agriculture-building.ts';

const root=new THREE.Group(),panes=[];
assert.equal(addAgricultureBuilding({id:104599975},root,panes),true);
const mesh=root.children[0],geo=mesh.geometry;
const world=(s,t,h)=>new THREE.Vector3(-13.109+.06*(s-.00785*t),.045+h*.06,-1.238+.06*(t+.00785*s));
const distance=(s,t,h,ds,dt,dh)=>{
  const origin=world(s,t,h),dir=world(s+ds,t+dt,h+dh).sub(origin).normalize();
  return new THREE.Raycaster(origin,dir).intersectObject(mesh)[0]?.distance/.06;
};
test('one indexed static batch handles only the registered former post office',()=>{
  const unrelated=new THREE.Group();
  assert.equal(addAgricultureBuilding({id:91913148},unrelated,[]),false);
  assert.equal(unrelated.children.length,0);assert.equal(root.children.length,1);
  assert.ok(geo.index.count/3<2700);assert.equal(mesh.material.side,THREE.FrontSide);
});
test('laser-height roof planes descend from the long street hip to the low annex',()=>{
  for(const [s,t,expected] of [[25,8.05,12.85],[25,.1,9.86],[5.6,29,10.58],[24,27,6.87],[48,27,5.56]]){
    const h=18-distance(s,t,18,0,0,-1);assert.ok(Math.abs(h-expected)<.13,`${s}/${t} reached ${h}`);
  }
});
test('three west doors recede behind the piers; only the projecting upper return crosses the passage',()=>{
  for(const s of [3.45,25.45,47.45])assert.ok(distance(s+.24,-1,2,0,1,0)>1.38);
  assert.ok(distance(12,-1,2,0,1,0)<1.02);
  assert.ok(distance(-2,43,2,1,0,0)>20||Number.isNaN(distance(-2,43,2,1,0,0)));
  assert.ok(distance(-2,43,7.5,1,0,0)<2.25);
  assert.ok(Math.abs(distance(4,43,2,0,0,1)-4.28)<.01);
});
test('two recessed upper sash leaves and two small lantern lenses survive the shared night geometry',()=>{
  assert.equal(panes.length,2);
  for(const p of panes){assert.ok(p.w<.045&&p.h<.14);assert.ok(Math.cos(p.ry)<-.99);assert.ok(p.y>.5);}
  const energy=geo.getAttribute('signLight');
  assert.equal(energy.count,geo.getAttribute('position').count);
  assert.equal(Array.from(energy.array).filter((v,i)=>i%3===0&&v>0).length,8);
});

test('the public plaza has three recessed north entry openings and the bay has lower service leaves',()=>{
  for(const t of [3.55,8.3,13.05])assert.ok(distance(52,t+.14,2,-1,0,0)>1.48);
  assert.ok(distance(52,10,2,-1,0,0)<1.15);
  const eastCenter=50.9-(50.9-11.24)/16;
  assert.ok(distance(eastCenter+.2,40,1,0,-1,0)>1.50);
  assert.ok(distance(eastCenter+1.6,40,1,0,-1,0)<1.38);
});
