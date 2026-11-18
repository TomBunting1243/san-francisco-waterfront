import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createStreetAmenities,restroomSites} from '../app/street-amenities.ts';
import {createMarketPaving} from '../app/market-paving.ts';

test('plaza unit occupies the aerial twin-lobed roof; Harrison matches its distinct surveyed footprint',()=>{
  const {root}=createStreetAmenities();root.updateMatrixWorld(true);
  const [pod,green]=root.children;
  const bounds=room=>{const fixed=room.children[0];fixed.geometry.computeBoundingBox();return fixed.geometry.boundingBox;};
  const p=bounds(pod),g=bounds(green);assert.ok(p.max.y>=3.8&&p.max.y<3.86);assert.ok(g.max.y>2.87&&g.max.y<2.96);
  assert.ok(Math.abs(pod.position.x+.353)<.005&&Math.abs(pod.position.z+7.855)<.005);
  assert.ok(Math.abs(green.position.x+43.54)<.005&&Math.abs(green.position.z+1.168)<.005);
  const roofX=new THREE.Vector3(1,0,0).applyQuaternion(pod.quaternion);assert.ok(roofX.z>.99);
  const ray=new THREE.Raycaster(new THREE.Vector3(pod.position.x,3,pod.position.z),new THREE.Vector3(0,-1,0));
  const land=ray.intersectObject(createMarketPaving())[0];assert.ok(land);assert.ok(Math.abs(land.point.y-pod.position.y)<.001);
  assert.equal(green.position.y,.11);
  const at=(x,z)=>{const point=pod.localToWorld(new THREE.Vector3(x,5,z));return new THREE.Raycaster(point,new THREE.Vector3(0,-1,0)).intersectObject(pod.children[0]).some(h=>h.point.y>pod.position.y+.22);};
  assert.equal(at(0,.83),false);assert.equal(at(.89,.83),true);
});

test('each accessible door opens before the visitor crosses, closes for privacy, and reopens on exit',()=>{
  const model=createStreetAmenities();
  for(const [i,room] of model.root.children.entries()){
    const offset=i?55:9;
    const set=t=>{model.update((137+t-offset)%137);model.root.updateMatrixWorld(true);};
    const ray=()=>{const point=room.localToWorld(new THREE.Vector3(0,1.05,2.4));
      return new THREE.Raycaster(point,new THREE.Vector3(0,0,-1).applyQuaternion(room.quaternion)).intersectObjects(room.children.slice(0,2)).map(h=>room.worldToLocal(h.point.clone()).z);};
    set(2);assert.ok(ray()[0]>.75);
    set(8);assert.ok(ray()[0]<0,'opening looks through to the vestibule back wall');
    assert.ok(room.children[2].visible);
    set(26);assert.ok(ray()[0]>.75);assert.equal(room.children[2].visible,false);
    set(44);assert.ok(ray()[0]<0);assert.ok(room.children[2].visible);
    set(52);assert.ok(ray()[0]>.75);assert.ok(room.children[2].position.z>4);
    set(80);assert.equal(room.children[2].visible,false);
  }
  assert.equal(restroomSites.length,2);
});
