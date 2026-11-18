import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import data from '../app/harbor-font.json' with {type:'json'};
import {mappedBuildings} from '../app/sf-map.ts';
import {bakeBlocks} from '../app/city-blocks.ts';
import {addMarketHistoricFrontage} from '../app/market-historic-frontages.ts';

const font=new FontLoader().parse(data);
function model(id){
  const root=new THREE.Group(),windows=[];
  for(const b of mappedBuildings.filter(b=>b.id===id))assert.equal(addMarketHistoricFrontage(b,root,windows,font),true);
  root.updateMatrixWorld(true);
  const meshes=[];root.traverse(o=>{if(o.isMesh)meshes.push(o);});
  return {group:root.children[0],windows,baked:bakeBlocks(meshes,new THREE.MeshStandardMaterial({vertexColors:true}))};
}
function cast(baked,face,x,y){
  const direction=new THREE.Vector3(0,0,-1).transformDirection(face.matrixWorld);
  const origin=face.localToWorld(new THREE.Vector3(x,y,.12));
  const hit=new THREE.Raycaster(origin,direction).intersectObjects(baked)[0];
  assert.ok(hit&&hit.face.normal.dot(direction)<-.99);
  const rgb=new THREE.Color().fromBufferAttribute(hit.object.geometry.attributes.color,hit.face.a);
  return {rgb,z:.12-hit.distance};
}
function nearColor(result,c){
  const expected=new THREE.Color(c);
  for(const key of ['r','g','b'])assert.ok(Math.abs(result.rgb[key]-expected[key])<.5/255+.00001);
}
test('Rincon Mission front has recessed casements between eight projecting piers and carries a set-back glazed roof',()=>{
  const {group,windows,baked}=model(44106213),face=group.getObjectByName('Mission Street lobby elevation');
  const plan=mappedBuildings.find(b=>b.id===44106213).p,w=Math.hypot(plan[0][0]-plan[14][0],plan[0][1]-plan[14][1]);
  const step=w*.82/7;
  const glass=cast(baked,face,0,.557);nearColor(glass,'#596864');
  for(let j=0;j<8;j++){
    const pier=cast(baked,face,(j-3.5)*step,.554);nearColor(pier,'#dad4c4');assert.ok(pier.z-glass.z>.04);
  }
  const top=(u,v)=>{
    const start=group.localToWorld(new THREE.Vector3(u,5,v));
    return new THREE.Raycaster(start,new THREE.Vector3(0,-1,0)).intersectObjects(baked)[0].point.y;
  };
  assert.ok(Math.abs(top(w*.5,.4)-1.145)<.003);
  assert.ok(top(w*.493,2.8)>1.67&&top(w*.493,2.8)-top(w*.27,2.8)>.10);
  assert.equal(windows.length,25);
});
test('The Spear shows eight precast office rows on Mission and a brick north core below the rooftop framing',()=>{
  const {group,windows,baked}=model(32863010),face=group.getObjectByName('Mission Street elevation');
  const plan=mappedBuildings.find(b=>b.id===32863010).p,w=Math.hypot(plan[0][0]-plan[3][0],plan[0][1]-plan[3][1]);
  const pitch=w*.923/20,ft=.3048*.06;
  for(let row=0;row<8;row++){
    const base=(33+row*14)*ft;
    const glass=cast(baked,face,pitch*.5,base+4.9*ft);nearColor(glass,'#667a7d');
    const jamb=cast(baked,face,pitch*.04,base+4.9*ft);nearColor(jamb,'#e2ded4');
    assert.ok(jamb.z-glass.z>.025);
  }
  const exterior=group.getObjectByName('Spear Street elevation');
  const height=(33+4.9)*ft,edgePitch=Math.hypot(plan[0][0]-plan[1][0],plan[0][1]-plan[1][1])*.795*.923/20;
  nearColor(cast(baked,exterior,edgePitch*.5,height),'#667a7d');
  const brick=group.getObjectByName('North brick service core');
  assert.ok(Math.abs(new THREE.Box3().setFromObject(brick).max.y-(186+4/12)*ft)<.002);
  assert.ok(new THREE.Box3().setFromObject(group).max.y>3.63);assert.ok(windows.length>=150);
});
