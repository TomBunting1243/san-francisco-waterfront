import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {addParkTower} from '../app/park-tower.ts';
import city from '../public/data/sf-waterfront.json' with {type:'json'};
const root=new THREE.Group(),windows=[];
for(const id of [611390934,693630048,693630045])assert.equal(addParkTower(city.buildings.find(b=>b.id===id),root,windows),true);
const angle=Math.atan2(-.1583,.9874),c=Math.cos(angle),s=Math.sin(angle);
const p=(u,v,h)=>new THREE.Vector3(-26.848+.06*(u*c-v*s),.045+.06*h,-25.009+.06*(u*s+v*c));
function ray(u,v,h,du,dv,dy,max=250){
  return new THREE.Raycaster(p(u,v,h),new THREE.Vector3(c*du-s*dv,dy,s*du+c*dv).normalize(),0,max*.06).intersectObject(root)[0]?.distance/.06;
}
function near(value,want,tol=.06){assert.ok(Math.abs(value-want)<tol,'expected '+want+' within '+tol+', measured '+value);}
test('the corrected upper plate extends beyond OSM and the two roof terraces step down at surveyed heights',()=>{
  near(200-ray(50,27,200,0,0,-1),45.38);
  near(200-ray(22,5,200,0,0,-1),106.68);
  near(200-ray(17,20,200,0,0,-1),179.26);
  near(200-ray(20,26,200,0,0,-1),182.45);
  near(200-ray(22,39,200,0,0,-1),176.9);
  near(ray(20,49,153,0,-1,0),49-42.1,.65);
  assert.ok(Number.isNaN(ray(-2,7,186,1,0,0)));
  near(ray(-2,13,182.6,1,0,0),2);
  assert.ok(Number.isNaN(ray(-2,40,182.6,1,0,0)));
});
test('five lower and six upper L-shaped cuts have deep open sides, solid floors and clear air above',()=>{
  const mid=49.22,upper=106.68;
  for(let i=0;i<5;i++){
    const h=mid+i*(upper-mid)/5;
    near(ray(41,5,h+2.0,0,0,-1),2);
    // In the Natoma/Beale cut, stand beyond Natoma and look toward Howard.
    near(ray(50,5,h+4,-1,0,0),50-38.85,.65);
    near(ray(50,18,h+4,-1,0,0),50-43.6,.65);
  }
  for(let i=0;i<6;i++){
    const h=upper+i*3*3.858;
    near(ray(3,36,h+2.0,0,0,-1),2);
    near(ray(-6,36,h+3,1,0,0),6+7.55,.65);
    near(ray(-6,22,h+3,1,0,0),6,.65);
  }
});
test('35-foot plaza, projecting staggered fins and shared glazing lights are physical',()=>{
  near(ray(3,10,2,0,0,1),8.67);
  near(ray(-3,10,2,1,0,0),12,.25);
  near(ray(-3,48,2,1,0,0),3.1,.2);
  // Probe from beyond the fin tips and look toward the ordinary glass.
  const exposed=[];
  for(const h of [114,126]){
    const hits=[];
    for(let u=9;u<25;u+=.03)if(ray(u,42.8,h,0,-1,0,1.0)<.3)hits.push(Math.round(u*100));
    exposed.push(hits);
  }
  for(const hits of exposed)assert.ok(hits.length>3);
  assert.ok(exposed[0].every(x=>!exposed[1].includes(x)));
  assert.equal(root.children.length,3);assert.equal(addParkTower({id:693630046,p:[]},root,[]),false);
  const triangles=root.children.reduce((n,m)=>n+m.geometry.index.count/3,0);
  assert.ok(triangles<18000);assert.ok(windows.length>100&&windows.length<430);
  for(const w of windows){
    const n=new THREE.Vector3(Math.sin(w.ry),0,Math.cos(w.ry));
    assert.ok(new THREE.Raycaster(new THREE.Vector3(w.x,w.y,w.z),n.negate(),0,.005).intersectObject(root)[0]);
  }
  console.log('Park Tower geometry',triangles,'triangles',windows.length,'night panes',root.children.map(m=>m.geometry.index.count/3));
});
