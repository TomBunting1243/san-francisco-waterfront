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

test('One Market has three deep entry vaults, two side roundels and an open clock balustrade',()=>{
  const {root}=model(132238425),market=root.getObjectByName('Market Street elevation');
  const step=Math.hypot(4.891,.725)/15;
  function firstHit(point,direction){
    const start=market.localToWorld(new THREE.Vector3(...point));
    const dir=new THREE.Vector3(...direction).transformDirection(market.matrixWorld);
    const hit=new THREE.Raycaster(start,dir).intersectObject(root,true)[0];
    assert.ok(hit,'missing surface from '+point);
    return market.worldToLocal(hit.point);
  }
  for(const bay of [-1,0,1]){
    for(const angle of [-.13,.13]){
      const z=firstHit([bay*step,.19,.16],[angle,0,-1]).z;
      assert.ok(z<-.12&&z>-.15,'door must be set behind the street wall at bay '+bay);
    }
    const crown=firstHit([bay*step,.2,-.07],[0,1,0]).y;
    assert.ok(crown>.45&&crown<.48,'a curved soffit spans each portal');
    assert.ok(Math.abs(firstHit([bay*step,.13,-.07],[0,-1,0]).y-.047)<.00001);
  }
  const roundels=market.getObjectsByProperty('name','Vestibule roundel');
  assert.deepEqual(roundels.map(m=>Math.round(m.position.x/step)),[-1,1]);
  const columns=market.getObjectsByProperty('name','Market vestibule column');
  assert.equal(columns.length,4);
  const halfTablet=step*.58,railRun=step*(3.55-1.16)/2;
  for(const side of [-1,1]){
    const spindleX=side*(halfTablet+railRun*1.5/12);
    assert.ok(firstHit([spindleX,.59,.14],[0,0,-1]).z>.1);
    assert.ok(firstHit([spindleX+side*railRun/24,.59,.14],[0,0,-1]).z<.06);
  }
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
