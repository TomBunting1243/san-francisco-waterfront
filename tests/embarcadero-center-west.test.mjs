import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {addEmbarcaderoCenterWest} from '../app/embarcadero-center-west.ts';
const at=(u,v,y)=>new T.Vector3(12.371+.89*u-.455*v,y,-37.967+.455*u+.89*v);
const dir=(u,v)=>new T.Vector3(.89*u-.455*v,0,.455*u+.89*v).normalize();
const down=new T.Vector3(0,-1,0);
function tower(){
  const root=new T.Group(),windows=[];
  assert.equal(addEmbarcaderoCenterWest({id:32947500},root,windows),true);
  root.updateMatrixWorld(true);return {root,windows};
}
function hit(root,origin,dir){return new T.Raycaster(origin,dir).intersectObject(root,true)[0];}
test('the five stepped roof strips and pitched east–west ridge agree with USGS surface returns',()=>{
  const {root}=tower();
  const roof=(u,v)=>hit(root,at(u,v,10),down)?.point.y;
  for(const [u,v,meters] of [[.17,.24,106.1],[.56,.24,113.2],[1.10,.24,119.4],[.17,.88,110.7],[.56,.88,117.5],[1.10,.88,124.4],[.17,1.30,114.8],[.56,1.30,120.6],[1.10,1.30,127.1],[1.65,.24,113.1],[2.1,.24,106.0]]){
    assert.ok(Math.abs(roof(u,v)/.06-meters)<1.65,`${u},${v} vs ${meters}`);
  }
  assert.ok(roof(1.10,.23)<roof(1.10,1.22)-.4);assert.ok(roof(1.10,2.39)<roof(1.10,1.22)-.4);
  assert.ok(roof(.932,1.365)>7.685);assert.ok(roof(1.30,1.365)>7.685);
  assert.equal(roof(1.05,2.75),undefined);assert.equal(roof(2.73,1.45),undefined);
});
test('Battery portal sits behind its stone plinth, the Sacramento storefront recess is shallower',()=>{
  const {root}=tower();
  const entrance=hit(root,at(1.34,2.9,.19),dir(0,-1));
  const shop=hit(root,at(2.54,.62,.19),dir(-1,0));
  assert.ok(entrance.distance>.425&&entrance.distance<.446);
  assert.ok(shop.distance>.29&&shop.distance<.31);
  const pier=hit(root,at(1.14,2.9,.19),dir(0,-1));
  assert.ok(entrance.distance-pier.distance>.08);
});
test('one independently dispatched opaque mesh contacts every emitted night pane',()=>{
  const {root,windows}=tower(),mesh=root.children[0];
  for(const id of [32947510,940071571,1240834459,588365127])assert.equal(addEmbarcaderoCenterWest({id},root,windows),false);
  assert.equal(root.children.length,1);assert.equal(mesh.material.transparent,false);
  assert.ok(mesh.geometry.index.count/3<8000);assert.ok(windows.length>200&&windows.length<300);
  for(const w of windows){
    const n=new T.Vector3(Math.sin(w.ry),0,Math.cos(w.ry)),p=new T.Vector3(w.x,w.y,w.z).addScaledVector(n,.0005);
    assert.ok(Math.abs(hit(root,p,n.negate()).distance-.0019)<.00025);
  }
});
