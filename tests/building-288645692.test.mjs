import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import city from '../public/data/sf-waterfront.json' with {type:'json'};
import {add388Beale} from '../app/building-288645692.ts';

const angle=Math.atan2(-.1583,.9874),c=Math.cos(angle),s=Math.sin(angle);
const world=(u,v,h)=>new THREE.Vector3(-47.5+.06*(u*c-v*s),.04+.06*h,-24.6+.06*(u*s+v*c));
function make(){
  const root=new THREE.Group(),windows=[];
  assert.equal(add388Beale(city.buildings.find(b=>b.id===288645692),root,windows),true);
  assert.equal(add388Beale(city.buildings.find(b=>b.id===260318167),root,windows),false);
  return {root,windows};
}
test('the single mapped envelope contains two separate terraced towers and a low courtyard entrance',()=>{
  const {root}=make();
  const roofAt=(x,z)=>{
    const hit=new THREE.Raycaster(world(x,z,95),new THREE.Vector3(0,-1,0)).intersectObject(root)[0];
    return hit?(hit.point.y-.04)/.06:null;
  };
  // Points on the survey: two peak returns, upper roofs, outer setback,
  // pitched Beale portal and the open court behind its frontage.
  for(const [x,z,min,max] of [[20,1.5,72,75],[-25,1.5,72,75],[18,3,65,67],[-25,3,65,67],
    [9,0,58,61],[38,18,46,49],[-2,14,18,20],[0,-9,12,14]]){
    const h=roofAt(x,z);assert.ok(h>=min&&h<=max,`(${x},${z}) measured ${h} m`);
  }
  assert.equal(roofAt(0,23),null);
  const fromBeale=(x,h)=>23-new THREE.Raycaster(world(x,23,h),new THREE.Vector3(s,0,-c)).intersectObject(root)[0].distance/.06;
  assert.ok(fromBeale(-2,4)>18,'glazed entrance is reachable from Beale');
  const throughCourt=new THREE.Raycaster(world(-2,28,35),new THREE.Vector3(s,0,-c),0,3);
  assert.equal(throughCourt.intersectObject(root).length,0,'air separates the upper wings');
});
test('visible balcony fronts stand away from the back glazing and night planes face outwards',()=>{
  const {root,windows}=make();
  const toward=new THREE.Vector3(s,0,-c),hits=new THREE.Raycaster(world(13,22,15.65),toward).intersectObject(root);
  assert.ok(hits.length>1);
  const depths=[...new Set(hits.map(hit=>Math.round((22-hit.distance/.06)*100)/100))];
  assert.ok(depths[0]-depths[1]>1.6,'physical balcony slab extends past the glazing');
  assert.ok(windows.length>90&&windows.length<190);
  for(const w of windows){
    const n=new THREE.Vector3(Math.sin(w.ry),0,Math.cos(w.ry));
    const from=new THREE.Vector3(w.x,w.y,w.z).addScaledVector(n,.002);
    assert.ok(new THREE.Raycaster(from,n.negate(),0,.011).intersectObject(root).length>0);
  }
  assert.equal(root.children.length,1);
  const mesh=root.children[0];assert.ok(mesh.geometry.index.count/3<15500);
  assert.equal(mesh.geometry.groups.length,0);assert.ok(mesh.material.vertexColors);
});
