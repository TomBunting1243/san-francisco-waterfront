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
import {createStreetField,collectStreetGlobes} from '../app/street-illumination.ts';
import {bakeRigidChunk} from '../app/city-blocks.ts';
import {createTideUpdater} from '../app/tidal-berths.ts';
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
  const rampLenses=ramp.getObjectsByProperty('name','Station 35 ramp guardrail downlight');
  assert.equal(rampLenses.length,8);
  const field=fieldFor(station.root);
  for(const lamp of rampLenses){
    assert.ok(Math.abs(lamp.position.x)>.13&&Math.abs(lamp.position.x)<.17);
    assert.ok(lamp.userData.signLight&&!lamp.userData.ferryWalkPool,'attached deck owns the spill');
  }
  station.root.updateMatrixWorld(true);
  const deck=ramp.getObjectByName('Station 35 broad access ramp deck');
  const chunk=bakeRigidChunk('Station 35 ramp',[deck],material),geo=chunk.geometry;
  const tide=createTideUpdater([chunk]),light=geo.getAttribute('signLight'),pos=geo.getAttribute('position');
  const local=deck.geometry.getAttribute('position');
  for(const i of Array.from({length:local.count},(_,i)=>i).filter(i=>Math.abs(local.getX(i))<.01))assert.equal(light.getX(i),0);
  const rooms=[];
  house.traverse(m=>{if(m.isMesh&&m.geometry.hasAttribute('signLight'))rooms.push(m);});
  assert.equal(rooms.length,2,'one regular glass batch per end elevation');
  const glassChunk=bakeRigidChunk('Station 35 end rooms',rooms,material);
  const glass=glassChunk.geometry,glassPos=glass.getAttribute('position'),glassTint=glass.getAttribute('signLight');
  const glassRest=glassPos.array.slice(),glassPaint=glassTint.array.slice();
  assert.equal(Array.from({length:glassTint.count},(_,i)=>glassTint.getX(i)).filter(x=>x>0).length,54*4);
  const floatTide=createTideUpdater([glassChunk]);
  for(const offset of [-.09,.09,0]){
    floatTide(offset);
    for(let i=0;i<glassPos.count;i++)assert.ok(Math.abs(glassPos.getY(i)-glassRest[i*3+1]-offset)<1e-6);
    assert.deepEqual(glassTint.array,glassPaint);
  }
  const hot=new Set();
  for(let i=0;i<pos.count;i++)if(light.getX(i)>.80){
    hot.add(local.getZ(i).toFixed(3)+':'+Math.sign(local.getX(i)));
  }
  assert.equal(hot.size,8,'eight distinct edge peaks');
  const rest=pos.array.slice(),tint=light.array.slice();
  const {fixed,floating}=ramp.userData.tideAttachment;
  const dx=floating[0]-fixed[0],dz=floating[1]-fixed[1],run=dx*dx+dz*dz;
  for(const offset of [-.09,.09,0]){
    tide(offset);
    for(let i=0;i<pos.count;i++){
      const weight=Math.max(0,Math.min(1,((pos.getX(i)-fixed[0])*dx+(pos.getZ(i)-fixed[1])*dz)/run));
      assert.ok(Math.abs(pos.getY(i)-rest[i*3+1]-offset*weight)<1e-6);
    }
    assert.deepEqual(light.array,tint);
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

test('the Ferry Hall keeps unlit roofing between its three skylights and focuses spill around the tower',async()=>{
  const {ferryHall,ferryPublicRealm}=await import('../app/ferry-architecture.ts');
  const hall=ferryHall(font),roof=hall.root.getObjectByName('Ferry hall joined roof and portico');
  const p=roof.geometry.attributes.position,c=roof.geometry.attributes.signLight;
  const byX=new Set();let dark=0,nearTower=0;
  for(let i=0;i<p.count;i++){
    const r=c.getX(i),x=p.getX(i),z=p.getZ(i);
    if(!r){dark++;continue;}
    assert.ok(r>=c.getY(i)&&c.getY(i)>=c.getZ(i));
    if(Math.abs(x-hall.towerX)<.92&&Math.abs(z-hall.towerZ)<.92){nearTower++;continue;}
    assert.ok(Math.abs(z+.18)<.12&&r<.105,'only nave skylight glass emits on outer wings');
    byX.add(Math.round(x));
  }
  assert.ok(dark>p.count*.85&&nearTower>10&&byX.size>=4);
  const pools=collectFerryWalkPools(hall.root),field=createStreetField(collectStreetGlobes(ferryPublicRealm(),[]),pools);
  for(const x of [-5,2,5])assert.ok(value(field,x,-1.9)>70,'west tenant forecourt');
  for(const x of [2,5])assert.ok(value(field,x,2.2)>90,'east dining terrace');
  assert.equal(value(field,2,3.5),0,'distant open apron');
  field.dispose();
});

test("only Sinbad's waterside lettering glows red at night",async()=>{
  const {createRememberedWaterfront}=await import('../app/remembered-waterfront.ts');
  const root=createRememberedWaterfront(font),faces=root.getObjectsByProperty('name',"SINBAD'S");
  assert.equal(faces.length,3);
  const lit=faces.filter(o=>o.userData.signLight);
  assert.equal(lit.length,1);assert.equal(lit[0].parent.name,"Sinbad's");
  assert.equal(lit[0].material.color.getHexString(),'f2db9c');
  assert.ok(lit[0].userData.signLight[0]>12*lit[0].userData.signLight[1]);
  assert.ok(root.getObjectsByProperty('name','Dark sign returns').every(o=>!o.userData.signLight));
  const {configureBayWater}=await import('../app/bay-water.ts');
  const water=new THREE.MeshStandardMaterial(),clock={value:0},shader={...THREE.ShaderLib.standard,uniforms:{}};
  configureBayWater(water,clock,Array.from({length:5},()=>new THREE.Vector4()),clock,clock);
  water.onBeforeCompile(shader);
  const face=lit[0].getWorldPosition(new THREE.Vector3());
  assert.ok(Math.abs(face.z-3.10)<.001);
  assert.ok(Math.abs(face.x+9.593)<.001&&Math.abs(face.y-.534)<.001);
  assert.ok(shader.fragmentShader.includes('float signTravel=(3.10-p.y)/mirrorRay.z'));
  assert.ok(shader.fragmentShader.includes('abs(hit-vec2(-9.593,.534))'));
  const mask=shader.uniforms.ferryReflectionWater.value.image;
  const sample=(x,z)=>mask.data[Math.floor(z*mask.height/24)*mask.width+Math.floor((x+16)*mask.width/32)];
  assert.equal(sample(face.x,5),255,'water in front of the sign');
  assert.equal(sample(-4.13,9.58),0,'adjacent terminal float');
  water.dispose();
});

test('the fireboat work deck receives its existing aft lamps through the berth and underway states',async()=>{
  const {createFireboat}=await import('../app/fireboat.ts');
  const {root,update}=createFireboat(),body=root.getObjectByName('Fireboat hull, wheelhouse and monitors');
  const shader={...THREE.ShaderLib.standard,uniforms:{}};
  body.material.onBeforeCompile(shader);
  const role=body.geometry.attributes.vesselLamp,p=body.geometry.attributes.position;
  const lamps=[];
  for(let i=0;i<role.count;i++)if(role.getX(i)===3)lamps.push([p.getX(i),p.getY(i),p.getZ(i)]);
  for(const side of [-1,1])assert.ok(lamps.some(([x,y,z])=>x<-.47&&y>.88&&side*z>.32));
  assert.match(shader.fragmentShader,/fireboatPosition.x<-.47/);
  assert.match(shader.fragmentShader,/smoothstep\(\.12,\.93,vesselNight\)\*\(vesselState<1.5/);
  update(0);assert.equal(shader.uniforms.vesselState.value,1);
  update(18);assert.equal(shader.uniforms.vesselState.value,2);
  assert.equal(root.getObjectsByProperty('isLight',true).length,0);
});
