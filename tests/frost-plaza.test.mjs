import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {addFrostPlaza,frostPlazaPhoto} from '../app/frost-plaza.ts';
import {frostWalkHeight,frostBrickTriangles} from '../app/california-sidewalk.ts';
import {createCaliforniaCar} from '../app/california-terminal.ts';

function scene(){
  const root=new THREE.Group(),model=addFrostPlaza(root);
  root.updateMatrixWorld(true);
  const {artwork,pose}=frostPlazaPhoto;
  const origin=new THREE.Vector3(artwork.x,artwork.y,artwork.z);
  const normal=new THREE.Vector3(Math.sin(pose.yaw),0,Math.cos(pose.yaw));
  const right=new THREE.Vector3(normal.z,0,-normal.x);
  function across(x,y){
    const start=origin.clone().addScaledVector(normal,.2).addScaledVector(right,x*.06);
    start.y+=y*.06;
    return new THREE.Raycaster(start,normal.clone().negate(),0,.245).intersectObject(model)[0];
  }
  return {root,model,origin,right,normal,across};
}

test('Heart SF has a photographed through-opening, flanking white letters and a tapered grounded seat plinth',()=>{
  const {root,model,across,right,normal,origin}=scene();
  const color=hit=>new THREE.Color().fromBufferAttribute(model.geometry.attributes.color,hit.face.a).getHexString();
  assert.equal(root.children.length,1);
  assert.ok(model.geometry.index.count/3<2500);
  assert.equal(across(0,1.2),undefined);
  assert.equal(color(across(0,.45)),'b52b38');
  for(const x of [-1.43,1.01])assert.equal(color(across(x,.72)),'eeece0');
  assert.equal(color(across(0,.15)),'3e548b');
  const w=[],h=[],v=new THREE.Vector3(),pos=model.geometry.attributes.position;
  for(let i=0;i<pos.count;i++){
    v.fromBufferAttribute(pos,i).sub(origin);
    if(Math.abs(v.dot(normal))>.05)continue;
    w.push(v.dot(right)/.06);h.push(v.y/.06);
  }
  assert.ok(Math.abs((Math.max(...w)-Math.min(...w))-16*.3048)<.001);
  assert.ok(Math.abs(Math.max(...h)-7*.3048)<.016);
  assert.ok(Math.abs(Math.min(...h))<1e-6);
});

test('a photographer on the brick landing can see the waiting car through the heart',()=>{
  const {model,origin,normal}=scene(),{pose,photographer}=frostPlazaPhoto;
  const {car}=createCaliforniaCar();
  const camera=new THREE.Vector3(photographer.x,photographer.y+1.55*.06,photographer.z);
  const end=car.position.clone();end.y+=1.75*.06;
  const ray=new THREE.Raycaster(camera,end.clone().sub(camera).normalize());
  assert.equal(ray.intersectObject(model).length,0);
  car.updateMatrixWorld(true);assert.ok(ray.intersectObject(car).length);
  for(const p of [pose,photographer]){
    assert.equal(p.y,frostWalkHeight(p.x,p.z)+.00035);
    assert.ok(frostBrickTriangles.some(t=>THREE.Triangle.containsPoint(
      new THREE.Vector3(p.x,0,p.z),...t.map(([x,z])=>new THREE.Vector3(x,0,z)))));
    const foot=new THREE.Raycaster(new THREE.Vector3(p.x,p.y+.1,p.z),new THREE.Vector3(0,-1,0));
    assert.equal(foot.intersectObject(model).length,0);
  }
  const surveyedStub=new THREE.Vector3(-1.7333,origin.y,-17.9946);
  assert.ok(origin.clone().sub(surveyedStub).dot(normal)>.27);
  assert.ok(car.position.distanceTo(origin)>1.25);
});

test('the timber-topped seats and separate mint planter stand on the Market tree-side landing',()=>{
  const {model}=scene(),v=new THREE.Vector3(0,-1,0);
  for(const [x,z,h] of [[-1.914-.86*.06,-16.53+.10*.06,.438],[-1.914,-16.53-.42*.06,.828],[-2.072+.025,-16.735,.73]]){
    const hit=new THREE.Raycaster(new THREE.Vector3(x,1,z),v).intersectObject(model)[0];
    assert.ok(hit&&Math.abs(hit.point.y-frostWalkHeight(x,z)-.00035-h*.06)<.001);
  }
});
