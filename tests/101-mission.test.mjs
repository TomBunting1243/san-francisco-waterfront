import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {sfMap} from '../app/sf-map.ts';
import {add101Mission} from '../app/101-mission.ts';

const building=sfMap.buildings.find(b=>b.id===192026938);
const root=new THREE.Group(),lights=[];
assert.ok(add101Mission(building,root,lights));
const geo=root.children[0].geometry, ray=new THREE.Raycaster();
const position=(u,h,v)=>new THREE.Vector3(-17.72+.9884*u+.1519*v,h,-16.058-.1519*u+.9884*v);
function hit(u,h,v,du,dy,dv){
  const p=position(u,h,v);
  ray.set(p,position(u+du,h+dy,v+dv).sub(p).normalize());
  return ray.intersectObject(root)[0];
}
function near(measured,target,tolerance=.002){
  assert.ok(Number.isFinite(measured)&&Math.abs(measured-target)<tolerance,'expected '+target+', got '+measured);
}

test('the Spear end corners expose three surveyed levels on each side',()=>{
  for(const u of [.20,2.21]){
    near(hit(u,7,1.25,0,-1,0)?.point.y,3.54);
    near(hit(u,7,1.05,0,-1,0)?.point.y,4.465);
    near(hit(u,7,.76,0,-1,0)?.point.y,5.365);
  }
  near(hit(1.20,7,1.21,0,-1,0)?.point.y,5.365);
  near(hit(1.19,7,.06,0,-1,0)?.point.y,5.497);
  near(hit(1.36,7,.06,0,-1,0)?.point.y,5.497);
  near(hit(.95,7,.86,0,-1,0)?.point.y,5.432);
  assert.equal(hit(-.2,7,.82,0,-1,0),undefined);
});

test('both long elevations have physical faceted bays, continuous dark office glazing and granite floor bands',()=>{
  for(const sign of [-1,1]){
    const v=sign===1?1.6:-.5,wall=sign===1?1.388:-.288;
    for(const [floorStart,pitch] of [[.324,(3.54-.324)/13],[3.54,(4.465-3.54)/4],[4.465,(5.365-4.465)/4]]){
      const pane=hit(1.205,floorStart+pitch*.42,v,0,0,-sign);
      const granite=hit(1.205,floorStart+pitch*.83,v,0,0,-sign);
      near(pane.distance-granite.distance,.009);
      near(granite.distance,Math.abs(v-wall));
      const inset=hit(1.205+.232*.49,floorStart+pitch*.42,v,0,0,-sign);
      assert.ok(inset.distance-pane.distance>.030);
    }
  }
});

test('Mission and Spear meet at a recessed pair of entry doors and shopfronts',()=>{
  const a=building.p[3],b=building.p[4],d=new THREE.Vector3(b[1]-a[1],0,-(b[0]-a[0])).normalize();
  const center=new THREE.Vector3((a[0]+b[0])/2,.112,(a[1]+b[1])/2);
  ray.set(center.clone().addScaledVector(d,.20),d.clone().negate());
  near(ray.intersectObject(root)[0]?.distance,.317);
  const pier=new THREE.Vector3(a[0]*.95+b[0]*.05,.112,a[1]*.95+b[1]*.05);
  ray.set(pier.clone().addScaledVector(d,.20),d.clone().negate());
  near(ray.intersectObject(root)[0]?.distance,.20);
});

test('one indexed facade mesh supplies correctly aligned night windows and leaves neighboring properties alone',()=>{
  assert.equal(add101Mission({...building,id:192026939},root,lights),false);
  assert.equal(root.children.length,1);
  assert.ok(geo.attributes.position.array.every(Number.isFinite));
  assert.ok(geo.index.count/3<18000);
  assert.ok(lights.length>=80 && lights.length<=135);
  for(const w of lights){
    ray.set(new THREE.Vector3(w.x,w.y,w.z),new THREE.Vector3(-Math.sin(w.ry),0,-Math.cos(w.ry)));
    near(ray.intersectObject(root)[0]?.distance,.002,.0005);
  }
});
