import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import fontData from '../app/harbor-font.json' with {type:'json'};
import {bakeRigidChunk} from '../app/city-blocks.ts';
import {ferryHall} from '../app/ferry-architecture.ts';
import {ferryGlazing} from '../app/ferry-portico-glazing.ts';
import {createRememberedWaterfront} from '../app/remembered-waterfront.ts';
import {openingIrradiance} from '../app/authored-window-spill.ts';

const font=new FontLoader().parse(fontData),material=new THREE.MeshStandardMaterial();
function checkModel(root,minGroups){
  root.updateMatrixWorld(true);
  const openings=new Map();
  root.traverse(o=>{
    const sample=o.userData.authoredWindowSpill;
    if(!sample)return;
    assert.equal(o.userData.signLight,undefined,'fixture/sign emission stays independent');
    if(!openings.has(sample))openings.set(sample,[]);
    openings.get(sample).push(o);
  });
  assert.ok(openings.size>=minGroups,'individual occupied openings: '+openings.size);
  for(const trim of openings.values()){
    const baked=bakeRigidChunk('lit',trim,material).geometry;
    const sample=trim[0].userData.authoredWindowSpill;
    for(const o of trim)delete o.userData.authoredWindowSpill;
    const off=bakeRigidChunk('unlit',trim,material).geometry;
    for(const o of trim)o.userData.authoredWindowSpill=sample;
    for(const attr of ['position','normal','color'])assert.deepEqual(baked.attributes[attr].array,off.attributes[attr].array);
    const lit=baked.attributes.signLight.array,previous=off.attributes.signLight?.array;
    assert.ok(lit.some((v,i)=>v>(previous?.[i]??0)+1),'trim gains measurable night light at '+trim[0].parent.name+' '+trim[0].position.toArray()+' '+Math.max(...lit));
  }
}
test('occupied Ferry hall arches and east restaurants illuminate their own baked trim',()=>checkModel(ferryHall(font).root,12));
test('both Sinbad elevations and Pancho Villa upper windows and transom have local receivers',()=>{
  checkModel(createRememberedWaterfront(font),11);
});
test('recessed Ferry shop brightness reaches packed sash independently of daytime pigment',()=>{
  function shop(seed){
    const group=new THREE.Group(),glazing=ferryGlazing(group);
    glazing.shop(0,.3,-.18,seed);glazing.finish();
    return group.children[0].geometry;
  }
  // Both odd-index shops have identical foreground construction.
  const bright=shop(1),dim=shop(5),p=bright.attributes.position;
  assert.deepEqual(p.array,dim.attributes.position.array);
  assert.deepEqual(bright.attributes.color.array,dim.attributes.color.array);
  let warmer=0;
  for(let i=0;i<p.count;i++)if(p.getZ(i)>-.20){
    if(bright.attributes.signLight.getX(i)>dim.attributes.signLight.getX(i))warmer++;
  }
  assert.ok(warmer>=12);
  assert.equal(openingIrradiance(0,0,0,1,1,0,0,-.02,0,0,1),0);
  assert.equal(openingIrradiance(0,0,0,1,1,2,0,.01,0,0,1),0);
});
