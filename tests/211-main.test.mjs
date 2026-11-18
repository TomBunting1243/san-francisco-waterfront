import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {sfMap} from '../app/sf-map.ts';
import {add211Main} from '../app/211-main.ts';

const b=sfMap.buildings.find(b=>b.id===154217696),root=new THREE.Group(),lights=[];
assert.ok(add211Main(b,root,lights));
const o=b.p[7],n=b.p[0],W=Math.hypot(n[0]-o[0],n[1]-o[1]),D=Math.hypot(b.p[5][0]-o[0],b.p[5][1]-o[1]);
const ux=(n[0]-o[0])/W,uz=(n[1]-o[1])/W;
const at=(u,y,v)=>new THREE.Vector3(o[0]+ux*u-uz*v,y,o[1]+uz*u+ux*v);
const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
function hit(p,dir){ray.set(p,dir);return ray.intersectObject(root)[0];}
const top=(x,y)=>hit(at((x-109)*W/625,6,(y-66)*D/537),down)?.point.y;
const near=(actual,expected,tol=.0001)=>assert.ok(Math.abs(actual-expected)<tol,expected+' expected; got '+actual);
test('orthophoto terrace, penthouse step, reentrant notch and two higher cores match the surveyed levels',()=>{
  near(W/.06,49.86,.05);near(D/.06,42.06,.05);
  near(top(120,300),4.35);near(top(220,165),4.352);
  near(top(410,270),4.681);near(top(433,535),4.821);
  near(top(546,360),4.352);near(top(379,434),4.91);near(top(562,419),4.927);
  near(top(244,230),4.621);near(top(628,340),4.571);
  assert.equal(top(740,400),undefined);
});
test('17 inset spandrels and 17 glass zones run up the Main elevation above the set-back entry',()=>{
  const dir=new THREE.Vector3(-uz,0,ux);
  const dist=(u,y)=>hit(at(u,y,-.1),dir)?.distance;
  near(dist(.626,.12),.255,.01);near(dist(.626,.327),.1);
  const pitch=(4.448-.355)/17;
  for(let i=0;i<17;i++){
    near(dist(.626,.355+(i+.4)*pitch),.1);
    near(dist(.626,.355+(i+.87)*pitch),.105);
  }
  near(dist(11*W/40+.002,2.5),.092);
  near(hit(at(W+.1,.12,.24),new THREE.Vector3(-ux,0,-uz)).distance,.252,.004);
  near(hit(at(W+.1,2.1,.24),new THREE.Vector3(-ux,0,-uz)).distance,.1,.006);
});
test('one indexed batch, only exposed panes illuminate, and neighbors fall through',()=>{
  const [m]=root.children,pos=m.geometry.getAttribute('position'),tri=m.geometry.index.count/3;
  assert.equal(root.children.length,1);assert.ok(tri>5000&&tri<10000);
  assert.equal(pos.count,m.geometry.getAttribute('color').count);
  assert.ok(pos.array.every(Number.isFinite));assert.ok(lights.length>100&&lights.length<200);
  for(const {x,y,z,ry} of lights){
    const outward=new THREE.Vector3(Math.sin(ry),0,Math.cos(ry));
    const p=new THREE.Vector3(x,y,z).addScaledVector(outward,.01);
    near(hit(p,outward.negate()).distance,.0115,.0004);
    const u=(x-o[0])*ux+(z-o[1])*uz,v=-(x-o[0])*uz+(z-o[1])*ux;
    if(v>D&&u>1.28)assert.ok(y>1.51);
  }
  const r=new THREE.Group(),w=[];
  for(const id of [192305909,192305907,192026934])assert.equal(add211Main({id,p:[]},r,w),false);
  assert.equal(r.children.length+w.length,0);
});
