import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {add221Main} from '../app/221-main.ts';
import {mappedBuildings} from '../app/sf-map.ts';

const root=new THREE.Group(),panes=[];
const parcel=mappedBuildings.find(b=>b.id===288714525);
assert.ok(add221Main(parcel,root,panes));root.updateMatrixWorld(true);
const building=root.children[0],ray=new THREE.Raycaster();
const world=(u,h,v)=>building.localToWorld(new THREE.Vector3(u,h,v));
function roof(u,v){
  ray.set(world(u,10,v),new THREE.Vector3(0,-1,0));
  return ray.intersectObject(building,true)[0]?.point.y;
}
test('the Main Street garden and office roof occupy different surveyed parts of the parcel',()=>{
  assert.ok(Math.abs(roof(-.16,-1.50)-(.035+14.70*.06))<.005);
  assert.ok(Math.abs(roof(-.11,1.88)-(.035+66.12*.06))<.005);
  assert.ok(Math.abs(roof(.22,1.07)-(.035+70.98*.06))<.005);
  assert.equal(roof(-1.35,.45),undefined,'open air beside Spear wing');
  const shaded=roof(.64,-1.58+.063+.012);
  assert.ok(shaded>1.11&&shaded<1.14,'terrace canopy above the garden');
  const triangleCount=building.children.reduce((total,m)=>total+m.geometry.index.count/3,0);
  assert.ok(triangleCount<16500);
});
test('night glazing faces out and no light panel shines through a concrete pier',()=>{
  assert.ok(panes.length>75);
  for(const pane of panes){
    const center=new THREE.Vector3(pane.x,pane.y,pane.z);
    const n=new THREE.Vector3(Math.sin(pane.ry),0,Math.cos(pane.ry));
    ray.set(center.clone().addScaledVector(n,.06),n.clone().negate());ray.far=.070;
    const hit=ray.intersectObject(building,true)[0];
    assert.ok(hit&&hit.point.distanceTo(center)<.003,'blocked glazing at '+center.toArray());
  }
  ray.far=Infinity;
});
