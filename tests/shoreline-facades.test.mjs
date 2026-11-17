import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {mappedBuildings} from '../app/sf-map.ts';
import {hasShorelineFacade,shorelineFacade} from '../app/shoreline-facades.ts';
import {architectureProfile} from '../app/reference-architecture.ts';

const plant={id:-157,name:'Hills Bros Coffee',h:1.46,minH:0,p:[[-44.35,-5.58],[-37.85,-6.55],[-38.29,-9.48],[-44.79,-8.51],[-44.35,-5.58]]};

function rayFrom(g,x,y){
  return new THREE.Raycaster(g.localToWorld(new THREE.Vector3(x,y,1)),
    new THREE.Vector3(0,0,-1).applyQuaternion(g.getWorldQuaternion(new THREE.Quaternion())));
}

test('a Hills Bros. bay has real masonry depth and the Hills Plaza arcade is open through',()=>{
  const {root,windows}=shorelineFacade(plant,[],'#a7806a');
  root.updateMatrixWorld(true);
  const front=root.children[1],wall=front.getObjectByName('Punched masonry facade');
  const opening=front.children.find(m=>m.name==='Recessed sash glazing');
  opening.geometry.computeBoundingBox();
  const x=opening.geometry.boundingBox.getCenter(new THREE.Vector3()).x;
  const ray=rayFrom(front,x,.27);
  assert.equal(ray.intersectObject(wall).length,0);
  const hit=ray.intersectObject(opening)[0];
  assert.ok(hit && front.worldToLocal(hit.point).z<-.07);
  assert.ok(rayFrom(front,x+.48,.27).intersectObject(wall).length>0);
  const arcade=root.getObjectByName('Open Hills Plaza promenade arcade');
  const masonry=arcade.getObjectByName('Open arcade brickwork');
  assert.equal(rayFrom(arcade,-.332,.30).intersectObject(masonry).length,0);
  assert.ok(rayFrom(arcade,0,.30).intersectObject(masonry).length>0);
  assert.ok(windows.length>100);
});

test('the two Infinity street buildings replace their own mass without taking a documented neighboring frontage',()=>{
  const candidates=mappedBuildings.filter(b=>!b.part&&hasShorelineFacade(b));
  assert.deepEqual(candidates.map(b=>b.id).sort((a,b)=>a-b),[191861045,421816058]);
  assert.ok(candidates.every(b=>!architectureProfile(b)));
  const west=shorelineFacade(candidates.find(b=>b.id===421816058),[],'#a2afa4');
  assert.equal(west.root.name,'333 Main Street');
  assert.ok(west.root.getObjectsByProperty('name','Recessed sash glazing').length>100);
});
