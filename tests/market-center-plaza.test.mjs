import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {addMarketCenterPlaza} from '../app/market-center-plaza.ts';

const root=new THREE.Group();
addMarketCenterPlaza(root);
const ray=new THREE.Raycaster();
function top(u,v){
  ray.set(new THREE.Vector3(-12.192+.98923777*u+.14631692*v,1,-53.725-.14631692*u+.98923777*v),new THREE.Vector3(0,-1,0));
  return ray.intersectObjects(root.children)[0]?.point.y;
}
function near(value,want,tol=.001){
  assert.ok(Math.abs(value-want)<tol, `expected ${want}, observed ${value}`);
}
test('the two surveyed tower door axes meet opposing bridges at the same floor',()=>{
  near(top(1.77,3.4105),.095);
  near(top(1.34,1.876),.095);
  near(top(1.55,2.62),.098);
  assert.equal(top(1.77,3.43),undefined);
  assert.equal(top(1.34,1.84),undefined);
});
test('the approach descends toward the rounded Market landing, with plant beds on both sides',()=>{
  const toV=x=>3.41-(x-78)*1.55/402;
  const at=(x,y)=>top(1.55+(y-282)*.00394,toV(x));
  near(at(301,403),.0874,.002);
  near(at(277,505),.0644,.002);
  near(at(281,598),.05,.002);
  near(at(178,473),.052);near(at(343,504),.048);
  assert.equal(at(281,615),undefined);
});
test('the 575 pool has lower water, raised stone coping, and emergent rocks',()=>{
  function at(x,y){return top(1.55+(y-282)*.00394,3.41-(x-78)*1.55/402);}
  near(at(415,380),.036);near(at(403,380),.045);assert.ok(at(450,404)>.06);
  near(at(344,344),.047);
});
test('one indexed draw contains all static surfaces and clears the inland amenity wing',()=>{
  assert.equal(root.children.length,1);
  const g=root.children[0].geometry;
  assert.ok(g.index.count/3<2200);
  assert.ok(g.attributes.position.array.every(Number.isFinite));
  assert.equal(top(.5,3.2),undefined);
});
