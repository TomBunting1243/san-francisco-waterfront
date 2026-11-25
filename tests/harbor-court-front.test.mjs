import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import data from '../app/harbor-font.json' with {type:'json'};
import {addHarborCourtFront} from '../app/harbor-court-front.ts';

const face=new THREE.Group(),panes=[],grade=.045,scale=.06;
face.position.set((-18.883-20.577)/2,0,(-6.333-6.079)/2);
face.rotation.y=Math.atan2(-.254,-1.694);
const length=Math.hypot(1.694,.254);
addHarborCourtFront(face,length,grade+17.5*scale,new FontLoader().parse(data),panes);
face.updateMatrixWorld();
const mesh=face.getObjectByName('165 Steuart western hotel frontage');
const world=(x,y,z)=>face.localToWorld(new THREE.Vector3(x*scale,grade+y*scale,z*scale));
const hit=(x,y)=>new THREE.Raycaster(world(x,y,5),world(x,y,0).sub(world(x,y,5)).normalize()).intersectObject(mesh)[0];
const depth=(x,y)=>face.worldToLocal(hit(x,y).point).z/scale;
test('the hotel door recedes under the projecting Steuart marquee between the historic hotel and the separate YMCA',()=>{
  assert.ok(Math.abs(depth(2,1.5)+1.10)<.002);
  assert.ok(Math.abs(depth(-.7,1.5))<.002);
  assert.ok(Math.abs(depth(2.5,3.70)-1.89)<.002);
  assert.ok(Math.abs(depth(6.4,3.70))<.002);
  const normal=new THREE.Vector3(0,0,1).applyQuaternion(face.quaternion);
  assert.ok(normal.z<-.98&&normal.x<-.14&&normal.x>-.16);
});
test('four canted sash bays and the stepped parapet register to the lower surveyed west wing',()=>{
  for(const x of [-8,-2.7,2.45,7.6]){
    assert.ok(Math.abs(depth(x,6.6)-.58)<.002);
    assert.ok(depth(x+1.48,6.6)<.32);
    assert.ok(Math.abs(depth(x,11))<.002);
  }
  assert.equal(hit(0,18.3),undefined);
  assert.ok(hit(13,20.3));
  assert.equal(hit(13,20.6),undefined);
  assert.equal(panes.length,4);
  for(const p of panes){
    const pos=face.worldToLocal(new THREE.Vector3(p.x,p.y,p.z));
    assert.ok(Math.abs(pos.z/scale-.605)<.002);
    assert.ok(Math.abs(pos.z/scale-depth(pos.x/scale,(pos.y-grade)/scale)-.025)<.002);
  }
});
test('warm light is confined to the door, underside and street-facing name',()=>{
  const energy=mesh.geometry.getAttribute('signLight');
  const strength=(x,y)=>energy.getX(hit(x,y).face.a);
  assert.ok(strength(2,1.5)>.12);
  assert.equal(strength(2,3.70),0);
  assert.equal(strength(-4.5,11),0);
  assert.equal(face.children.filter(m=>m.userData.signLight).length,1);
  assert.equal(face.children.some(m=>m.isLight),false);
});
