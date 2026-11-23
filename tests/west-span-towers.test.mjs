import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {addWestSpanTowers,westTowerCableX,westMainCableRadius} from '../app/west-span-towers.ts';
import {bridgeLayout} from '../app/bridge-layout.ts';

const root=new THREE.Group(),material=new THREE.MeshBasicMaterial();
addWestSpanTowers(root,(g,_color,x,y,z,p)=>{const m=new THREE.Mesh(g,material);m.position.set(x,y,z);p.add(m);return m;});
root.updateMatrixWorld(true);
const bounds=m=>new THREE.Box3().setFromObject(m);
test('four battered tower pairs receive their main cables and have an open gallery and three upper X webs',()=>{
  assert.deepEqual(root.children.map(t=>t.position.z),[...bridgeLayout.towers]);
  for(const t of root.children){
    const at=(x,y)=>new THREE.Raycaster(new THREE.Vector3(x,y,t.position.z-1),new THREE.Vector3(0,0,1),0,2);
    for(const s of [-1,1]){
      const saddle=t.getObjectsByProperty('name','Cable saddle bearing').find(m=>Math.sign(m.position.x)===s);
      const b=bounds(saddle);
      assert.ok(Math.abs(saddle.position.x-s*.603504)<1e-8&&Math.abs(b.max.y+westMainCableRadius-9.55)<1e-7);
      const column=t.getObjectsByProperty('name','Battered cruciform leg').find(m=>Math.sign(bounds(m).getCenter(new THREE.Vector3()).x)===s);
      for(const [x,y] of [[s*.754,.80],[s*westTowerCableX,9.34]])assert.ok(at(x,y).intersectObject(column).length);
    }
    for(const x of [-.45,-.14,.14,.45])assert.equal(at(x,9.30).intersectObject(t,true).length,0,'open gallery bay');
    assert.equal(t.getObjectsByProperty('name','Plate-faced X brace').length,5);
    for(const y of [5.38,6.885,8.35])assert.ok(at(0,y).intersectObject(t,true).length,'brace crossing');
    for(const y of [4.78,6.28,7.77])assert.equal(at(0,y).intersectObject(t,true).length,0,'open between diagonals');
  }
});
test('both roadway portals clear all lanes throughout a 4.6 m tall bus envelope',()=>{
  for(const t of root.children)for(const road of [bridgeLayout.lowerDeck,bridgeLayout.upperDeck]){
    // Sample from road shoulder to shoulder, including each side of the outboard lanes.
    for(let x=-.575;x<=.576;x+=.023)for(let h=.015;h<.31;h+=.013){
      const ray=new THREE.Raycaster(new THREE.Vector3(x,road+h,t.position.z-.5),new THREE.Vector3(0,0,1),0,1);
      assert.equal(ray.intersectObject(t,true).length,0,[x,road+h,t.position.z].join(','));
    }
  }
});
