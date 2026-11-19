import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {addCaliforniaCenter} from '../app/california-center.ts';

const root=new THREE.Group(),lights=[];
assert.equal(addCaliforniaCenter({id:588355355},root,lights),true);
const y=h=>.045+(h-4.57)*.06;
const at=(u,h,v)=>new THREE.Vector3(3.63+.46132*u+.88723*v,h,-39.678-.88723*u+.46132*v);
const ray=new THREE.Raycaster();
function cast(o,d){ray.set(o,d.clone().normalize());return ray.intersectObjects(root.children)[0];}
const top=(u,v)=>cast(at(u,18,v),new THREE.Vector3(0,-1,0))?.point.y;
const near=(a,b,t=.003)=>assert.ok(Math.abs(a-b)<t,`expected ${b}, saw ${a}`);
test('a 19 m podium supports the hex office roof and two oblique hotel wings',()=>{
  near(top(.27,.21),y(23.4));near(top(2.48,.33),y(144.8));
  near(top(2.48,.50),y(151.2));near(top(2.48,.74),y(158.3));
  near(top(.85,1.29),y(188.2));near(top(4.12,1.29),y(188.2));
  near(top(1.88,1.17),y(193.5));near(top(3.11,1.17),y(193.5));
});
test('crown keeps open sky above nine floor bridges and carries paired stepped flagpoles',()=>{
  const dir=at(0,0,-1).sub(at(0,0,0));
  const base=y(158.3),pitch=(y(188.2)-base)/9;
  for(let j=0;j<9;j++){
    const panel=cast(at(2.492,base+(j+.55)*pitch,3),dir);
    near(panel.distance,3-1.373);
    const band=cast(at(2.492,base+j*pitch+.016,3),dir);
    near(band.distance,3-1.387);
  }
  near(top(2.49,1.29),y(188.2)-.005);
  for(const u of [2.30,2.69]){
    near(top(u,1.29),.045+220.98*.06);
    near(top(u+.051,1.29),y(212.2),.002);
    near(top(u+.096,1.29),y(204.6));
  }
});
test('square signature panes recess behind the office granite and locate night inserts',()=>{
  const dir=at(0,0,-1).sub(at(0,0,0)),pitch=(4.64-.98-(.34+.98))/10;
  const u=4.64-.98-pitch/2,floor=(y(144.8)-y(23.4))/31;
  for(let j=0;j<31;j++){
    const mid=y(23.4)+(j+.5)*floor;
    const pane=cast(at(u,mid,3),dir).distance;
    near(pane,3-2.27+.009);
    near(cast(at(u,mid+.0685,3),dir).distance,3-2.27+.0007);
  }
  assert.ok(lights.length>100&&lights.length<170);
  for(const lamp of lights)assert.ok(lamp.w>0&&lamp.h>0&&Number.isFinite(lamp.ry));
});
test('California brass doors and paving stay in the public entry throat and clear both neighbors',()=>{
  near(top(2.24,4.08),.051);
  assert.equal(top(1.89,3.55),undefined);assert.equal(top(2.66,3.55),undefined);
  near(cast(at(2.30,.18,2.46),at(0,0,-1).sub(at(0,0,0))).distance,.31);
  assert.equal(addCaliforniaCenter({id:944032191},root,lights),false);
  assert.equal(root.children.length,1);
  const geometry=root.children[0].geometry;
  assert.ok(geometry.index.count/3<11000);
  assert.ok(geometry.attributes.position.array.every(Number.isFinite));
});
