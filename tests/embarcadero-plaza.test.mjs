import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import fontData from '../app/harbor-font.json' with {type:'json'};
import {embarcaderoPlaza} from '../app/embarcadero-plaza.ts';
import {createRememberedWaterfront} from '../app/remembered-waterfront.ts';
import {screenRuns,planPoint} from '../app/vaillancourt-plan.ts';

const plaza=embarcaderoPlaza(),fountain=createRememberedWaterfront(new FontLoader().parse(fontData)).getObjectByName('Vaillancourt Fountain');
const stone=plaza.getObjectByName('Granite terraces, lawns and walks'),brick=plaza.getObjectByName('Halprin brick court');
const down=new THREE.Vector3(0,-1,0);
function hit(mesh,u,v){
  return new THREE.Raycaster(new THREE.Vector3(-8+u/80,3,-12+v/80),down).intersectObject(mesh,false)[0]?.point.y;
}
test('the lower brick terrace is one flush clay field with a cutout continuous with the sunken basin',()=>{
  assert.equal(brick.geometry.attributes.position.count%3,0);
  assert.ok(brick.geometry.attributes.position.count<1100);
  for(const [u,v] of [[741,241],[828,222],[875,264],[821,312],[953,174]]){
    assert.ok(hit(brick,u,v)>.12 && hit(brick,u,v)<.139);
    assert.ok(hit(brick,u,v)>hit(stone,u,v));
  }
  assert.equal(hit(brick,1055,297),undefined);
  assert.equal(hit(stone,1055,297),undefined);
  assert.equal(hit(brick,538,337),undefined);
  assert.ok(hit(stone,797,344)>hit(brick,797,344));
});
test('the allée terrace sits above four brick-facing treads and carries two planted rows',()=>{
  assert.ok(Math.abs(hit(stone,867,111)-.163)<.002);
  const n=plaza.getObjectByName('Surveyed plaza tree rows');
  assert.equal(n.children.length,30);
  const stems=n.children.filter(m=>m.position.y===.163);
  assert.ok(new Set(stems.map(m=>m.position.x+','+m.position.z)).size===16);
  const heights=[190,189,188,187,186,185,184,183,182,181,180,179,178,177,176,175].map(v=>hit(stone,770,v));
  assert.ok(new Set(heights.filter(h=>h>.13)).size>=3);
});
test('the original drawing registers at the three observed concrete screen ends; the coping closes at all corners',()=>{
  fountain.updateMatrixWorld(true);
  const target=[[1140,243],[1100,353],[967,362]];
  for(const [i,p] of [screenRuns[0][0],screenRuns[0][1],screenRuns[1][1]].entries()){
    const [x,z]=planPoint(...p),actual=fountain.localToWorld(new THREE.Vector3(x,0,z));
    assert.ok(Math.hypot(actual.x+8-target[i][0]/80,actual.z+12-target[i][1]/80)<.06);
  }
  const steps=fountain.getObjectsByProperty('name','Mitred fountain basin coping');
  assert.equal(steps.length,3);
  for(const step of steps)assert.equal(step.geometry.attributes.position.count,5*12);
  assert.equal(fountain.getObjectByName('Fountain spillways').userData.outlets.length,14);
});
