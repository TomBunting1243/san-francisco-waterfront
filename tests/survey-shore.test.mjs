import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {createLandscape} from '../app/landscape.ts';
import {waterSurface} from '../app/water-surface.ts';

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
  const minWater=waterSurface.level-.14;
  for(const [label,x,z,top] of [
    ['Ferry Building fixed apron',-4.2,3.8,.096],['Pier 7 timber deck',27.3,12.5,.06],
    ['Piers 30–32 central working apron',-75,-2,.063]]){
    assert.ok(Math.abs(hit(x,.35,z,down,.4)?.y-top)<.003,label+' retains its deck');
    assert.equal(hit(x,-.31,z,down,-.31-minWater),undefined,label+' has clear water beneath the slab');
  }
  for(const [label,x,z] of [
    ['end of the ferry apron',-4.2,11.5],['outside Pier 7',27.8,12.5],['head of Pier 7',27,14.95],
    ['Rincon seawall',-32,1.15],['South Beach Harbor',-106,-29],['Mission Creek',-114.4,-68],
    ['north piers',103,12]]){
    assert.equal(hit(x,.35,z,down,.35-minWater),undefined,label+' is open through the lowest wave');
  }
  for(const y of [-.1,-.45,minWater-.02]){
    const face=hit(-32,y,1.35,shoreward,.6);
    assert.ok(face&&Math.abs(face.z-1.051)<.004,'Rincon wall continues below tidal trough at '+y);
  }
});
