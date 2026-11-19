import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {add425Market} from '../app/425-market.ts';
const world=(u,v,y)=>new T.Vector3(-10.733+.98875*u+.1492*v,y,-37.897-.1492*u+.98875*v);
const dir=(u,v)=>new T.Vector3(.98875*u+.1492*v,0,-.1492*u+.98875*v).normalize();
const down=new T.Vector3(0,-1,0);
function model(){
  const root=new T.Group(),windows=[];assert.equal(add425Market({id:32946526},root,windows),true);
  root.updateMatrixWorld(true);return {root,windows};
}
const hit=(root,p,n)=>new T.Raycaster(p,n).intersectObject(root,true)[0];
const near=(v,n,e=.00025)=>assert.ok(Math.abs(v-n)<e,`${v} vs ${n}`);
test('registered deck, parapet, separate plant rooms and five cooling fans resolve at the observed heights',()=>{
  const {root}=model();
  const y=(u,v)=>hit(root,world(u,v,12),down)?.point.y;
  near(y(.30,.32)/.06,151.7,.13);near(y(1.3,.010)/.06,154.5,.1);
  near(y(.75,1.3)/.06,156.1,.08);near(y(2.67,1.30)/.06,155.6,.16);
  for(let i=0;i<5;i++)near(y(1.267+i*.185,1.112),9.294,.003);
  assert.ok(y(2.845,1.431)>9.55);assert.equal(y(1.58,2.50),undefined);
});
test('the folded aluminum spandrel slopes into the ribbon glazing and leaves room for the recessed Market lobby',()=>{
  const {root}=model(),toward=dir(-1,0),s=.79,y0=.389+8*(8.875-.389)/37;
  const range=y=>hit(root,world(4.25,s,y),toward).distance;
  const glass=range(y0+.132),lower=range(y0+.020),upper=range(y0+.056);
  assert.ok(lower<upper&&upper<glass&&glass-lower>.015);
  const entry=hit(root,world(4.25,1.18,.214),toward);assert.ok(entry.distance>.71);
  const column=hit(root,world(4.25,1.44,.214),toward);assert.ok(column.distance<.61);
  assert.ok(entry.distance-column.distance>.11);
});
test('street garden planting and seats frame clear access between the high-rises',()=>{
  const {root}=model(),y=(u,v,h=1)=>hit(root,world(u,v,h),down)?.point.y;
  near(y(2.03,-.59),.056);near(y(1.84,-.705,.16),.087);
  near(y(1.96,-.77),.099,.008);
  assert.ok(y(1.84,-.79)>.32);near(y(-.88,1.1),.055);
  assert.equal(y(2.4,-1.10),undefined,'adjacent 455 Market is outside the garden');
});
test('one opaque mesh owns only the tower parcel and all 305 night lights sit on glazing',()=>{
  const {root,windows}=model();
  for(const id of [159280395,1410934053,159280393,32946535])assert.equal(add425Market({id},root,windows),false);
  assert.equal(root.children.length,1);assert.equal(root.children[0].material.transparent,false);
  assert.ok(root.children[0].geometry.index.count/3<5000);assert.equal(windows.length,305);
  for(const w of windows){
    const n=new T.Vector3(Math.sin(w.ry),0,Math.cos(w.ry)),p=new T.Vector3(w.x,w.y,w.z).addScaledVector(n,.002);
    near(hit(root,p,n.negate()).distance,.0034,.0003);
  }
});
