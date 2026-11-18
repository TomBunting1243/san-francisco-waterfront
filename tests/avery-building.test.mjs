import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {addAveryBuilding} from '../app/avery-building.ts';

const data=JSON.parse(readFileSync(new URL('../public/data/sf-waterfront.json',import.meta.url)));
const find=id=>data.buildings.find(b=>b.id===id);
const building=find(945194177),root=new THREE.Group(),windows=[];
assert.ok(addAveryBuilding(building,root,windows));
const [mesh]=root.children;
const mix=(a,b,t)=>a.map((x,i)=>x+(b[i]-x)*t);
function point(u,v){
  const [a,b,c,d,e]=building.p;
  return mix(mix(a,e,u),u<.53?mix(b,c,u/.53):mix(c,d,(u-.53)/.47),v);
}
function ray(u,v,h,direction){
  const [x,z]=point(u,v),from=new THREE.Vector3(x,h,z);
  return new THREE.Raycaster(from,direction).intersectObject(mesh)[0]?.point;
}
const down=new THREE.Vector3(0,-1,0),up=new THREE.Vector3(0,1,0);
test('only the measured tower part is consumed, beginning at the mapped podium roof',()=>{
  assert.equal(addAveryBuilding(find(693629257),root,windows),false);
  assert.equal(addAveryBuilding(find(945194181),root,windows),false);
  mesh.geometry.computeBoundingBox();
  assert.ok(Math.abs(mesh.geometry.boundingBox.min.y-building.minH)<1e-5);
  assert.ok(Math.abs(mesh.geometry.boundingBox.max.y-building.h)<1e-5);
});
test('south upper terraces retreat toward one corner above floor 33',()=>{
  const ledges=[.98,.92,.86,.80,.70].map(u=>ray(u,.96,13,down).y);
  for(let i=1;i<ledges.length;i++)assert.ok(ledges[i]-ledges[i-1]>.85);
  assert.ok(ledges[0]>6.4 && ledges[0]<7.1);
  assert.ok(ray(.96,.06,13,down).y>10.9);
});
test('lower north overhangs expose their undersides above the podium',()=>{
  const projection=ray(.08,.04,building.minH+.04,up);
  assert.ok(projection && projection.y>3.4 && projection.y<5);
  assert.ok(Math.abs(ray(.08,.94,.2,up).y-building.minH)<1e-5);
});
test('the parapet surrounds recessed roof and plant housing; glazing batches preserve export colors',()=>{
  const main=ray(.28,.50,13,down).y,plant=ray(.48,.50,13,down).y;
  assert.ok(plant-main>.075 && plant<building.h-.02);
  assert.equal(root.children.length,1);
  assert.ok(mesh.geometry.index.count/3<16000);
  assert.equal(mesh.material.vertexColors,true);
  assert.equal(mesh.geometry.attributes.position.count,mesh.geometry.attributes.color.count);
  assert.ok(windows.length>200 && windows.every(w=>Number.isFinite(w.ry)&&w.w>0&&w.h>0));
});
