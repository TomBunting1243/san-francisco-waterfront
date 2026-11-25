import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import fontData from '../app/harbor-font.json' with {type:'json'};
import {addGriffonFront} from '../app/griffon-front.ts';

const face=new THREE.Group(),windows=[],grade=.045,scale=.06;
face.position.set((-18.883-18.064)/2,0,(-6.333-6.456)/2);
face.rotation.y=Math.atan2(-.123,-.819);
addGriffonFront(face,Math.hypot(.819,.123),.891,new FontLoader().parse(fontData),windows);
face.updateMatrixWorld();
const shell=face.getObjectByName('155 Steuart hotel and restaurant frontage');
const point=(x,h,z)=>face.localToWorld(new THREE.Vector3(x*scale,grade+h*scale,z*scale));
function hit(x,y){
  const origin=point(x,y,4),ray=new THREE.Raycaster(origin,point(x,y,0).sub(origin).normalize());
  return ray.intersectObject(shell)[0];
}
const depth=(x,h)=>face.worldToLocal(hit(x,h).point).z/scale;
test('155 opens left of centre under the bowed canopy and Perry’s occupies the right shopfront',()=>{
  assert.ok(Math.abs(depth(-1.15,1.53)+1.28)<.003);
  assert.ok(Math.abs(depth(-1.16,3.22)-1.955)<.003);
  assert.ok(Math.abs(depth(-.70,3.66)-1.95)<.003);
  assert.ok(Math.abs(depth(.54,3.66))<1.4);
  assert.ok(Math.abs(depth(4,2.07)-.036)<.002);
  assert.ok(Math.abs(depth(4,3.40)-.16)<.002);
  assert.ok(Math.abs(depth(-4,3.40))<.002);
});
test('the three landing levels have open rails and the room panes meet upper sash glazing',()=>{
  const y=4.09,x=.49;
  assert.ok(Math.abs(depth(x,y+.42)-1.03)<.002);
  assert.ok(depth(x,y+.63)<.90);
  assert.equal(windows.length,5);
  for(const w of windows){
    const pos=face.worldToLocal(new THREE.Vector3(w.x,w.y,w.z));
    const out=new THREE.Vector3(Math.sin(w.ry),0,Math.cos(w.ry));
    const ray=new THREE.Raycaster(new THREE.Vector3(w.x,w.y,w.z).addScaledVector(out,.003),out.negate());
    assert.ok(Math.abs(ray.intersectObject(shell)[0].distance-.0042)<.0001);
    assert.ok(pos.y<.891&&w.h>.05&&w.w>.06);
  }
  assert.equal(hit(0,14.5),undefined);
});
test('the door and name carry bounded night light while the canopy field and fire escape remain dark',()=>{
  const energy=shell.geometry.getAttribute('signLight');
  const strength=(x,h)=>energy.getX(hit(x,h).face.a);
  assert.ok(strength(-1.15,1.53)>.16);
  assert.equal(strength(-1.16,3.40),0);
  assert.equal(strength(.39,4.51),0);
  const glow=face.children.filter(c=>c.userData.signLight);
  assert.ok(glow.length>0&&glow.every(c=>Math.max(...c.userData.signLight)<.4));
  assert.equal(face.children.some(c=>c.isLight),false);
});
