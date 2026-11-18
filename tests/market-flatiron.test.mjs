import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {sfMap} from '../app/sf-map.ts';
import {addMarketFlatiron} from '../app/market-flatiron.ts';

const base=sfMap.buildings.find(b=>b.id===1279504526);
const tower=sfMap.buildings.find(b=>b.id===288505730);
const city=new THREE.Group(),windows=[];
for(const part of [base,tower])assert.ok(addMarketFlatiron(part,city,windows));
city.updateMatrixWorld(true);

test('388 Market fits two mapped parts and separates its surveyed roof planes',()=>{
  assert.equal(addMarketFlatiron({...tower,id:42},city,windows),false);
  assert.equal(city.children.length,2);
  const down=new THREE.Vector3(0,-1,0);
  function height(x,z){
    const hits=new THREE.Raycaster(new THREE.Vector3(x,9,z),down).intersectObject(city);
    assert.ok(hits.length);return hits[0].point.y;
  }
  for(const [x,z,h] of [[-3.98,-34.55,.735],[-3.52,-30.72,6.534],
    [-3.40,-31.65,6.735],[-3.045,-33.45,6.865]])assert.ok(Math.abs(height(x,z)-h)<.003);
});

test('388 Market has different office, service and residential elevations at the same visible bay',()=>{
  const [a,b]=tower.p.slice(26,28),v=new THREE.Vector3(b[0]-a[0],0,b[1]-a[1]);
  const outward=new THREE.Vector3(v.z,0,-v.x).normalize(),point=new THREE.Vector3(a[0],0,a[1]);
  const face=city.getObjectByName('388 Market offices, mechanical band and residences');
  function hit(y,u){
    const target=point.clone().addScaledVector(v,(4+u)/9);target.y=y;
    const ray=new THREE.Raycaster(target.clone().addScaledVector(outward,.15),outward.clone().negate(),0,.24);
    const h=ray.intersectObject(face)[0];assert.ok(h);
    return {recess:target.sub(h.point).dot(outward),r:face.geometry.attributes.color.getX(h.face.a)};
  }
  const office=hit(2.095,.28),service=hit(4.54,.28),home=hit(5.04,.28),stone=hit(5.04,.08);
  assert.ok(Math.abs(office.recess)<.001&&Math.abs(service.recess)<.001);
  assert.ok(home.recess>.009&&home.recess>stone.recess+.009);
  assert.ok(stone.r>home.r&&office.r>service.r);
  assert.ok(windows.length>125&&windows.every(w=>w.w>0&&w.h>0));
  const cap=city.getObjectByName('388 Market shallow round crown');
  assert.ok(cap.geometry.index.count/3===112&&face.geometry.index.count/3<12500);
});
