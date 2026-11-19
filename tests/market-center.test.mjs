import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {addMarketCenter} from '../app/market-center.ts';

const tall=new THREE.Group(),companion=new THREE.Group(),windows=[];
addMarketCenter({id:32963382},tall,windows);addMarketCenter({id:32946577},companion,windows);
const down=new THREE.Vector3(0,-1,0);
function scene(u,h,v){
  return new THREE.Vector3(-12.192+.98923777*u+.14631692*v,h,-53.725-.14631692*u+.98923777*v);
}
function roofAt(building,u,v){
  const hit=new THREE.Raycaster(scene(u,13,v),down).intersectObject(building)[0];
  assert.ok(hit,'no surface at '+[u,v]);return (hit.point.y-.035)/.06+7.27;
}
const near=(a,b,tolerance=.06)=>assert.ok(Math.abs(a-b)<tolerance,JSON.stringify({actual:a,expected:b}));
test('1975 tower roof steps to the laser-mapped plant above the 1964 companion and its hexagonal enclosure',()=>{
  near(roofAt(tall,.02,1.2),176.05);near(roofAt(tall,.70,1.2),183.05);
  near(roofAt(tall,1.66,.80),186.1);near(roofAt(tall,1.81,.97),184.44,.15);
  near(roofAt(companion,1.08,4.82),99.45);near(roofAt(companion,1.68,4.82),103.73);
  near(roofAt(companion,1.15,3.69),99.45);
});
test('two glazing depths articulate the Market facade, with a separate raised floor inside both plaza entrances',()=>{
  for(const [group,u,v,dir] of [[tall,1.36,1.86,1],[companion,1.77,3.41,-1]]){
    const depth=new THREE.Vector3(-.14631692*dir,0,-.98923777*dir);
    const street=scene(u,.22,v).addScaledVector(depth,-.30);
    const door=new THREE.Raycaster(street,depth,0,.55).intersectObject(group)[0];assert.ok(door);
    assert.ok(door.distance>.32&&door.distance<.44,'sunken door '+door.distance);
    const landing=door.point.clone().addScaledVector(depth,-.022);landing.y=.16;
    const floor=new THREE.Raycaster(landing,down,0,.12).intersectObject(group)[0];assert.ok(floor);
    near(floor.point.y,.095,.001);
  }
});
test('both towers stay in one mesh each and illuminated windows sit within the glazed returns',()=>{
  assert.equal(addMarketCenter({id:149840697},tall,windows),false);
  assert.equal(tall.children.length,1);assert.equal(companion.children.length,1);
  assert.ok(windows.length>110&&windows.length<190);
  const ray=new THREE.Raycaster();
  for(const p of windows){
    const n=new THREE.Vector3(Math.sin(p.ry),0,Math.cos(p.ry));
    ray.set(new THREE.Vector3(p.x,p.y,p.z).addScaledVector(n,.06),n.multiplyScalar(-1));
    ray.far=.069;
    const hits=ray.intersectObjects([tall,companion]);
    near(hits[0].distance,.0612,.0002);
  }
});
