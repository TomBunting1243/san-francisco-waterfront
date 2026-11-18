import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createEmbarcaderoCenter,centerTowerFacade,centerTowerIds,centerLobby,centerPromenade} from '../app/embarcadero-center.ts';
import {insideBuilding} from '../app/building-character.ts';
import {mappedBuildings} from '../app/sf-map.ts';
import {refineReferenceMassing} from '../app/reference-architecture.ts';
import {waterfrontLandscape} from '../app/waterfront-gardens.ts';

const {areas,paths}=waterfrontLandscape;
const buildings=refineReferenceMassing(mappedBuildings);
const model=createEmbarcaderoCenter(areas,paths,buildings);
model.root.updateMatrixWorld(true);
const ray=(x,z,y=2)=>new THREE.Raycaster(new THREE.Vector3(x,y,z),new THREE.Vector3(0,-1,0));

test('the four Embarcadero podiums keep daylight through their courts and plant on supported terraces',()=>{
  assert.equal(model.courts.length,4);
  const meshNames=['Lobby level paving','Promenade level paving'];
  for(const court of model.courts){
    const area=areas.find(a=>a.id===court.id);
    const podium=model.root.getObjectByName(area.name+' podium');
    for(const name of meshNames){
      assert.equal(ray(...court.center).intersectObject(podium.getObjectByName(name)).length,0,area.name+' open court');
    }
    assert.ok(ray(...court.center).intersectObject(podium.getObjectByName('Lower court paving')).length);
  }
  assert.ok(model.root.getObjectByName('The Tulip at Four Embarcadero'));
  assert.ok(model.root.getObjectByName('Sky Tree reflecting pool'));
  assert.ok(model.gardenAnchors.length>=7);
  for(const anchor of model.gardenAnchors){
    const area=areas.find(a=>a.id===anchor.id);
    const podium=model.root.getObjectByName(area.name+' podium');
    const hits=ray(anchor.x,anchor.z,anchor.y+.012).intersectObject(podium.getObjectByName('Promenade level paving'));
    assert.ok(hits.some(hit=>Math.abs(hit.point.y-centerPromenade)<.0001),area.name+' tree must have a deck beneath it');
    assert.ok(!buildings.some(b=>centerTowerIds.has(b.parent||b.id)&&b.h>anchor.y&&(b.minH||0)<=anchor.y&&insideBuilding(anchor.x,anchor.z,b.p)));
  }
});

test('main crossings join the corresponding decks at both ends with road clearance',()=>{
  const podiums=model.root.children.filter(o=>o.name.endsWith('podium'));
  const main=[27146047,48211281,48211293,944870402,944870404];
  assert.equal(model.bridges.length,9);
  for(const id of main){
    const bridge=model.bridges.find(bridge=>bridge.id===id);
    const group=model.root.getObjectByName('Embarcadero Center bridge: '+bridge.name);
    const midpoint=bridge.points[0].map((n,i)=>(n+bridge.points[1][i])/2);
    const deck=ray(...midpoint).intersectObject(group)[0];
    assert.ok(Math.abs(deck.point.y-bridge.level)<.02);
    assert.ok(new THREE.Box3().setFromObject(group).min.y>.35,bridge.name+' clearance');
    const levelName=bridge.level===centerLobby?'Lobby level paving':'Promenade level paving';
    for(const point of bridge.points){
      const hits=ray(...point,bridge.level+.025).intersectObjects(podiums);
      assert.ok(hits.some(hit=>hit.object.name===levelName),bridge.name+' must meet a '+levelName);
    }
  }
});

test('the tower window openings start above the commercial terraces and face outside the surveyed envelope',()=>{
  for(const tower of buildings.filter(b=>centerTowerIds.has(b.id))){
    const facade=centerTowerFacade(tower,buildings);
    assert.ok(facade.windows.length>400,tower.name);
    for(const pane of facade.windows){
      assert.ok(pane.y-pane.h/2>centerPromenade);
      assert.ok(pane.y+pane.h/2<tower.h);
      assert.ok(!insideBuilding(pane.x,pane.z,tower.p),tower.name+' glazing in solid');
    }
  }
});
