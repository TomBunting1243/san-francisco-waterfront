import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {addOneSteuartLane} from '../app/one-steuart-lane.ts';
import {driverPose} from '../app/driver-rides.ts';

const xyz=(u,v,h)=>new THREE.Vector3(-27.00800104+.0012973094*u-.0084729829*v,.045+h*.06,-33.37263659+.0084728164*u+.0012965840*v);
const root=new THREE.Group(),panes=[];
assert.equal(addOneSteuartLane({id:193054135},root,panes),false);
assert.equal(addOneSteuartLane({id:667097308},root,panes),true);
const mesh=root.children[0];
function cast(from,to){return new THREE.Raycaster(from,to.clone().sub(from).normalize()).intersectObject(mesh)[0];}
test('2023 setback planes and lift enclosure replace the uniform OSM extrusion',()=>{
  assert.equal(root.children.length,1);
  assert.equal(mesh.name,'One Steuart Lane');
  const roof=(u,v)=>(cast(xyz(u,v,87),xyz(u,v,0)).point.y-.045)/.06;
  assert.ok(Math.abs(roof(2900,410)-70.95)<.001);
  assert.ok(Math.abs(roof(2840,355)-67.25)<.001);
  assert.ok(roof(2775,435)<22);
  assert.ok(roof(2900,560)<35);
  assert.ok(roof(2900,320)>55&&roof(2900,320)<60);
  assert.equal(cast(xyz(2900,298,80),xyz(2900,298,0)),undefined);
});
test('Howard has an inland recessed garage; the waterfront-facing door and terrace glazing recede behind their stone frame',()=>{
  const fromHoward=(u)=>cast(xyz(u,280,2),xyz(u,350,2)).distance;
  const fromLane=(v,h)=>cast(xyz(3130,v,h),xyz(3000,v,h)).distance;
  assert.ok(fromHoward(2773)>fromHoward(2905)+.12);
  assert.ok(fromLane(453,2)>fromLane(420,2)+.035);
  assert.ok(fromLane(352,5.8)>fromLane(352,10)+.096);
});
test('all occupied room rectangles sit on physical glass, including recessed terrace floors',()=>{
  assert.ok(panes.length>60&&panes.length<100);
  for(const p of panes){
    assert.ok(p.w>.03&&p.h>.10);
    const n=new THREE.Vector3(Math.sin(p.ry),0,Math.cos(p.ry));
    const pos=new THREE.Vector3(p.x,p.y,p.z);
    const hit=cast(pos.clone().addScaledVector(n,.006),pos.clone().sub(n));
    assert.ok(Math.abs(hit.distance-.00720)<.00005);
  }
});
test('the eastbound windshield sees the near Howard frontage before the waterfront turn',()=>{
  for(const [t,degrees,min,max] of [[300,20,3,3.25],[306,40,.70,.84]]){
    const {eye,look}=driverPose('bridge',t),a=Math.atan2(look.z-eye.z,look.x-eye.x)+degrees*Math.PI/180;
    const hit=new THREE.Raycaster(new THREE.Vector3(eye.x,eye.y,eye.z),new THREE.Vector3(Math.cos(a),0,Math.sin(a))).intersectObject(mesh)[0];
    assert.ok(hit.distance>min&&hit.distance<max);
  }
});
