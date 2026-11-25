import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {add180Howard} from '../app/180-howard.ts';
import {driverPose} from '../app/driver-rides.ts';

test('180 Howard claims its own parcel, with measured roof planes and real passenger-visible walls',()=>{
  const root=new THREE.Group(),windows=[];
  assert.equal(add180Howard({id:154217696},root,windows),false);
  assert.equal(root.children.length,0);
  assert.equal(add180Howard({id:192026934},root,windows),true);
  assert.equal(root.children.length,1);
  const ray=new THREE.Raycaster(),model=root.children[0];
  function hit(origin,direction){
    ray.set(origin,direction.normalize());return ray.intersectObject(model)[0];
  }
  for(const [x,z,y] of [[-24.4,-17.5,3.234],[-23.65,-18.48,2.94]]){
    const roof=hit(new THREE.Vector3(x,5,z),new THREE.Vector3(0,-1,0));
    assert.ok(Math.abs(roof.point.y-y)<.001);
    assert.ok(roof.face.normal.y>.99);
  }
  const {eye,look}=driverPose('bridge',280);
  const angle=Math.atan2(look.z-eye.z,look.x-eye.x)-35*Math.PI/180;
  const wall=hit(new THREE.Vector3(eye.x,eye.y,eye.z),new THREE.Vector3(Math.cos(angle),0,Math.sin(angle)));
  // Test the surveyed Main elevation itself. Moving the passenger into the
  // correct through lane changes the seat-to-glass distance.
  const start=new THREE.Vector3(-25.82810,eye.y,-18.40610);
  const edge=new THREE.Vector3(2.35587,0,-.34663),span=edge.length();
  const along=edge.normalize(),out=new THREE.Vector3(along.z,0,-along.x);
  const fromCorner=wall.point.clone().sub(start);
  assert.ok(fromCorner.dot(along)>0&&fromCorner.dot(along)<span);
  assert.ok(Math.abs(fromCorner.dot(out)+.046)<.002);
  assert.ok(wall.face.normal.dot(out)>.99);
  for(const w of windows){
    // Each inset night pane sits just in front of its own outward-facing glass.
    const dir=new THREE.Vector3(Math.sin(w.ry),0,Math.cos(w.ry));
    const wall=hit(new THREE.Vector3(w.x,w.y,w.z).addScaledVector(dir,.012),dir.clone().negate());
    assert.ok(Math.abs(wall.distance-.0135)<.0001);
    assert.ok(w.w>.07&&w.w<.083);
  }
  assert.ok(windows.length>=80&&windows.length<=96);
});
