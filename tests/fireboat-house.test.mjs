import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import {floatingFirehouse} from '../app/fireboat-house.ts';
import {sfMap} from '../app/sf-map.ts';

const plan=sfMap.buildings.find(building=>building.name==='Fireboat Station 35').p;
const width=Math.hypot(plan[1][0]-plan[0][0],plan[1][1]-plan[0][1]);
const length=Math.hypot(plan[2][0]-plan[1][0],plan[2][1]-plan[1][1]);
const deck=.08,root=new THREE.Group(),materials=new Map();
const font=new FontLoader().parse(JSON.parse(readFileSync(new URL('../app/harbor-font.json',import.meta.url))));
function mesh(geometry,color,x,y,z,parent){
  if(!materials.has(color))materials.set(color,new THREE.MeshBasicMaterial({color}));
  const part=new THREE.Mesh(geometry,materials.get(color));part.position.set(x,y,z);parent.add(part);return part;
}
const lights=floatingFirehouse(plan,deck,root,mesh,font);
root.updateMatrixWorld(true);
const house=root.getObjectByName('Floating firehouse');
function hit(x,y,z,dx,dy,dz){
  const origin=house.localToWorld(new THREE.Vector3(x,y,z));
  const direction=new THREE.Vector3(dx,dy,dz).transformDirection(house.matrixWorld);
  return new THREE.Raycaster(origin,direction).intersectObject(house,true)[0];
}

test('the bay end has a recessed glazed upper storey, a supported observation deck and a separate glazed working level',()=>{
  const upper=hit(0,.45,length+.30,0,0,-1),lower=hit(-.29,.132,length+.30,0,0,-1);
  assert.ok(upper.distance>.408&&upper.distance<.414);
  assert.ok(lower.distance>.294&&lower.distance<.302);
  assert.equal(upper.object.material.color.getHexString(),'547073');
  const terrace=hit(0,.41,length-.03,0,-1,0);
  assert.ok(Math.abs(terrace.point.y-deck-.2925)<.001);
  const glass=lights.map(p=>house.worldToLocal(new THREE.Vector3(p.x,p.y,p.z)));
  assert.equal(glass.filter(p=>Math.abs(p.z-(length-.109))<.001&&p.y>.30).length,0,'documented crew room excluded from office occupancy');
  const upperLight=upper.object.geometry.getAttribute('signLight');
  assert.ok(upperLight.getX(upper.face.a)>.3);
  const shoreUpper=hit(0,.537,-.30,0,0,1),shoreLower=hit(-.22,.064,-.30,0,0,1);
  for(const opening of [shoreUpper,shoreLower]){
    assert.equal(opening.object.material.color.getHexString(),'547073');
    assert.ok(opening.object.geometry.attributes.signLight.getX(opening.face.a)>.2);
  }
  assert.equal(lights.length,51,'side and unmodified bay-lower panes retain generic registration');
});

test('the registered north and south work sides separate clerestories, office ribbons and the outboard canopy',()=>{
  const north=(t,h)=>hit(width/2+.02,h,length*(1-t),-1,0,0).object.material.color.getHexString();
  assert.equal(north(.18,.395),'547073');
  assert.equal(north(.18,.454),'b9bdba');
  assert.equal(north(.43,.454),'547073');
  assert.equal(north(.43,.392),'b9bdba');
  assert.equal(north(.185,.08),'50595b');
  const awning=hit(-width/2-.10,.45,length*.54,0,-1,0);
  assert.ok(Math.abs(awning.point.y-deck-.265)<.001);
  assert.ok(lights.length<=100);
  let triangles=0;house.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});
  assert.ok(triangles<3200,'the floating house stays smaller than the earlier generic shell');
});
