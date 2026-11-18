import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {addDrummFrontage} from '../app/drumm-frontages.ts';

const data=JSON.parse(readFileSync(new URL('../public/data/sf-waterfront.json',import.meta.url)));
const b=data.buildings.find(b=>b.id===260288456),root=new THREE.Group(),windows=[];
assert.equal(addDrummFrontage(b,root,windows),true);
const [mesh]=root.children;
const [x,z]=b.p[0],width=Math.hypot(b.p[7][0]-x,b.p[7][1]-z);
const c=(b.p[7][0]-x)/width,s=(b.p[7][1]-z)/width;
function at(u,y,d){return new THREE.Vector3(x+c*u-s*d,y,z+s*u+c*d);}
function elevation(u,y){
  const hit=new THREE.Raycaster(at(width*u,y,.18),new THREE.Vector3(s,0,-c)).intersectObject(mesh)[0];
  assert.ok(hit,'Drumm Street ray must hit');return .18-hit.distance;
}
function height(u,d){
  return new THREE.Raycaster(at(u,2,-d),new THREE.Vector3(0,-1,0)).intersectObject(mesh)[0]?.point.y;
}
test('four glazed openings on both upper floors face Drumm and sit behind the masonry',()=>{
  const margin=.048,step=(1-margin*2)/4;
  for(const y of [.53,.79]){
    for(let i=0;i<4;i++)assert.ok(elevation(margin+step*(i+.5),y)<-.012);
    for(let i=1;i<4;i++)assert.ok(elevation(margin+step*i,y)>.003);
  }
  assert.equal(windows.length,8);
  assert.ok(windows.every(w=>Math.abs(w.ry-Math.atan2(-s,c))<.0001));
  assert.ok(elevation(.18,.675)>.004);
  assert.ok(elevation(.5,1.037)>.030);
});
test('the pedestrian entrance recess is left of the broad glazed storefront',()=>{
  assert.ok(elevation(.18,.15)<-.08);
  assert.ok(Math.abs(elevation(.76,.15)+.027)<.002);
  assert.ok(elevation(.035,.15)>-.002 && elevation(.98,.15)>-.002);
});
test('the roof rises behind the cornice then drops twice toward the widened rear wing',()=>{
  for(const [u,d,h] of [[.30,.025,1.044],[.30,.32,1.219],[.36,1.08,1.139],[-.12,1.98,.995],[.34,2.15,.995]]){
    assert.ok(Math.abs(height(u,d)-h)<.002,`roof at ${u}, ${d}`);
  }
  assert.equal(height(-.12,.9),undefined);
});
test('the colored facade and survey roof share one indexed mesh and leave adjoining buildings alone',()=>{
  assert.equal(root.children.length,1);
  assert.equal(mesh.material.vertexColors,true);
  assert.equal(mesh.geometry.attributes.position.count,mesh.geometry.attributes.color.count);
  assert.ok(mesh.geometry.index.count/3<1550);
  for(const id of [260288460,260288454])assert.equal(addDrummFrontage({id},root,windows),false);
  assert.equal(root.children.length,1);assert.equal(windows.length,8);
});
