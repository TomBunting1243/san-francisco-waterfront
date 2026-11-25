import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import data from '../app/harbor-font.json' with {type:'json'};
import {buildingCharacter} from '../app/building-character.ts';
import {mappedBuildings} from '../app/sf-map.ts';
import {griffonStreetRoof,steuartHotelPlan,steuartHotelShell} from '../app/steuart-hotel-shell.ts';

const font=new FontLoader().parse(data);
for(const [id,door,recess,label,streetRoof,backRoof] of [
  [193054133,-1.15,1.28,'155 Steuart hotel and restaurant frontage',.891,1.131],
  [193054138,2,1.10,'165 Steuart western hotel frontage',1.095,1.095]
])test(label+' is open behind the marquee, beneath the measured roof',()=>{
  const hotel=mappedBuildings.find(b=>b.id===id);
  const plan=steuartHotelPlan(hotel);
  const body=new THREE.Mesh(steuartHotelShell(hotel,plan),new THREE.MeshStandardMaterial());
  const detail=buildingCharacter(hotel,mappedBuildings,font);
  const scene=new THREE.Group();scene.add(body,detail.root);scene.updateMatrixWorld(true);
  const elevation=scene.getObjectByName(label)?.parent;assert.ok(elevation);
  const point=(x,y,z)=>elevation.localToWorld(new THREE.Vector3(x,y,z));
  const inward=point(0,0,-1).sub(point(0,0,0)).normalize();
  assert.ok(inward.z>.98&&inward.x>.14&&inward.x<.16);
  const groundRay=new THREE.Raycaster(point(door*.06,.045+1.53*.06,.25),inward);
  const first=groundRay.intersectObject(scene)[0];
  assert.ok(Math.abs(first.distance-(.25+recess*.06))<.001);
  const roofAt=depth=>new THREE.Raycaster(point(0,3,-depth),new THREE.Vector3(0,-1,0)).intersectObject(body)[0]?.point.y;
  assert.ok(Math.abs(roofAt(.24)-streetRoof)<.0001);
  assert.ok(Math.abs(roofAt(.82)-backRoof)<.0001);
  if(id===193054133){
    const bayFacade=scene.getObjectByName('Hotel Griffon Embarcadero elevation')?.parent;
    assert.ok(bayFacade);
    const fromAbove=(x,z)=>new THREE.Raycaster(bayFacade.localToWorld(new THREE.Vector3(x,3,z)),new THREE.Vector3(0,-1,0)).intersectObject(scene)[0].point.y;
    for(const narrow of [-.190,-.10]){
      assert.ok(Math.abs(fromAbove(0,narrow)-streetRoof)<.001);
      assert.ok(Math.abs(fromAbove(.186,narrow)-backRoof)<.001);
    }
    assert.ok(Math.abs(fromAbove(0,-.20)-backRoof)<.001);
    const stepRay=new THREE.Raycaster(point(0,griffonStreetRoof+.13,0),inward);
    assert.ok(Math.abs(stepRay.intersectObject(body)[0].distance-.66)<.0001);
    const entireLow=new THREE.Raycaster(point(0,3,-.24),new THREE.Vector3(0,-1,0)).intersectObject(scene)[0];
    assert.ok(Math.abs(entireLow.point.y-streetRoof)<.0001);
  }
});
