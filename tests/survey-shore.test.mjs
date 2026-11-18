import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {createLandscape} from '../app/landscape.ts';
import {waterSurface,waterWaveHeight} from '../app/water-surface.ts';
import {bayReliefBankHeight,bayReliefGround} from '../app/bay-relief.ts';
import {addSurveyShore} from '../app/survey-shore.ts';

test('assembled waterfront has clear water under pile decks and a continuous retaining wall at Rincon',()=>{
  const world=createLandscape();
  world.root.updateMatrixWorld(true);
  const surfaces=[...world.architectureChunks,...world.relief.root.children.filter(group=>group.name.includes('elevation'))];
  const down=new THREE.Vector3(0,-1,0),shoreward=new THREE.Vector3(0,0,-1);
  const ray=new THREE.Raycaster();
  function hit(x,y,z,direction,distance){
    ray.set(new THREE.Vector3(x,y,z),direction);
    ray.far=distance;
    return ray.intersectObjects(surfaces,true)[0]?.point;
  }
  const minWater=waterSurface.level-waterWaveHeight;
  for(const [label,x,z,top] of [
    ['Ferry Building fixed apron',-4.2,3.8,.096],['Pier 7 timber deck',27.3,12.5,.06],
    ['Piers 30–32 central working apron',-75,-2,.063]]){
    assert.ok(Math.abs(hit(x,.35,z,down,.4)?.y-top)<.003,label+' retains its deck');
    assert.equal(hit(x,waterSurface.level+waterWaveHeight,z,down,2*waterWaveHeight),undefined,label+' has clear water beneath the slab');
  }
  for(const [label,x,z] of [
    ['end of the ferry apron',-4.2,11.5],['outside Pier 7',27.8,12.5],['head of Pier 7',27,14.95],
    ['Rincon seawall',-32,1.15],['South Beach Harbor',-106,-29],['Mission Creek',-114.4,-68],
    ['north piers',103,12]]){
    assert.equal(hit(x,.35,z,down,.35-minWater),undefined,label+' is open through the lowest wave');
  }
  for(const y of [waterSurface.level+.006,minWater-.02,minWater-.17]){
    const face=hit(-32,y,1.35,shoreward,.6);
    assert.ok(face&&Math.abs(face.z-1.051)<.004,'Rincon wall continues below tidal trough at '+y);
  }
  // Combine the shore and terrain exactly as in the full landscape, with roads
  // and buildings out of the way to test the surface beneath them.
  const bareGround=world.relief.root.children.filter(group=>group.name.includes('elevation'));
  const material=new THREE.MeshStandardMaterial();
  addSurveyShore((geometry,_color,x,y,z)=>{
    const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);
    mesh.updateMatrixWorld(true);bareGround.push(mesh);return mesh;
  },bayReliefBankHeight);
  for(const [name,x,z] of [
    ['North Beach below the hills',65,-88],
    ['South of Market',-60,-119],
    ['inland of China Basin',-155,-128],
    ['beyond the former inland survey extent',-60,-137],
  ]){
    const ground=bayReliefGround(x,z);
    ray.set(new THREE.Vector3(x,ground+.05,z),down);ray.far=.10;
    const visible=ray.intersectObjects(bareGround,true)[0]?.point.y;
    assert.ok(ground>waterSurface.level+waterWaveHeight,name+' remains above high chop');
    assert.ok(Math.abs(visible-ground)<.012,name+' visible ground follows the elevation sampler');
  }
});
