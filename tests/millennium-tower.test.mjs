import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {addMillenniumTower} from '../app/millennium-tower.ts';

const map=JSON.parse(readFileSync(new URL('../public/data/sf-waterfront.json',import.meta.url)));
function model(id){
  const root=new THREE.Group(),windows=[];
  assert.ok(addMillenniumTower(map.buildings.find(b=>b.id===id),root,windows));
  return {mesh:root.children[0],windows,root};
}
const tower=model(72963089),lofts=model(73348851);
const angle=Math.atan2(-.316,2.23),c=Math.cos(angle),s=Math.sin(angle);
const at=(u,y,v)=>new THREE.Vector3(-20.682+u*c-v*s,y,-32.585+u*s+v*c);
const down=new THREE.Vector3(0,-1,0);
function roof(mesh,u,v){
  return new THREE.Raycaster(at(u,14,v),down).intersectObject(mesh)[0]?.point.y;
}
function roofRange(mesh,u,v){
  const hits=[];
  for(let i=-2;i<=2;i++)for(let j=-2;j<=2;j++)hits.push(roof(mesh,u+i*.009,v+j*.009)??0);
  return [Math.min(...hits),Math.max(...hits)];
}
test('two perforated crown wings climb toward opposite corners above the open mechanical slot',()=>{
  const mesh=tower.mesh;
  const [deck1,wing1]=roofRange(mesh,.28,1.48),[deck2,wing2]=roofRange(mesh,2.62,.62);
  assert.ok(wing1>11.45 && deck1<11.1);
  assert.ok(wing2>11.55 && deck2<11.1);
  assert.ok(roof(mesh,1.30,.90)>11.15 && roof(mesh,1.30,.90)<11.28);
  assert.ok(roof(mesh,2.52,1.68)<10.85 && roof(mesh,.25,.27)<10.85);
  mesh.geometry.computeBoundingBox();
  assert.ok(mesh.geometry.boundingBox.max.y>12 && mesh.geometry.boundingBox.max.y<12.15);
});
test('a canopy projects beyond recessed street glazing and faceted tower walls',()=>{
  const direction=new THREE.Vector3(-s,0,c);
  const wall=y=>new THREE.Raycaster(at(1.3,y,-1),direction).intersectObject(tower.mesh)[0].distance;
  assert.ok(wall(.23)>wall(2)+.075);
  assert.ok(wall(.37)<wall(2)-.021);
  const near=roof(tower.mesh,.88,1.955);
  assert.ok(near===undefined || near<10.84);
});
test('the low pitched glass atrium, service roof and apartment bar occupy distinct portions of the lofts footprint',()=>{
  assert.ok(roof(lofts.mesh,.4,2.5)>.92 && roof(lofts.mesh,2.6,2.5)<.68);
  assert.ok(Math.abs(roof(lofts.mesh,1.6,3.14)-.641)<.002);
  assert.ok(Math.abs(roof(lofts.mesh,1.5,3.85)-2.64)<.002);
  assert.ok(Math.abs(roof(lofts.mesh,1.40,4.45)-2.41)<.002);
  assert.ok(Math.abs(roof(lofts.mesh,1.4,5.01)-2.82)<.002);
});
test('the two independent mapped footprints produce indexed colored meshes within the draw budget',()=>{
  for(const [m,limit] of [[tower,6000],[lofts,2100]]){
    assert.equal(m.root.children.length,1);assert.ok(m.mesh.geometry.index.count/3<limit);
    assert.equal(m.mesh.material.vertexColors,true);
    assert.equal(m.mesh.geometry.attributes.position.count,m.mesh.geometry.attributes.color.count);
    assert.ok(m.windows.length>70 && m.windows.every(w=>Number.isFinite(w.ry)&&w.w>0&&w.h>0));
  }
  const g=new THREE.Group(),w=[];
  assert.equal(addMillenniumTower({id:542375290},g,w),false);
  assert.equal(g.children.length,0);assert.equal(w.length,0);
});
