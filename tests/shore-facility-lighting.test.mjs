import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import fontData from '../app/harbor-font.json' with {type:'json'};
import {sfMap,mappedBuildings} from '../app/sf-map.ts';
import {harborPublicPiers} from '../app/harbor-architecture.ts';
import {referenceArchitecture,refineReferenceMassing} from '../app/reference-architecture.ts';
import {addRinconRestaurant} from '../app/rincon-restaurants.ts';
import {addRinconPathLighting} from '../app/rincon-path-lighting.ts';
import {fireboatStation} from '../app/fireboat-station.ts';
import {buildFerryTerminal} from '../app/ferry-terminal.ts';
import {collectFerryWalkPools} from '../app/ferry-walk-lights.ts';
import {createStreetField} from '../app/street-illumination.ts';
import {seawallAt} from '../app/survey-shore.ts';

const font=new FontLoader().parse(fontData),material=new THREE.MeshStandardMaterial();
function mesh(geometry,_color,x,y,z,parent){
  const part=new THREE.Mesh(geometry,material);part.position.set(x,y,z);parent.add(part);return part;
}
function fieldFor(root){
  assert.equal(root.getObjectsByProperty('isLight',true).length,0);
  return createStreetField([],collectFerryWalkPools(root));
}
function value(field,x,z){
  const col=Math.floor((x+56)/.12),row=Math.floor((z+64)/.12);
  return field.image.data[(row*field.image.width+col)*4];
}
function lenses(root,name,count){
  const lamps=root.getObjectsByProperty('name',name);
  assert.equal(lamps.length,count,name);
  assert.ok(lamps.every(o=>o.userData.signLight&&o.userData.ferryWalkPool),name);
  return lamps;
}

test('Pier 14 deck markers light the narrow walk between both rows of inward-facing lenses',()=>{
  const root=harborPublicPiers(sfMap.piers,font),field=fieldFor(root);
  const lamps=lenses(root,'Pier 14 inward-facing deck marker',48);
  for(const lamp of lamps){
    const {x,y,z}=lamp.position;
    assert.ok(y<.09&&y>.060);
    if(z>11.5){assert.ok(Math.hypot(x+17.32,z-11.77)<.36);continue;}
    assert.ok(x>-17.50&&x<-17.14);
    const near=lamps.filter(other=>Math.abs(other.position.z-z)<.45);
    assert.ok(near.some(other=>Math.abs(other.position.x-x)>.19));
  }
  for(const z of [.45,2.1,4.3,7.75,9.1,11.1,11.8])assert.ok(value(field,-17.32,z)>18,'pier walk at '+z);
  assert.equal(value(field,-18.1,6.5),0);
  assert.equal(value(field,-16.55,6.5),0);
  field.dispose();
});

test('Rincon solar poles follow the dry side of the surveyed seawall and the two dining rooms light their terraces',()=>{
  const root=new THREE.Group();
  addRinconPathLighting(root);
  for(const id of [188401113,188401115]){
    const group=new THREE.Group();
    addRinconRestaurant(mappedBuildings.find(b=>b.id===id),group,[]);
    const glass=group.getObjectsByProperty('name','Dining room glass');
    assert.ok(glass.filter(p=>p.userData.ferryWalkPool&&p.userData.signLight).length>=4);
    assert.ok(glass.some(p=>!p.userData.signLight));
    root.add(group);
  }
  const field=fieldFor(root),lamps=lenses(root,'Rincon Park solar path light',17);
  for(let i=0;i<lamps.length;i++){
    const {x,z}=lamps[i].position,edge=seawallAt(x);
    assert.ok(edge.z>z&&edge.z-z<1.3);
    assert.equal(value(field,x,edge.z+1.5),0);
    if(i>0)assert.ok(value(field,(x+lamps[i-1].position.x)/2,(z+lamps[i-1].position.z)/2)>42);
  }
  field.dispose();
});

test('Station 35 everyday safety lights stay on the floating house and the broad access guardrails',()=>{
  const station=fireboatStation(sfMap.buildings.find(b=>b.name==='Fireboat Station 35'),font,mesh);
  const house=station.root.getObjectByName('Floating firehouse'),ramp=station.root.getObjectByName('Station 35 broad access ramp');
  lenses(house,'Station 35 shielded apron light',11);
  const rampLenses=lenses(ramp,'Station 35 ramp guardrail downlight',8);
  const field=fieldFor(station.root);
  for(const lamp of rampLenses){
    assert.ok(Math.abs(lamp.position.x)>.13&&Math.abs(lamp.position.x)<.17);
    const p=lamp.getWorldPosition(new THREE.Vector3());
    assert.ok(value(field,p.x,p.z)>100);
  }
  assert.equal(value(field,-46.9,4.0),0);
  field.dispose();
});

test('the fixed Ferry Plaza lights its concrete face, entrances and queue while the upper roof and slab underside stay dark',()=>{
  const root=new THREE.Group();
  const buildings=refineReferenceMassing(sfMap.buildings.filter(b=>[123559872,123559869].includes(b.id)));
  for(const b of buildings)root.add(referenceArchitecture(b,buildings,font).root);
  const terminal=buildFerryTerminal(mesh,root),field=fieldFor(root);
  const apron=terminal.getObjectByName('Surveyed fixed ferry apron');
  assert.ok(apron.userData.uplight(new THREE.Vector3(),new THREE.Vector3(0,1,0))>.2);
  assert.equal(apron.userData.uplight(new THREE.Vector3(),new THREE.Vector3(0,-1,0)),0);
  lenses(root,'Ferry Plaza East security light',4);
  lenses(root,'One Ferry Plaza sheltered entrance',3);
  lenses(root,'Golden Gate plaza-side aisle light',6);
  for(const [x,z] of [[-5.05,6.55],[-4.4,6.13],[-4.52,9.98],[-3.54,4.47],[-5.85,4.62]])
    assert.ok(value(field,x,z)>36,'approach at '+[x,z,value(field,x,z)]);
  for(const roof of root.getObjectsByProperty('name','Galvanized roof panel'))assert.equal(roof.userData.signLight,undefined);
  field.dispose();
});
