import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {busPose,createPromenadeTransit} from '../app/promenade-transit.ts';

test('the coach approaches the mapped Steuart terminal along the lane, dwells and accelerates away',()=>{
  const stop=busPose(0),before=busPose(-2),later=busPose(31+2);
  assert.ok(before.x<stop.x&&later.x>stop.x);
  for(const t of [1,14,30])assert.deepEqual([busPose(t).x,busPose(t).z],[stop.x,stop.z]);
  for(const t of [-.01,.01,30.99,31.01]){
    const p=busPose(t);assert.ok(Math.hypot(p.x-stop.x,p.z-stop.z)<.0001);
  }
  assert.ok(Math.abs(later.yaw-stop.yaw)<.08&&Math.abs(before.yaw-stop.yaw)<.15);
});

test('passengers pass through actual open coach doors at the curb and travel between the sidewalk and vehicle',()=>{
  const scene=createPromenadeTransit(),coach=scene.poses.getObjectByName('2 Sutter coach 1');
  const waiting=scene.poses.getObjectByName('Boarding passenger'),leaving=scene.poses.getObjectByName('Alighting passenger');
  const batch=scene.root.children[0];assert.ok(batch.isBatchedMesh);assert.equal(scene.root.children.length,1);
  const allParts=[];scene.poses.traverse(o=>{if(o.isMesh)allParts.push(o);});
  const coachIds=new Set();coach.traverse(o=>{if(o.isMesh)coachIds.add(allParts.indexOf(o));});
  const set=t=>{scene.update(t);scene.root.updateMatrixWorld(true);};
  const ray=x=>{
    const emitter=coach.localToWorld(new THREE.Vector3(x,1.65,3));
    return new THREE.Raycaster(emitter,new THREE.Vector3(0,0,-1).applyQuaternion(coach.quaternion)).intersectObject(batch).filter(h=>coachIds.has(h.batchId)).map(h=>coach.worldToLocal(h.point.clone()).z);
  };
  set(0);assert.ok(ray(4.59)[0]<0&&ray(-1.93)[0]<0);
  assert.ok(waiting.visible&&leaving.visible);
  set(11);const wait=coach.worldToLocal(waiting.position.clone());assert.ok(wait.z>2.4);
  set(14.8);const boarding=coach.worldToLocal(waiting.position.clone());assert.ok(Math.abs(boarding.x-4.59)<.02&&boarding.z<1.25&&boarding.z>.8);
  set(23);assert.equal(waiting.visible,false);assert.equal(leaving.visible,false);assert.ok(ray(4.59)[0]>1);
  set(28);assert.ok(busPose(35).x>busPose(31).x);
  let meshes=0,triangles=0;scene.root.traverseVisible(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});
  assert.equal(meshes,1);assert.ok(triangles<20000);
  const sheltered=scene.poses.getObjectByName('Steuart and Mission sheltered terminal'),bare=scene.poses.getObjectByName('2 Sutter terminal at Steuart and Don Chee');
  assert.equal(sheltered.children.length,2);assert.equal(bare.children.length,1);assert.equal(bare.position.y,.045);
});
