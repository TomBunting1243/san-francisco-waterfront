import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {mappedBuildings} from '../app/sf-map.ts';
import {addRinconRestaurant} from '../app/rincon-restaurants.ts';

const models=new Map();
for (const id of [188401113,188401115]) {
  const root=new THREE.Group(),windows=[];
  assert.equal(addRinconRestaurant(mappedBuildings.find(b=>b.id===id),root,windows),true);
  root.updateMatrixWorld(true);
  models.set(id,{site:root.children[0],windows});
}
const epic=models.get(188401113),waterbar=models.get(188401115);
function roof(site,u,v) {
  const origin=site.localToWorld(new THREE.Vector3(u,2,v));
  return new THREE.Raycaster(origin,new THREE.Vector3(0,-1,0)).intersectObject(site)[0];
}
test('two separate restaurant footprints keep the public route to the bay clear',()=>{
  assert.equal(addRinconRestaurant({id:104599984},new THREE.Group(),[]),false);
  for(const {site} of [epic,waterbar]){
    assert.equal(roof(site,.14,-.20),undefined);
    assert.equal(roof(site,.14,.45),undefined);
    assert.equal(roof(site,.14,-.74),undefined);
  }
});
test('EPIC has a lower bay dining wing and a screened main roof; Waterbar opens onto its lower north terrace',()=>{
  function relative(hit){return (hit.point.y-.11)/.06;}
  assert.ok(Math.abs(relative(roof(epic.site,2,.25))-4.8)<.01);
  assert.ok(Math.abs(relative(roof(epic.site,1,-.66))-6.1)<.01);
  assert.ok(relative(roof(epic.site,1.87,-.54))>7.1);
  assert.ok(Math.abs(relative(roof(waterbar.site,-1.92,.20))-6)<.01);
  assert.ok(Math.abs(relative(roof(waterbar.site,-.16,-.57))-3.6)<.01);
  assert.ok(relative(roof(waterbar.site,-.26,-.25))>5.8);
});
test('street-side EPIC and courtyard-facing Waterbar lettering face the respective pedestrian approaches',()=>{
  const e=epic.site.getObjectByName('EPIC lettering'),w=waterbar.site.getObjectByName('Waterbar lettering');
  const normal=o=>new THREE.Vector3(0,0,1).transformDirection(o.matrixWorld);
  assert.ok(normal(e).z<-.94);
  assert.ok(normal(w).x>.94);
  for(const {site,windows} of [epic,waterbar]){
    assert.ok(site.getObjectByName('Dining entrance glazing'));
    assert.ok(windows.length>3);
    for(const p of windows){
      const n=new THREE.Vector3(Math.sin(p.ry),0,Math.cos(p.ry));
      const from=new THREE.Vector3(p.x,p.y,p.z).addScaledVector(n,.016);
      assert.ok(new THREE.Raycaster(from,n.negate(),0,.06).intersectObject(site).length);
    }
  }
});
test('Waterbar and EPIC trim receives only light from its own active glazing',()=>{
  const collect=(site,test)=>{const out=[];site.traverse(o=>{if(test(o))out.push(o)});return out;};
  const receivers=site=>collect(site,o=>typeof o.userData.uplight==='function');
  const trim=[...receivers(waterbar.site),...receivers(epic.site)];
  for(const model of [waterbar,epic])assert.ok(receivers(model.site).length>12);
  let lit=0;
  for(const surface of trim){
    const face=surface.parent;

    const panes=face.children.filter(o=>o.userData.signLight);
    assert.ok(panes.length>0);
    const positions=surface.geometry.attributes.position,normals=surface.geometry.attributes.normal;
    const norm=new THREE.Matrix3().getNormalMatrix(surface.matrixWorld);
    for(let i=0;i<positions.count;i++){
      const p=new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(surface.matrixWorld);
      const n=new THREE.Vector3().fromBufferAttribute(normals,i).applyNormalMatrix(norm);
      const value=surface.userData.uplight(p,n);
      if(value<=0)continue;
      lit++;
      assert.ok(face.worldToLocal(p.clone()).z>=.014);
      const behind=face.worldToLocal(p.clone());behind.z=-.002;
      assert.equal(surface.userData.uplight(face.localToWorld(behind),n),0);
      const levels=panes.map(o=>o.userData.signLight);
      try{
        for(const pane of panes)delete pane.userData.signLight;
        assert.equal(surface.userData.uplight(p,n),0);
      }finally{panes.forEach((o,i)=>o.userData.signLight=levels[i]);}
    }
  }
  assert.ok(lit>30);
});
