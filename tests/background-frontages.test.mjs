import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import typeface from '../app/harbor-font.json' with {type:'json'};
import {backgroundFrontage} from '../app/background-frontages.ts';
import {sfMap} from '../app/sf-map.ts';
import {surveyedHeight} from '../app/survey-blocks.ts';
const font=new FontLoader().parse(typeface);
function build(id){
  const b=sfMap.buildings.find(row=>row.id===id);
  return backgroundFrontage(b,surveyedHeight(id)??b.h,font);
}

test('the narrow 139 Steuart parcel presents its three photographed bays toward the Embarcadero',()=>{
  const {root,windows}=build(193054137);
  root.updateMatrixWorld(true);
  assert.equal(windows.filter(p=>Math.cos(p.ry)>.98).length,7);
  assert.ok(windows.some(p=>Math.cos(p.ry)<-.98));
  const [first]=windows;
  assert.ok(Math.cos(first.ry)>.98,'The bay side faces the waterfront');
  const frame=root.getObjectByName('Entry transom'),v=new THREE.Vector3();
  frame.getWorldPosition(v);
  const direction=new THREE.Vector3(-Math.sin(first.ry),0,-Math.cos(first.ry));
  const hit=new THREE.Raycaster(v.clone().addScaledVector(direction,-.25),direction).intersectObjects(root.children,true)[0];
  assert.equal(hit.object,frame);
  assert.ok(Math.abs(new THREE.Box3().setFromObject(root).max.y-(surveyedHeight(193054137)+.009))<1e-5);
  assert.equal(build(193054135),undefined,'121 Steuart keeps its own architecture');
});

test('the concrete corner warehouse has distinct short and long frontages and two rows of upper sash',()=>{
  const {root,windows}=build(256981078);
  const counts=new Map();
  for(const p of windows)counts.set(p.ry,(counts.get(p.ry)??0)+1);
  assert.deepEqual([...counts.values()].sort((a,b)=>a-b),[12,24]);
  assert.equal(new Set(windows.map(p=>p.y)).size,3);
  assert.equal(root.getObjectsByProperty('name','Base joint').length,10);
  assert.equal(root.getObjectsByProperty('name','Parapet band').length,2);
  assert.equal(build(256981066),undefined,'Adjacent 950 Battery retains its separate parcel');
});
