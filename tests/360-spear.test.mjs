import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {sfMap} from '../app/sf-map.ts';
import {add360Spear} from '../app/360-spear.ts';

const building=sfMap.buildings.find(b=>b.id===192307107),root=new THREE.Group(),lights=[];
assert.ok(add360Spear(building,root,lights));
const [back,north,south]=building.p;
const W=Math.hypot(south[0]-north[0],south[1]-north[1]),D=Math.hypot(back[0]-north[0],back[1]-north[1]);
const ux=(south[0]-north[0])/W,uz=(south[1]-north[1])/W,vx=(back[0]-north[0])/D,vz=(back[1]-north[1])/D;
const at=(u,y,v)=>new THREE.Vector3(north[0]+ux*u+vx*v,y,north[1]+uz*u+vz*v);
const ft=.06*.3048,ray=new THREE.Raycaster();
function top(px,py){
  const p=at((px-53)*W/865,3,(py-36)*D/392);
  ray.set(p,new THREE.Vector3(0,-1,0));return ray.intersectObject(root)[0]?.point.y;
}
function near(actual,expect,tol=.0015){assert.ok(Math.abs(actual-expect)<tol,'expected '+expect+', got '+actual);}
function cut(u,y,v,du,dv){
  const p=at(u,y,v);ray.set(p,at(u+du,y,v+dv).sub(p).normalize());
  return ray.intersectObject(root)[0]?.distance;
}

test('the surveyed perimeter roof, corner stair, open screen and condenser groups remain distinct',()=>{
  near(top(830,210),(72+7/12)*ft);
  near(top(900,85),(85+5/12)*ft);
  near(top(503.9,141),93*ft);
  near(top(542,167),1.653);
  near(top(497,282),1.543,.003);near(top(650,341),1.557,.003);
  near(top(758,397),1.593);
  near(top(439,244),(72+7/12)*ft);
  assert.equal(top(947,220),undefined);
});

test('A3.01 has eleven broad Spear bays and four broad Harrison bays between paired stair lights',()=>{
  const y=(44+7/12)*ft+.107;
  for(let i=0;i<13;i++){
    near(cut((i+.53)*W/13,y,-.21,0,1),i===0||i===12?.21:.222);
    near(cut((i+.26)*W/13,y,-.21,0,1),.222);
    near(cut((i+.03)*W/13,y,-.21,0,1),.21);
  }
  for(let i=0;i<6;i++){
    near(cut(W+.21,y,(i+.53)*D/6,-1,0),i===0||i===5?.21:.222);
    near(cut(W+.21,y,(i+.26)*D/6,-1,0),.222);
  }
  near(cut(-.21,y,D*.45,1,0),.21);
});

test('the glass canopy shelters a recessed entry beside a deeper lounge and a separate garage door',()=>{
  const pitch=W/13;
  near(cut(6.5*pitch,.105,-.20,0,1),.280,.004);
  near(cut(5.3*pitch,.115,-.20,0,1),.305);
  near(cut(7.33*pitch,.152,-.20,0,1),.219);
  const canopy=at(6.42*pitch,.52,-.07);
  ray.set(canopy,new THREE.Vector3(0,-1,0));near(ray.intersectObject(root)[0]?.point.y,.308);
});

test('one indexed mesh preserves the adjacent Infinity buildings and all night windows meet real glazing',()=>{
  assert.equal(add360Spear({id:421816058},root,lights),false);
  assert.equal(root.children.length,1);assert.equal(lights.length,21);
  const g=root.children[0].geometry;
  assert.ok(g.index.count/3<5000);assert.ok(g.attributes.position.array.every(Number.isFinite));
  for(const w of lights){
    ray.set(new THREE.Vector3(w.x,w.y,w.z),new THREE.Vector3(-Math.sin(w.ry),0,-Math.cos(w.ry)));
    near(ray.intersectObject(root)[0]?.distance,.002,.0004);
  }
});
