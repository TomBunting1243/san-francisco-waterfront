import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import fontData from '../app/harbor-font.json' with {type:'json'};
import {mappedBuildings} from '../app/sf-map.ts';
import {waterfrontLandmark} from '../app/waterfront-landmarks.ts';

const font=new FontLoader().parse(fontData);
function model(id){
  const b=mappedBuildings.find(b=>b.id===id);
  const result=waterfrontLandmark(b,font);result.root.updateMatrixWorld(true);return result;
}

test('The Southern Pacific entrance faces Market and only the three street sides have arcades',()=>{
  const {root,windows}=model(132238425);
  const market=root.getObjectByName('Market Street elevation');
  const normal=new THREE.Vector3(0,0,1).transformDirection(market.matrixWorld);
  assert.ok(normal.x>.98&&normal.z<-.14);
  assert.equal(market.children.filter(o=>o.name==='Market entrance arch').length,3);
  assert.equal(market.children.filter(o=>o.name==='Retail arcade opening').length,12);
  for(const street of ['Steuart','Spear']){
    const face=root.getObjectByName(street+' Street elevation');
    assert.equal(face.children.filter(o=>o.name==='Retail arcade opening').length,12);
  }
  assert.equal(root.getObjectByName('Market entrance clock').parent,market);
  assert.ok(windows.length>600);
});

test('Rays from above resolve the low open court, raised atrium and isolated service tower',()=>{
  const {root}=model(132238425),axis=root.children[0];
  function heightAt(u,v){
    const start=axis.localToWorld(new THREE.Vector3(u,15,v));
    return new THREE.Raycaster(start,new THREE.Vector3(0,-1,0)).intersectObject(root,true)[0].point.y;
  }
  assert.ok(Math.abs(heightAt(1.5,2.9)-1.642)<.005);
  assert.ok(Math.abs(heightAt(.5,3.0)-2.625)<.005);
  const glass=root.getObjectsByProperty('name','Six-sided atrium skylight');
  assert.equal(glass.length,6);
  assert.ok(glass.every(g=>g.geometry.attributes.normal.getY(0)>.9));
  assert.ok(heightAt(3.03,2.93)>2.78);
  assert.ok(heightAt(2.49,1.385)>3.80);
});

test('The two roof gardens sit on the six-story tower podium',()=>{
  const {root}=model(132238424);
  const gardens=root.getObjectsByProperty('name','Circular roof garden');
  assert.equal(gardens.length,2);
  const podium=root.getObjectByName('One Market Plaza podium');
  const roof=new THREE.Box3().setFromObject(podium).max.y;
  assert.ok(Math.abs(roof-1.642)<.001);
  for(const garden of gardens){
    const start=garden.getWorldPosition(new THREE.Vector3());start.y=5;
    const hit=new THREE.Raycaster(start,new THREE.Vector3(0,-1,0)).intersectObject(podium)[0];
    assert.ok(hit&&Math.abs(hit.point.y-roof)<.001);
  }
});
