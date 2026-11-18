import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {bayReliefPosition} from '../app/bay-relief.ts';
import {waterSurface} from '../app/water-surface.ts';
import {distantEastSpan} from '../app/east-span.ts';

test('both mapped lanes descend to Oakland beneath a single asymmetric cable tower',()=>{
  const mesh=distantEastSpan(bayReliefPosition,waterSurface.level,new THREE.MeshStandardMaterial({vertexColors:true}));
  const at=(lon,lat)=>{
    const [x,z]=bayReliefPosition(lon,lat);
    return new THREE.Raycaster(new THREE.Vector3(x,20,z),new THREE.Vector3(0,-1,0))
      .intersectObject(mesh).map(hit=>(hit.point.y-waterSurface.level)/.06);
  };
  const between=(v,min,max)=>assert.ok(v>min && v<max,`expected ${v} within ${min}…${max}`);
  const stacked=at(-122.365,37.81017);
  between(stacked[0]-stacked.at(-1),7,9);
  between(at(-122.35850585,37.8152652)[0],159.9,160.1);
  for(const lat of [37.81877,37.81916])between(at(-122.35,lat)[0],38,42);
  assert.equal(at(-122.35,37.81897).length,0,'open air between skyway decks');
  between(at(-122.33,37.82164)[0],5,9);
  between(at(-122.3256,37.82199)[0],3,5);

  // Compare the highest points at the same longitudinal distance from the
  // saddle. The shorter western cable falls much faster than the eastern cable.
  const [tx,tz]=bayReliefPosition(-122.35850585,37.8152652);
  const [ex,ez]=bayReliefPosition(-122.35750585,37.8158352);
  const direction=new THREE.Vector2(ex-tx,ez-tz).normalize();
  const pos=mesh.geometry.getAttribute('position');
  function peak(station){
    let max=-Infinity;
    for(let i=0;i<pos.count;i++){
      const s=((pos.getX(i)-tx)*direction.x+(pos.getZ(i)-tz)*direction.y)/.06;
      if(Math.abs(s-station)<5)max=Math.max(max,(pos.getY(i)-waterSurface.level)/.06);
    }
    return max;
  }
  between(peak(-130),75,85);between(peak(130),94,103);
  between(peak(300),51,62);between(peak(-300),49,60);
  assert.equal(mesh.children.length,0);
  assert.equal(mesh.geometry.groups.length,0);
  assert.ok(mesh.geometry.index.count/3<6500);
});
