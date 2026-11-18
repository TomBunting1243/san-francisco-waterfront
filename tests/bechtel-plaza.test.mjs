import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {addBechtelPlaza} from '../app/bechtel-plaza.ts';
import {sfMap} from '../app/sf-map.ts';

const park=sfMap.parks.find(p=>p.name==='50 Beale Street Plaza'),root=new THREE.Group();
assert.equal(addBechtelPlaza(park,root),true);
const [ox,oz]=park.p[3],dx=park.p[5][0]-ox,dz=park.p[5][1]-oz,l=Math.hypot(dx,dz),c=dx/l,s=dz/l;
const ray=new THREE.Raycaster();
function height(px,py){
  const u=(px-40)/200,v=(py-40)/200;
  ray.set(new THREE.Vector3(ox+c*u-s*v,2,oz+s*u+c*v),new THREE.Vector3(0,-1,0));
  return ray.intersectObject(root)[0]?.point.y;
}
const near=(a,b,t=.0001)=>assert.ok(Math.abs(a-b)<t,`expected ${b} got ${a}`);
test('Beale entrance and crossed walking aisles stay at adjacent sidewalk grade',()=>{
  near(height(95,283),.046);near(height(170,354),.047);
  near(height(462,488),.046);near(height(565,411),.096);
  assert.equal(height(35,310),undefined);
});
test('historic 61-foot roof spans the diagonal in the 2017 image and has a raised clerestory',()=>{
  const d=Math.SQRT1_2,H=61*.3048*.06/2;
  const sample=(l,v)=>height(301+200*(l+v)*d,215+200*(-l+v)*d);
  for(const l of [-H+.005,0,H-.005]){near(sample(l,0),.314);assert.ok(sample(l,.085)<.283);}
  assert.ok(sample(-H-.03,0)<.2);assert.ok(sample(H+.03,0)<.2);
  assert.ok(sample(0,.109)<.2);
});
test('new canopies follow the planted strips and central tree independently of the car',()=>{
  assert.ok(height(322,487)>.30);assert.ok(height(520,338)>.24);assert.ok(height(326,351)>.43);
  assert.ok(height(445,352)<.09);assert.ok(height(326,422)<.09);
});
test('single indexed color batch is finite and leaves other parks to their own models',()=>{
  const [mesh]=root.children;assert.equal(root.children.length,1);
  const g=mesh.geometry;
  assert.ok(g.index.count/3<10000);assert.ok(g.attributes.position.array.every(Number.isFinite));
  assert.equal(g.attributes.position.count,g.attributes.color.count);
  assert.equal(addBechtelPlaza({name:'Rincon Park',p:[]},root),false);assert.equal(root.children.length,1);
});
