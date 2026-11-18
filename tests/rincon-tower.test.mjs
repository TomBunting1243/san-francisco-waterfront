import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {addRinconTower} from '../app/rincon-tower.ts';

const sf=JSON.parse(readFileSync(new URL('../public/data/sf-waterfront.json',import.meta.url)));
const b=sf.buildings.find(b=>b.id===944990390),root=new THREE.Group(),windows=[];
assert.equal(addRinconTower(b,root,windows),true);
const [mesh]=root.children;
function hit(x,y,z,dx,dy,dz){
  return new THREE.Raycaster(new THREE.Vector3(x,y,z),new THREE.Vector3(dx,dy,dz).normalize()).intersectObject(mesh)[0];
}
function height(x,z){
  return hit(x,15,z,0,-1,0)?.point.y/.06;
}
test('the South Tower owns one mesh above the mapped podium and the Harrison remains a separate tower',()=>{
  assert.equal(addRinconTower(sf.buildings.find(b=>b.id===944990391),root,windows),false);
  assert.equal(addRinconTower(sf.buildings.find(candidate=>candidate.id===b.parent),root,windows),false);
  mesh.geometry.computeBoundingBox();
  assert.ok(Math.abs(mesh.geometry.boundingBox.min.y-b.minH)<.00001);
  assert.ok(Math.abs(mesh.geometry.boundingBox.max.y/.06-184.2)<.001);
  assert.equal(root.children.length,1);
});
test('the roof steps back from the northeast edge to the oval mechanical screen',()=>{
  // Figure 5 and the 2023 USGS surface, with a common 32 m local grade.
  assert.ok(Math.abs(height(-56.76874,-31.97358)-151.4)<.1);
  assert.ok(Math.abs(height(-55.83532,-33.44664)-171.2)<.1);
  assert.ok(Math.abs(height(-56.91868,-32.98236)-180.2)<.1);
  const tank=height(-57.52972,-33.01284);
  assert.ok(tank>181 && tank<182);
  // The rim intercepts a horizontal ray above the roof deck from the opening.
  assert.ok(hit(-50,182*.06,-30,-6.8,0,-3));
  assert.equal(hit(-50,185*.06,-30,-6.8,0,-3),undefined);
});
test('the Ferry-facing shaft and projecting end balconies intercept exterior rays',()=>{
  const rowBottom=.6+(151.4*.06-.6)*20/48;
  const direction=new THREE.Vector3(-.989,0,.147);
  const balconyRay=h=>hit(-55.00,rowBottom+h,-33.245,direction.x,0,direction.z);
  const rail=balconyRay(.042),glass=balconyRay(.12);
  assert.ok(rail && glass && glass.distance-rail.distance>.05);
  const first=hit(49,8.5,17,-105.8,0,-50);
  assert.ok(first && first.point.x>-56.8);
  for(const w of windows.filter((_,i)=>i%11===0)){
    const nx=Math.sin(w.ry),nz=Math.cos(w.ry);
    const pane=hit(w.x+nx*.009,w.y,w.z+nz*.009,-nx,0,-nz);
    assert.ok(pane && pane.distance<.03);
  }
});
test('floor glazing, the pale southwest grid and mechanical cap share one colored triangle batch',()=>{
  assert.ok(mesh.geometry.index.count/3<17000);
  assert.equal(mesh.geometry.attributes.color.count,mesh.geometry.attributes.position.count);
  assert.equal(mesh.geometry.userData.paintVertices,true);
  assert.ok(windows.length>200 && windows.every(w=>w.w>0 && w.h>0 && w.y<171.2*.06));
});
