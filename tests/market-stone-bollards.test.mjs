import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {ferryPublicRealm} from '../app/ferry-architecture.ts';
import {createMarketPaving} from '../app/market-paving.ts';
import {curbRuns,harryBridgesGround,medianGrade,medianTop,addSurveyCurbs,westMarketGround} from '../app/curb-survey.ts';
import {plazaCrossingPose,plazaCrossingCount} from '../app/plaza-walkers.ts';
import {plazaSkaterPose,plazaSkaterCount} from '../app/plaza-skaters.ts';
import {signalPeriod} from '../app/waterfront-signals.ts';

const realm=ferryPublicRealm(),row=realm.getObjectByName('Harry Bridges Plaza stone bollards');
const gate=realm.children.filter(o=>o.name==='Market Street gateway plinth');
const paving=createMarketPaving(),curbs=new THREE.Group(),material=new THREE.MeshBasicMaterial();
addSurveyCurbs(g=>{const mesh=new THREE.Mesh(g,material);curbs.add(mesh);return mesh;});
const down=(objects,x,z,from=.30)=>new THREE.Raycaster(new THREE.Vector3(x,from,z),new THREE.Vector3(0,-1,0)).intersectObjects(objects,false);
const path=curbRuns.find(([id])=>id===3830759)[2];
function setback(x,z){
  const distance=new THREE.Vector2(x,z);
  return Math.min(...path.slice(1).map((b,i)=>{
    const a=new THREE.Vector2(...path[i].slice(0,2)),d=new THREE.Vector2(b[0],b[1]).sub(a);
    const u=THREE.MathUtils.clamp(distance.clone().sub(a).dot(d)/d.lengthSq(),0,1);
    return distance.distanceTo(a.addScaledVector(d,u))/.06;
  }));
}

test('the seventeen surveyed stones sit a measured distance inside the physical plaza curb with an open Market crossing',()=>{
  assert.equal(row.children.length,17);
  const centers=row.children.map(ball=>ball.position);
  for(const {x,y,z} of centers){
    assert.ok(Math.abs(harryBridgesGround(x,z)-medianTop)<.0001,'median under ball');
    const hits=down([paving,...curbs.children],x,z);
    assert.ok(hits.length&&Math.abs(hits[0].point.y-y)<.0005,'continuous rendered paving under ball '+x);
    assert.ok(setback(x,z)>1.02&&setback(x,z)<1.58,'physical setback '+setback(x,z));
  }
  const gaps=centers.slice(1).map((p,i)=>p.distanceTo(centers[i])/.06);
  assert.ok(gaps[6]>29&&gaps[6]<30&&gaps.filter(d=>d>12).length===1);
  for(const n of [11,12])assert.ok(setback(centers[n].x,centers[n].z)>1.08);
  assert.equal(new Set(row.children.map(b=>b.geometry)).size,1);
});

test('both square Market gate plinths rest on the western walk and have the two independent laser heights',()=>{
  assert.equal(gate.length,2);
  assert.ok(Math.abs(gate[0].position.distanceTo(gate[1].position)/.06-22.73)<.035);
  gate.forEach((p,i)=>{
    const {x,y,z}=p.position,base=westMarketGround(x,z)+.00035;
    assert.ok(Math.abs(down([paving],x,z)[0].point.y-base)<.0001);
    const box=new THREE.Box3().setFromObject(p);
    assert.ok(Math.abs((box.max.y-y)/.06-[2.30,2.26][i])<.002);
    assert.ok(box.min.y<base);
  });
});

test('the measured wide median ramp is physically lowered and sampled walkers follow its actual facets',()=>{
  const top=(x,z)=>down([...curbs.children,paving],x,z)[0]?.point.y;
  for(const x of [-1.13,-1.02,-.90,-.77,-.64]){
    const idx=path.findIndex((v,i)=>i>0&&path[i-1][0]>=x&&v[0]<x);
    const a=path[idx-1],b=path[idx],u=(x-a[0])/(b[0]-a[0]),edge=a[1]+u*(b[1]-a[1]);
    assert.ok(top(x,edge+.006)<.033);
    for(const depth of [.018,.10,.22,.32])assert.ok(Math.abs(medianGrade(x,edge+depth)-top(x,edge+depth))<.00045);
  }
  for(let i=0;i<plazaCrossingCount;i++)for(let t=0;t<signalPeriod*2;t+=.38){
    const p=plazaCrossingPose(t,i);
    if(p.z< -5.13&&p.z> -5.47)assert.ok(Math.abs((top(p.x,p.z)??p.y)-p.y)<.001);
    for(const o of [...row.children,...gate])assert.ok(Math.hypot(p.x-o.position.x,p.z-o.position.z)>.11);
  }
  for(let i=0;i<plazaSkaterCount;i++)for(let t=0;t<110;t+=.35){
    const p=plazaSkaterPose(t,i);for(const b of row.children)assert.ok(Math.hypot(p.x-b.position.x,p.z-b.position.z)>.09);
  }
});
