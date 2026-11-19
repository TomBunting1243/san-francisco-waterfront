import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import {harborBuilding} from '../app/harbor-architecture.ts';
import {mappedBuildings} from '../app/sf-map.ts';
import {driverPose} from '../app/driver-rides.ts';
import fontData from '../app/harbor-font.json' with {type:'json'};

const record=mappedBuildings.find(b=>b.id===91913148);
const {root,windows}=harborBuilding(record,new FontLoader().parse(fontData));
const [a,b]=record.p,yaw=Math.atan2(b[1]-a[1],b[0]-a[0]),c=Math.cos(yaw),s=Math.sin(yaw);
const at=(u,y,v)=>new THREE.Vector3(a[0]+c*u-s*v,y,a[1]+s*u+c*v);
const into=new THREE.Vector3(-s,0,c),down=new THREE.Vector3(0,-1,0);
const mesh=root.children[0],ray=new THREE.Raycaster();
function front(u,y){
  ray.set(at(u,y,-.3),into);const hit=ray.intersectObject(mesh)[0];
  return hit?hit.distance-.3:Infinity;
}
function top(u,z){
  ray.set(at(u,2,z),down);return ray.intersectObject(mesh)[0]?.point.y;
}
test('the street face has a recessed steel entry, a lower rail arch, separate door lights and wood sash',()=>{
  assert.ok(front(1.81,.60)>.09&&front(1.81,.60)<.12,'upper arched steel glazing behind reveal');
  assert.ok(front(1.45,.70)<.005,'structural wall beyond the arch');
  assert.ok(front(.247,.302)>.09&&front(.247,.302)<.12,'segmental rail arch');
  assert.ok(front(.247,.37)<.005,'masonry between the singular rail opening and upstairs');
  assert.ok(front(3.152,.16)>.04&&front(3.152,.16)<.07,'recessed paired pedestrian door');
  assert.ok(front(3.208,.53)>.04&&front(3.208,.53)<.07,'separate recessed upper sash');
});
test('the lower flanks, raised gable and flagstaff follow the measured street elevation in one opaque batch',()=>{
  assert.ok(top(.16,.08)>.66&&top(.16,.08)<.71);
  assert.ok(top(1.89,.04)>.95&&top(1.89,.04)<1.02);
  assert.ok(top(1.922,.097)>1.43);
  assert.equal(root.children.length,1);
  assert.ok(mesh.castShadow&&mesh.receiveShadow&&!mesh.material.transparent);
  assert.ok(mesh.geometry.index.count/3<4500);
  assert.ok(windows.length>=20&&windows.every(w=>Math.cos(w.ry)<-.99));
});
test('the northbound streetcar approaches the anonymous ground-floor entries before passing Pier 5',()=>{
  const camera=new THREE.PerspectiveCamera(52,1280/760,.005,1800);
  const pose=driverPose('streetcar',49);
  camera.position.copy(pose.eye);camera.lookAt(pose.look.x,pose.look.y,pose.look.z);camera.updateMatrixWorld();
  const p=at(.247,.19,.12).project(camera),q=at(3.152,.16,.06).project(camera);
  assert.ok(p.z>0&&p.z<1&&q.z>0&&q.z<1);
  assert.ok(p.x>q.x&&p.x<1&&q.x>0);
});
