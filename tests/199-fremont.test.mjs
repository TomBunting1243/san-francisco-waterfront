import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {add199Fremont} from '../app/199-fremont.ts';
const at=(u,v,y)=>new T.Vector3(-27.208+.98612*u+.16602*v,y,-28.544-.16602*u+.98612*v);
const down=new T.Vector3(0,-1,0),grade=.054;
function model(){
  const root=new T.Group(),windows=[];
  assert.equal(add199Fremont({id:192883913},root,windows),true);root.updateMatrixWorld(true);
  return {root,windows,mesh:root.children[0]};
}
test('199 Fremont steps from 32 and 67 m wings to an open mechanical well inside the 111 m fins',()=>{
  const {mesh}=model();
  const height=(u,v)=>new T.Raycaster(at(u,v,10),down).intersectObject(mesh)[0]?.point.y;
  for(const [u,v,h] of [[2.93,1.1,32.6],[2.58,1.45,66.9],[2.21,.96,70.6],
    [-.20,.73,94.2],[-.20,.685,99.8],[.246,1.10,106.25],[.78,.97,106.3],
    [.78,-.01,110.95],[1.15,1.16,110.8],[.78,1.89,110.95]]){
    assert.ok(Math.abs(height(u,v)-(grade+h*.06))<.001,[u,v,h]);
  }
  assert.equal(height(1.03,-.70),undefined,'181 Fremont side of the garden stays clear');
  assert.equal(height(-.4,1.1),undefined,'the tower stops before Howard');
});
test('Howard entrance has a recessed glazed face behind structural stone jambs; the night panes meet glass',()=>{
  const {mesh,windows}=model();
  const toward=new T.Vector3(.98612,0,-.16602).normalize();
  const hit=v=>new T.Raycaster(at(-.6,v,grade+.105),toward).intersectObject(mesh)[0];
  let front=Infinity,back=0;
  for(let v=.63;v<1.40;v+=.008){
    const h=hit(v);assert.ok(h);front=Math.min(front,h.distance);back=Math.max(back,h.distance);
  }
  assert.ok(back-front>.061&&back-front<.072);
  assert.ok(windows.length>90&&windows.length<160);
  for(const p of windows){
    const n=new T.Vector3(Math.sin(p.ry),0,Math.cos(p.ry)),o=new T.Vector3(p.x,p.y,p.z).addScaledVector(n,.002);
    const hit=new T.Raycaster(o,n.negate(),0,.008).intersectObject(mesh)[0];
    assert.ok(hit&&Math.abs(hit.distance-.0035)<.0004);
  }
});
test('the Fremont tower is one opaque indexed batch with separate ownership from 181 Fremont and the Marine Electric Building',()=>{
  const {root,mesh,windows}=model(),before=windows.length;
  for(const id of [445566153,192883914,693630045])assert.equal(add199Fremont({id},root,windows),false);
  assert.equal(root.children.length,1);assert.equal(windows.length,before);assert.equal(mesh.material.transparent,false);
  assert.ok(mesh.geometry.index.count/3<6400);
});
