import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {addHarrison} from '../app/harrison.ts';
import {addRinconTower} from '../app/rincon-tower.ts';
import city from '../public/data/sf-waterfront.json' with {type:'json'};

const root=new THREE.Group(),windows=[],by=id=>city.buildings.find(b=>b.id===id);
const north=944990391,podium=260320982,south=944990390;
for(const id of [podium,north])assert.equal(addHarrison(by(id),root,windows),true);
const angle=Math.atan2(.1583,-.9874),c=Math.cos(angle),s=Math.sin(angle);
const world=(x,z,h)=>new THREE.Vector3(-52.539+.06*(c*x-s*z),.06*h,-29.626+.06*(s*x+c*z));
const localRay=(x,z,h,dx,dz,dy,max=250)=>new THREE.Raycaster(world(x,z,h),new THREE.Vector3(c*dx-s*dz,dy,s*dx+c*dz).normalize(),0,.06*max).intersectObject(root)[0];
const roof=(x,z)=>localRay(x,z,200,0,0,-1)?.point.y/.06;
const near=(a,b,tol=.05)=>assert.ok(Math.abs(a-b)<tol,JSON.stringify({a,b}));
test('three heights follow the 2023 roof transect and the upper setbacks follow both plates on A0.49',()=>{
  near(roof(10,25),116.75);near(roof(31.9,17.6),135.95);
  near(roof(15,14),145.5);near(roof(12,8),147.2);near(roof(5.3,2),150);
  near(roof(25,32),10);
  assert.ok(!localRay(-2,5,70,0,0,-1));
  assert.ok(roof(10,24)>100,'the residential plate extends outside the registered penthouse');
});
test('curved Fremont frame, physically separated north balcony trays and street entrance have visible depth',()=>{
  const toward=(x,z,h)=>localRay(x,z,h,1,0,0)?.distance/.06;
  // Northwest balcony, at the straight Harrison end. At eye level the
  // ray reaches the recessed glazing; at slab height it hits the outer edge.
  const delta=(116.75-10)/37,bottom=10+14*delta+.035;
  const slab=toward(-4,2.05,bottom+.07),door=toward(-4,2.05,bottom+1.55);
  assert.ok(door-slab>1.6);
  const east=(x,h)=>localRay(x,-15,h,0,1,0)?.distance/.06;
  assert.ok(east(2.4,80)-east(18,80)>3.2);
  // A hood projects in front of the recessed Harrison street wall.
  assert.ok(toward(-4,8.2,1.8)-toward(-4,8.2,3.32)>1.8);
});
test('the shared podium is built only once and the south tower retains its independent damper crown',()=>{
  assert.equal(addHarrison(by(south),root,windows),false);assert.equal(root.children.length,2);
  const sibling=new THREE.Group();assert.ok(addRinconTower(by(south),sibling,[]));assert.equal(addRinconTower(by(north),sibling,[]),false);
  assert.ok(root.children.every(m=>m.isMesh&&m.geometry.index&&m.material.vertexColors));
  for(const w of windows){
    const n=new THREE.Vector3(Math.sin(w.ry),0,Math.cos(w.ry));
    assert.ok(new THREE.Raycaster(new THREE.Vector3(w.x,w.y,w.z),n.negate(),0,.007).intersectObject(root)[0]);
  }
  const triangles=root.children.map(m=>m.geometry.index.count/3);
  console.log('Harrison triangles [shared podium,north tower]',triangles,'night panes',windows.length);
  assert.ok(triangles[0]+triangles[1]<13000);assert.ok(windows.length>80&&windows.length<350);
});
