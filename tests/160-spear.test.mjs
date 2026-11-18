import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import {add160Spear} from '../app/160-spear.ts';
import city from '../public/data/sf-waterfront.json' with {type:'json'};
import fontData from '../app/harbor-font.json' with {type:'json'};

const angle=Math.atan2(-.1583,.9874),c=Math.cos(angle),s=Math.sin(angle),meter=.06;
const world=(u,v,h)=>new THREE.Vector3(-21.85+meter*(u*c-v*s),.045+meter*h,-17.88+meter*(u*s+v*c));
const root=new THREE.Group(),windows=[];
assert.ok(add160Spear(city.buildings.find(b=>b.id===288645261),root,windows,new FontLoader().parse(fontData)));
function distance(u,v,h,sign,max=100){
  const ray=new THREE.Raycaster(world(u,v,h),new THREE.Vector3(-s*sign,0,c*sign),0,max*meter);
  return (ray.intersectObject(root)[0]?.distance??Infinity)/meter;
}
function roof(u,v){
  const hit=new THREE.Raycaster(world(u,v,100),new THREE.Vector3(0,-1,0)).intersectObject(root)[0];
  return hit?(hit.point.y-.045)/meter:null;
}

test('the two street fronts follow the distinct cants on the measured typical and top floor plates',()=>{
  const main=u=>distance(u,-30,35,1),spear=u=>32-distance(u,32,35,-1);
  for(const u of [-11,-3,2.6,10.2])assert.ok(main(u)<main(-6.35)-.9);
  assert.ok(spear(1)>spear(12)+1.5&&spear(-2)>spear(-12)+1.5);
  assert.ok(32-distance(1,32,72,-1)<spear(1)-1.8);
  for(const [u,v,h] of [[16,8,74.15],[10,5,78.4],[0,-4,81.35]])
    assert.ok(Math.abs(roof(u,v)-h)<.02);
  assert.ok(Math.abs(roof(18.9,5)-8.05)<.02);
  assert.equal(roof(20,5),null);
});

test('courtyard path reaches Spear lobby, Main canopy folds outward and silver sculpture has an open center',()=>{
  const portal=64-distance(-1.7,64,1.45,-1);
  assert.ok(portal>17.8&&portal<18.1);
  assert.ok(roof(-1.85,44)<.25);
  assert.ok(roof(-.6,-22.05)>4.3);
  assert.ok(roof(-.6,-23)===null);
  assert.equal(distance(-7.05,59,1.97,-1,3),Infinity);
  assert.ok(distance(-5.94,59,1.97,-1,3)<2);
  assert.ok(roof(-7.7,49.9)>15);
});

test('one indexed daylight draw with shared night panes and no overlap in building dispatch',()=>{
  for(const id of [192026937,192026939])assert.equal(add160Spear({id,p:[]},root,[]),false);
  assert.equal(root.children.length,1);
  const mesh=root.children[0];assert.ok(mesh.material.vertexColors&&mesh.geometry.index);
  const tris=mesh.geometry.index.count/3;
  assert.ok(tris<15000);
  assert.ok(windows.length>75&&windows.length<220);
  for(const w of windows){
    const outward=new THREE.Vector3(Math.sin(w.ry),0,Math.cos(w.ry));
    const start=new THREE.Vector3(w.x,w.y,w.z).addScaledVector(outward,.003);
    assert.ok(new THREE.Raycaster(start,outward.negate(),0,.009).intersectObject(root)[0]);
  }
  console.log('160 Spear geometry',tris,'triangles',mesh.geometry.attributes.position.count,'vertices',windows.length,'night panes');
});
