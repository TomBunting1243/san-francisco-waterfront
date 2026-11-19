import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import {harborBuilding} from '../app/harbor-architecture.ts';
import {mappedBuildings} from '../app/sf-map.ts';
import {pierOneHalfPassageHeight} from '../app/central-pier-bulkhead.ts';
import {driverPose,washingtonRideArrival} from '../app/driver-rides.ts';
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
  assert.ok(front(1.81,.17)>.30&&front(1.81,.17)<.327,'paired doors sit deeper than the overhead fanlight');
  assert.ok(front(1.45,.70)<.005,'structural wall beyond the arch');
  assert.ok(front(.247,.302)>.09&&front(.247,.302)<.12,'segmental rail arch');
  assert.ok(front(.247,.37)<.005,'masonry between the singular rail opening and upstairs');
  assert.ok(front(3.152,.16)>.114&&front(3.152,.16)<.132,'recessed paired pedestrian door');
  assert.ok(front(3.208,.53)>.07&&front(3.208,.53)<.09,'separate recessed upper sash');
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
  // This frontage is on the Washington–Broadway leg. Anchor the observation
  // to the Washington call so a change to an earlier stop cannot move the eye.
  const pose=driverPose('streetcar',washingtonRideArrival+16.75);
  camera.position.copy(pose.eye);camera.lookAt(pose.look.x,pose.look.y,pose.look.z);camera.updateMatrixWorld();
  const p=at(.247,.19,.12).project(camera),q=at(3.152,.16,.06).project(camera);
  assert.ok(p.z>0&&p.z<1&&q.z>0&&q.z<1);
  assert.ok(p.x>q.x&&p.x<1&&q.x>0);
});

test('the two riverboat piers share one pavilion, with three open passageways and three recessed southern storefronts',()=>{
  const b=mappedBuildings.find(q=>q.id===25489470);
  const {root,windows}=harborBuilding(b,new FontLoader().parse(fontData));
  const mesh=root.children[0],dir=new THREE.Vector3(0,0,1);
  function depth(x,y){
    ray.set(new THREE.Vector3(x,y,-2),dir);return ray.intersectObject(mesh)[0]?.point.z??Infinity;
  }
  // Reconstruct four eye-height rays from the evening streetcar side window.
  // An arch hole cut below the masonry polygon used to triangulate as a solid face here.
  const seatedEye=new THREE.Vector3(16.27975,.186,-3.53445);
  for(const x of [16.35,16.43,16.535,16.637]){
    const aperture=new THREE.Vector3(x,.212,-1.794);
    ray.set(seatedEye,aperture.sub(seatedEye).normalize());
    const hit=ray.intersectObject(mesh)[0];
    assert.ok(!hit||hit.point.z> -1.40,'streetcar sees into the recessed passway');
  }
  for(const x of [14.32,16.515,20.378])assert.ok(depth(x,.17)>-1.0,'open walk through portal at '+x);
  for(const x of [14.915,15.470,16.015])assert.ok(depth(x,.195)>-1.72&&depth(x,.195)<-1.57,'interior behind original segmental storefront at '+x);
  assert.ok(depth(18.47,.25)>-1.68,'lower vestibule is deeper than the arch');
  assert.ok(depth(18.47,.67)<-1.66,'fanlight above the deep doors');
  const top=(x,z)=>{ray.set(new THREE.Vector3(x,2,z),down);return ray.intersectObject(mesh)[0]?.point.y;};
  assert.ok(top(18.368,-1.75)>.90&&top(16.35,-1.68)<.74);
  assert.ok(top(18.27,.12)>top(17.35,.12)+.09,'freight monitor rises above shed');
  assert.ok(top(15.26,.825)>.265&&top(15.26,1.175)<.12,'canopy and open-air terrace occupy separate parts of the short pier');
  assert.equal(root.children.length,1);assert.ok(mesh.geometry.index.count/3<9000);
  assert.ok(windows.filter(p=>p.ry===Math.PI).length>=30&&windows.filter(p=>p.ry===0).length>10);
  assert.ok(mesh.userData.uplight(new THREE.Vector3(16.245,.65,-1.80),new THREE.Vector3(0,0,-1))>.35);
});

test('the waiting-room approach is continuously supported from the promenade into the public breezeway',()=>{
  const {root}=harborBuilding(mappedBuildings.find(q=>q.id===25489470),new FontLoader().parse(fontData));
  const mesh=root.children[0];
  for(const dx of [-.210,-.05,0,.05,.210]){
    for(let j=1;j<17;j++){
      const x=16.515+dx,z=-1.990+j*(.365/17);
      ray.set(new THREE.Vector3(x,.20,z),down);
      const sole=ray.intersectObject(mesh)[0];
      assert.ok(sole&&Math.abs(sole.point.y-pierOneHalfPassageHeight(x,z))<.00005,'joined ramp and tapered cheeks');
    }
  }
  for(let i=0;i<100;i++){
    const x=i<50?16.515:16.515-(i-50)/49*1.065;
    const z=i<50?-1.625+i/49*.580:-1.045;
    for(const offset of [-.045,0,.045]){
      const px=x+(i<50?offset:0),pz=z+(i>=50?offset:0);
      ray.set(new THREE.Vector3(px,.235,pz),down);
      assert.ok(Math.abs(ray.intersectObject(mesh)[0]?.point.y-.060)<.00005,'clear walk under the covered passage');
    }
  }
});
