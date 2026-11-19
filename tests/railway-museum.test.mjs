import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import fontData from '../app/harbor-font.json' with {type:'json'};
import {mappedBuildings} from '../app/sf-map.ts';
import {buildingCharacter} from '../app/building-character.ts';
import {hotelRoofHeight} from '../app/railway-museum.ts';
import {bakeBlocks} from '../app/city-blocks.ts';

const hotel=mappedBuildings.filter(b=>b.name==='1 Hotel San Francisco');
const font=new FontLoader().parse(fontData);
test('running bond follows measured wall courses and survives the facade bake without reaching the windows or roofs',()=>{
  const bakedColor=hex=>new THREE.Color(hex).toArray().map(c=>Math.round(c*255)).join(',');
  const chunks=[],brickColors=new Set(['#966a57','#845d50','#a29187','#795b4f'].map(bakedColor));
  let windows=0,wallVertices=0;
  for(const b of hotel){
    const detail=buildingCharacter(b,mappedBuildings,font);
    windows+=detail.windows.length;
    const roof=detail.root.getObjectByName('Surveyed hotel roof');
    const box=new THREE.Box3().setFromObject(roof);
    assert.ok(Math.abs(box.min.y-hotelRoofHeight(b.id))<.00001);
    assert.equal(roof.geometry.hasAttribute('facadeGrid'),false);
    const facade=detail.root.getObjectByName('Steuart hotel brick, stone and glazing returns');
    if(facade.geometry.hasAttribute('facadeGrid'))chunks.push(facade);
  }
  for(const b of bakeBlocks(chunks,new THREE.MeshStandardMaterial())){
    const {position,facadeGrid,normal,color:ink}=b.geometry.attributes;
    for(let i=0;i<position.count;i++){
      const mode=facadeGrid.getZ(i);
      if(mode===-2){
        assert.ok(Math.abs(normal.getY(i))<.61);
        assert.ok(brickColors.has(ink.array.slice(i*3,i*3+3).join(',')));
        assert.ok(Math.abs(facadeGrid.getY(i)*.00435+.068-position.getY(i))<1e-5);
        wallVertices++;
      }else assert.equal(mode,-1);
    }
  }
  assert.ok(wallVertices>250&&windows>200);
});

test('the transit museum awning projects above a recessed glazed double door with an arched end and street-facing lettering',()=>{
  const parent=hotel.find(b=>b.id===193054134);
  const {root}=buildingCharacter(parent,mappedBuildings,font);root.updateMatrixWorld(true);
  const fascia=root.getObjectByName('Don Chee Way museum awning');
  const facade=root.getObjectByName('Steuart hotel brick, stone and glazing returns');
  const front=new THREE.Vector3(0,0,1).applyQuaternion(fascia.quaternion);
  const sample=(u,v)=>{
    const origin=fascia.localToWorld(new THREE.Vector3(u,v,.20));
    return new THREE.Raycaster(origin,front.clone().negate()).intersectObject(facade)[0];
  };
  for(const u of [-.078,0,.078])assert.ok(Math.abs(sample(u,-.008).distance-.2008)<1e-5);
  assert.ok(sample(0,.032).distance<.202);
  assert.ok(sample(.088,.032).distance>.265);
  const left=sample(-.045,-.059),right=sample(.045,-.059);
  assert.ok(left.distance>.292&&right.distance>.292);
  assert.ok(sample(0,-.059).distance<left.distance-.002);
  assert.ok(root.getObjectByName('Railway museum blade on Steuart'));
  assert.ok(root.getObjectByName('Terrene waterfront dining patio'));
  assert.ok(root.getObjectByName('Terrene festoon lamp glass').userData.signLight);
});
