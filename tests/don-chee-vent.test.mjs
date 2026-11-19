import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {addSurveyBlocks} from '../app/survey-blocks.ts';
import {donCheeVentDeck} from '../app/don-chee-vent.ts';

test('Don Chee has one roof, a recessed lattice and a clear notch toward the hotel',()=>{
  const root=new THREE.Group(),m=new THREE.MeshBasicMaterial();
  addSurveyBlocks(g=>{const o=new THREE.Mesh(g,m);root.add(o);return o;});
  root.updateMatrixWorld(true);
  const vent=root.getObjectByName('Don Chee Way Muni vent structure');
  assert.ok(vent&&vent.geometry.index.count/3<750);
  const hit=(x,z,from=.5,objects=root.children)=>new THREE.Raycaster(
    new THREE.Vector3(x,from,z),new THREE.Vector3(0,-1,0)).intersectObjects(objects)[0];
  const deck=(x,z)=>{const h=hit(x,z);assert.equal(h?.object,vent);assert.ok(Math.abs(h.point.y-donCheeVentDeck)<.00005);};
  deck(-8.6,-5.6);deck(-9.11,-6.2);
  const [x,z]=[-9,-4-250/132];
  const heights=new Set();
  for(let i=0;i<15;i++)for(let j=0;j<15;j++){
    const h=hit(x+i*.005,z+j*.005);
    assert.equal(h.object,vent);heights.add(h.point.y.toFixed(4));
  }
  for(const level of [.301,.313,.315,.3175])assert.ok(heights.has(level.toFixed(4)));
  assert.ok(hit(x+.244,z).point.y>donCheeVentDeck);
  assert.equal(hit(-8.56,-6.30,.5,[vent]),undefined);
  // The retired municipal survey shell (.267) must be absent below the grille.
  assert.ok((hit(x,z,.28)?.point.y??0)<.08);
});
