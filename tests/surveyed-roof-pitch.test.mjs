import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import survey from '../public/data/roof-pitches.json' with {type:'json'};
import {sfMap} from '../app/sf-map.ts';
import {surveyedPitchGeometry,surveyedRoofPitch} from '../app/surveyed-roof-pitch.ts';

const rectangle=[[-2,-1],[2,-1],[2,1],[-2,1],[-2,-1]];
function skin(plan,planes,eave){
  return new THREE.Mesh(surveyedPitchGeometry(plan,{x:0,z:0,planes,eave},'#cbc3af','#97a3a5'),new THREE.MeshBasicMaterial());
}
function elevation(mesh,x,z){
  return new THREE.Raycaster(new THREE.Vector3(x,15,z),new THREE.Vector3(0,-1,0)).intersectObject(mesh)[0]?.point.y;
}
test('gable halves meet at the actual off-center ridge with only perimeter wall infill',()=>{
  const mesh=skin(rectangle,[[.5,0,3],[-.25,0,3.3]],2);
  for(const z of [-.93,0,.96])for(const x of [-1.98,-.76,.38,.4,.42,1.99]){
    assert.ok(Math.abs(elevation(mesh,x,z)-Math.min(3+.5*x,3.3-.25*x))<1e-5);
  }
  // A ray starting inside the roof volume at the ridge would strike a spurious internal wall.
  const ray=new THREE.Raycaster(new THREE.Vector3(-.6,2.5,0),new THREE.Vector3(1,0,0),0,.998);
  mesh.material.side=THREE.DoubleSide;assert.equal(ray.intersectObject(mesh).length,0);
  const p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal;
  for(let i=0;i<p.count;i+=3)if(Math.abs(n.getY(i))<1e-6){
    const x=[0,1,2].map(j=>p.getX(i+j)),z=[0,1,2].map(j=>p.getZ(i+j));
    assert.ok(x.every(k=>k===-2)||x.every(k=>k===2)||z.every(k=>k===-1)||z.every(k=>k===1));
  }
});
test('single-plane roof preserves a re-entrant footprint in either winding direction',()=>{
  const plan=[[-2,-1],[2,-1],[2,0],[0,0],[0,1],[-2,1]];
  for(const points of [plan,[...plan].reverse()]){
    const mesh=skin(points,[[.2,.05,2]],1.55);
    assert.equal(elevation(mesh,1,.6),undefined);
    assert.ok(Math.abs(elevation(mesh,-1,.4)-1.82)<1e-5);
    assert.equal(mesh.geometry.userData.paintVertices,true);
    assert.equal(mesh.geometry.attributes.color.count,mesh.geometry.attributes.position.count);
  }
});
test('stored fits retain direct sample support and reject incompatible building heights',()=>{
  assert.ok(survey.source.includes('CA_SanFrancisco_1_B23')&&survey.cellMetres===1.5);
  const stored=Object.entries(survey.pitches);
  assert.ok(stored.some(([,r])=>r[2].length===2)&&stored.some(([,r])=>r[2].length===1));
  for(const [id,[x,z,planes,samples,error]] of stored){
    const b=sfMap.buildings.find(b=>String(b.id)===id),pitch=surveyedRoofPitch(b,b.h);
    assert.ok(pitch&&samples>=30&&error<.5);
    assert.equal(surveyedRoofPitch({...b,measured:true},1000),undefined);
    assert.equal(surveyedRoofPitch({...b,part:true},b.h),undefined);
    const mesh=new THREE.Mesh(surveyedPitchGeometry(b.p,pitch,'#aaa','#777'),new THREE.MeshBasicMaterial());
    const observed=elevation(mesh,x,z);
    if(observed!==undefined)assert.ok(Math.abs(observed-Math.min(...planes.map(p=>p[2])))<1e-4);
    assert.ok(pitch.eave>0);
  }
});
