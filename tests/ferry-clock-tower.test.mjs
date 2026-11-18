import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import fontData from '../app/harbor-font.json' with {type:'json'};
import {ferryClockTower,setFerryClockTime} from '../app/ferry-clock-tower.ts';

const font=new FontLoader().parse(fontData);
const foot=.3048*.06;
const near=(a,b)=>assert.ok(Math.abs(a-b)<.00001,`${a} differs from ${b}`);

test('Four 22-foot dials and their measured hands share fixed spindles through time changes',()=>{
  const {root,hands}=ferryClockTower(font);root.updateMatrixWorld(true);
  const faces=root.getObjectsByProperty('name','Twenty-two foot clock dial');
  assert.equal(faces.length,4);assert.equal(hands.length,4);
  for(const [h,m] of [[0,0],[3,15],[17,32],[23,59]]){
    setFerryClockTime(hands,h,m);root.updateMatrixWorld(true);
    for(const [i,{minute,hour}] of hands.entries()){
      const face=faces[i],normal=new THREE.Vector3(0,0,1).transformDirection(face.matrixWorld);
      near(normal.dot(new THREE.Vector3(Math.sin(i*Math.PI/2),0,Math.cos(i*Math.PI/2))),1);
      near(face.geometry.parameters.radius*2,22*foot);
      for(const [hand,length,t] of [[minute,11*foot,m*Math.PI/30],[hour,7.5*foot,(h%12+m/60)*Math.PI/6]]){
        hand.geometry.computeBoundingBox();near(hand.geometry.boundingBox.max.y,length);
        const pivot=face.worldToLocal(hand.getWorldPosition(new THREE.Vector3()));
        near(pivot.x,0);near(pivot.y,0);assert.ok(pivot.z>0);
        const tip=face.worldToLocal(hand.localToWorld(new THREE.Vector3(0,length,0)));
        near(tip.x,Math.sin(t)*length);near(tip.y,Math.cos(t)*length);
      }
    }
  }
});

test('Both square colonnades and both round lanterns have open sightlines through the tower',()=>{
  const {root}=ferryClockTower(font);root.updateMatrixWorld(true);
  const ray=(x,y)=>new THREE.Raycaster(new THREE.Vector3(x,y,1),new THREE.Vector3(0,0,-1)).intersectObject(root,true);
  assert.ok(ray(0,2.20).length>0,'Opaque shaft below belfry');
  for(const y of [2.69,3.15,3.38,3.58])assert.equal(ray(.012,y).length,0,'Solid obstruction at '+y);
  for(const y of [2.534,2.875,3.266,3.50])assert.ok(ray(.012,y).length>0,'Missing dividing cornice at '+y);
  near(new THREE.Box3().setFromObject(root,true).max.y,235*foot);
});
