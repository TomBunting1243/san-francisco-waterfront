import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {add500Folsom} from '../app/500-folsom.ts';
const point=(u,v,y)=>new THREE.Vector3(-40.372+.9895*u+.1445*v,y,-38.423-.1445*u+.9895*v);
const direction=(du,dv)=>new THREE.Vector3(.9895*du+.1445*dv,0,-.1445*du+.9895*dv).normalize();
const hit=(origin,dir,root)=>new THREE.Raycaster(origin,dir).intersectObject(root,true)[0];
const near=(a,b,t=.0001)=>assert.ok(Math.abs(a-b)<t,`${a} vs ${b}`);
const down=new THREE.Vector3(0,-1,0);
function model(){
  const root=new THREE.Group(),windows=[];
  assert.equal(add500Folsom({id:438098525},root,windows),true);
  assert.equal(add500Folsom({id:693629259},root,windows),true);root.updateMatrixWorld(true);
  return {root,windows};
}
test('the 2024 roof survey resolves terrace planting, PV fields, plant and distinct occupied roofs',()=>{
  const {root}=model();const y=(u,v)=>hit(point(u,v,10),down,root)?.point.y;
  near(y(.40,-1.45),7.947);near(y(1.28,-1.45),7.947);
  near(y(.87,-.38),8.16);near(y(.756,-1.68),8.067);
  near(y(.114,-1.42),7.65);near(y(.77,-3.48),1.915);
  near(y(.15,-3.5),1.599);near(y(2.24,-.37),1.711);
  assert.equal(y(2.26,-1.2),undefined,'open rear paseo below Clementina');
  assert.equal(y(1.5,-3.65),undefined,'beside the ramp');
});
test('balcony pockets physically cut the long street wall; the First Street end stays finely ribbed',()=>{
  const {root}=model(),tow=root.children[1];
  // On tier 2, the street elevation goes from +v to -v. The 71% pocket has recessed doors;
  // on the tier above, this same window bay returns to the outer glass plane.
  const side=direction(1,0);
  const pocket=hit(point(-.5,-1.54,2.61),side,tow),glass=hit(point(-.5,-1.54,3.74),side,tow);
  assert.ok(pocket&&glass);assert.ok(pocket.distance-glass.distance>.030);
  const head=hit(point(.27,.5,3.75),direction(0,-1),tow);
  near(head.distance,.5-.22,.035);
  const colonnade=hit(point(.65,-2.77,.15),direction(0,1),root);
  assert.ok(colonnade.distance>.40,'passage beneath west lounge stays physically traversable from its mouth');
  near(hit(point(.66,-2.37,.12),new THREE.Vector3(0,1,0),root).point.y,.234);
});
test('both mapped parts share one opaque draw material and all lit panes land on glass',()=>{
  const {root,windows}=model();assert.equal(root.children.length,2);
  assert.equal(root.children[0].material,root.children[1].material);
  assert.equal(root.children[0].material.transparent,false);
  const cost=root.children.reduce((n,m)=>n+m.geometry.index.count/3,0);
  assert.ok(cost<13500);assert.ok(windows.length>270&&windows.length<550);
  for(const {x,y,z,ry} of windows){
    const n=new THREE.Vector3(Math.sin(ry),0,Math.cos(ry));
    near(hit(new THREE.Vector3(x,y,z).addScaledVector(n,.0005),n.negate(),root.children[1]).distance,.0017,.0004);
  }
  assert.equal(add500Folsom({id:154217696},root,windows),false);assert.equal(root.children.length,2);
});
test('the First-facing vehicle portal is deeper than its adjacent storefront glazing',()=>{
  const {root}=model(),dir=direction(0,-1);
  const garage=hit(point(1.41,1,.14),dir,root.children[0]);
  const shop=hit(point(.44,1,.14),dir,root.children[0]);
  assert.ok(garage.distance-shop.distance>.105);
});
