import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {sfMap} from '../app/sf-map.ts';
import {add300Mission} from '../app/300-mission.ts';

const b=sfMap.buildings.find(b=>b.id===256065251), root=new THREE.Group(),windows=[];
assert.ok(add300Mission(b,root,windows));
const mesh=root.children[0],[ox,oz]=b.p[3];
const w=Math.hypot(b.p[5][0]-ox,b.p[5][1]-oz), d=Math.hypot(b.p[2][0]-ox,b.p[2][1]-oz);
const c=(b.p[5][0]-ox)/w,s=(b.p[5][1]-oz)/w;
const world=(u,y,v)=>new THREE.Vector3(ox+c*u-s*v,y,oz+s*u+c*v);
const ray=new THREE.Raycaster();
const height=h=>.035+h*.06;
function near(a,b,tolerance=.0002){assert.ok(Math.abs(a-b)<tolerance,`${a} versus ${b}`);}
function roof(u,v){ray.set(world(u,8,v),new THREE.Vector3(0,-1,0));return ray.intersectObject(mesh)[0]?.point.y;}
test('the open roof deck, cooling well, six air handlers and pair of stacks have independent silhouettes',()=>{
  near(roof(.16,.22),height(89.55)); near(roof(.006,.5),height(91.12));
  near(roof(.55,.85),height(97.35));near(roof(2.05,.89),height(98.5));
  near(roof(3.06,1.28),height(95.35));
  for(const u of [3.19,3.55])near(roof(u,1.615),height(97.83)+.015);
  for(let i=0;i<6;i++)near(roof(.873+i*.166,1.454),height(100.68)+.015);
  near(roof(.39,1.12),height(105.1));near(roof(3.64,1.13),height(105.1));
});
test('both elevations have four projecting fins per structural bay above the recessed lobby',()=>{
  for(const [bays,length,onLong] of [[44,w,true],[24,d,false]]){
    const depth=(along,metres)=>{
      const start=onLong?world(along,height(metres),-.15):world(-.15,height(metres),d-along);
      const inward=onLong?new THREE.Vector3(-s,0,c):new THREE.Vector3(c,0,s);
      ray.set(start,inward);return ray.intersectObject(mesh)[0]?.distance;
    };
    for(let i=1;i<bays;i++){
      near(depth(i*length/bays,41),.139);
      near(depth((i+.5)*length/bays,41),.162,.0045);
    }
    near(depth(4*length/bays,2),.139);
    near(depth(5.5*length/bays,2),.214);
    if(!onLong)near(depth(11.5*length/bays,2),.282);
  }
});
test('paints and night panes use the actual smoked glass with a bounded daylight mesh',()=>{
  assert.equal(root.children.length,1);assert.ok(mesh.geometry.index.count/3<16000);
  assert.ok(windows.length>=95);
  for(const win of windows){
    const outward=new THREE.Vector3(Math.sin(win.ry),0,Math.cos(win.ry));
    const point=new THREE.Vector3(win.x,win.y,win.z);
    ray.set(point.addScaledVector(outward,.03),outward.negate());
    near(ray.intersectObject(mesh)[0]?.distance,.0318);
  }
  assert.equal(add300Mission({id:154217696,p:[]},root,windows),false);
});
