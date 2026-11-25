import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {add215Fremont} from '../app/215-fremont.ts';
function point(s,t,h){
  const u=206+t*7,v=311+s*7;
  return new T.Vector3(-27.00800104+.0012973094*u-.0084729829*v,.045+h*.06,-33.37263659+.0084728164*u+.0012965840*v);
}
function model(){
  const root=new T.Group(),panes=[];assert.equal(add215Fremont({id:192883909},root,panes),true);
  root.updateMatrixWorld(true);return {root,panes,mesh:root.children[0]};
}
const sample=(mesh,from,to)=>new T.Raycaster(from,to.clone().sub(from).normalize()).intersectObject(mesh)[0];
test('Fremont shop glass and lobby stand behind a seven-bay open colonnade on the surveyed outer wall',()=>{
  const {mesh}=model();
  for(const s of [3,9,15,21,27,33,39]){
    const o=point(s,-6,1.7),hit=sample(mesh,o,point(s,0,1.7));
    assert.ok(hit&&Math.abs(hit.distance-8.7*.06)<.0002,String(s));
  }
  for(const s of [6.1,12.2,18.3,24.4,30.5,36.6]){
    const o=point(s,-6,1.7),hit=sample(mesh,o,point(s,0,1.7));
    assert.ok(hit&&Math.abs(hit.distance-6.03*.06)<.0002);
  }
  const floor=sample(mesh,point(15,1,1.7),point(15,1,0));
  const soffit=sample(mesh,point(15,1,1.7),point(15,1,6));
  assert.ok(Math.abs(floor.point.y-.045)<.0001&&floor.face.normal.y>.99);
  assert.ok(Math.abs(soffit.point.y-point(15,1,4.12).y)<.0001&&soffit.face.normal.y<-.99);
});
test('public corner roof terrace steps up to the eighth floor with rear services outside the street frontage',()=>{
  const {mesh}=model();
  for(const [s,t,h] of [[1,5,29.18],[10,5,33.78],[42,28,37.7],[48,60,29.18]]){
    const hit=sample(mesh,point(s,t,45),point(s,t,0));
    assert.ok(hit&&hit.face.normal.y>.99&&Math.abs(hit.point.y-point(s,t,h).y)<.0001,[s,t,h]);
  }
  assert.equal(sample(mesh,point(-.5,1,45),point(-.5,1,0)),undefined);
  assert.equal(sample(mesh,point(10,-.5,45),point(10,-.5,0)),undefined);
});
test('one replacement owns the correct OSM parcel and registers emitting glass only on the street elevations',()=>{
  const {root,mesh,panes}=model();
  assert.equal(add215Fremont({id:192883917},root,panes),false);
  assert.equal(root.children.length,1);assert.ok(mesh.geometry.index.count/3<2700&&panes.length>15);
  for(const p of panes){
    const n=new T.Vector3(Math.sin(p.ry),0,Math.cos(p.ry)),pt=new T.Vector3(p.x,p.y,p.z);
    const hit=sample(mesh,pt.clone().addScaledVector(n,.001),pt.clone().addScaledVector(n,-.005));
    assert.ok(hit&&hit.distance<.003);
  }
});
