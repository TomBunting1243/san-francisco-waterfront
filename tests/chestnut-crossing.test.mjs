import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {chestnutWalkerCount,chestnutWalkerPose} from '../app/chestnut-crossing.ts';
import {driverPose,rideDuration} from '../app/driver-rides.ts';
import {addSurveyBlocks} from '../app/survey-blocks.ts';
import {signalAspects,signalPeriod} from '../app/waterfront-signals.ts';
import {waterfrontWalker,waterfrontWalkerCount,waterfrontCar,waterfrontCarCount} from '../app/waterfront-routes.ts';

function plate(p){
  const u=(p.x-80)*112;
  return {u,v:(p.z+11)*112-660+.20*u};
}

test('the shared walker batch carries two opposing Chestnut pedestrians across both marked sections',()=>{
  const ids=Array.from({length:waterfrontWalkerCount()},(_,i)=>i).filter(i=>{
    const {v,u}=plate(waterfrontWalker(0,i));
    return u>145&&u<211&&v>=20&&v<=307;
  });
  assert.equal(chestnutWalkerCount,2);
  assert.equal(ids.length,2);
  for(const [index,id] of ids.entries()){
    let previous,peak=0,leg=0;
    for(let i=-1;i<=2*signalPeriod*20;i++){
      const t=i/20,p=waterfrontWalker(t,id),{u,v}=plate(p);
      assert.deepEqual(p,chestnutWalkerPose(t,index));
      assert.ok(Math.abs(u-(158+(v-35)*41/267))<4.001);
      if(p.standing)assert.ok(v<32||v>298,'wait on an outside sidewalk');
      if(v>37&&v<290){
        assert.equal(signalAspects(t)[0],0,'through traffic must be red');
        const phase=(t%signalPeriod+signalPeriod)%signalPeriod;
        assert.ok(phase>=38&&phase<60,'clear the roadway before steady hand');
      }
      if(previous){
        const distance=Math.hypot(p.x-previous.x,p.z-previous.z);
        peak=Math.max(peak,distance*20);leg+=distance;
        assert.ok(Math.cos(p.heading-previous.heading)>.99,'shoulders turn continuously at the curb');
      }
      previous=p;
    }
    assert.ok(peak>.10&&peak<.12);
    assert.ok(leg>4.9&&leg<5.02,'two complete traversals');
  }
  for(let t=0;t<128;t+=.1){
    const a=waterfrontWalker(t,ids[0]),b=waterfrontWalker(t,ids[1]);
    assert.ok(Math.hypot(a.x-b.x,a.z-b.z)>.069,'counterflow leaves shoulder room');
  }
});

test('foot placements meet the actual graded curb, pavement and both sets of crosswalk bars',()=>{
  const root=new THREE.Group();
  addSurveyBlocks(geometry=>{const mesh=new THREE.Mesh(geometry);root.add(mesh);return mesh;});
  const street=root.getObjectByName('Northern Embarcadero street and pier approaches');
  const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0));
  for(let index=0;index<2;index++){
    const paintNear=new Set(),paintFar=new Set();
    for(let i=0;i<=184;i++){
      const p=chestnutWalkerPose(38+i*.125,index),{v}=plate(p);
      ray.ray.origin.set(p.x,p.y+.1,p.z);
      const hits=ray.intersectObject(street);
      assert.ok(hits.length&&Math.abs(hits[0].point.y-p.y)<.002,'supported feet at plate row '+v);
      const onPaint=hits.some(hit=>new THREE.Color().fromBufferAttribute(street.geometry.attributes.color,hit.face.a).getHexString()==='e3dfcb');
      if(onPaint&&v>=38&&v<=101)paintNear.add(Math.floor(v/10));
      if(onPaint&&v>=224&&v<=277)paintFar.add(Math.floor(v/10));
    }
    assert.ok(paintNear.size>=4&&paintFar.size>=4,'both ladder sections cross under each walker');
  }
});

test('the bridge passenger and ambient traffic clear both pedestrians throughout their journeys',()=>{
  for(let t=0;t<=rideDuration('bridge');t+=.05){
    const {eye}=driverPose('bridge',t);
    if(eye.x<80)continue;
    for(let i=0;i<2;i++){
      const p=chestnutWalkerPose(t,i);
      // Circle enclosing the 4.74 × 1.85 m sedan, offset driver and pedestrian.
      assert.ok(Math.hypot(eye.x-p.x,eye.z-p.z)>.21);
      if(Math.abs(eye.x-p.x)<.23)assert.ok(p.standing);
    }
  }
  for(let t=0;t<signalPeriod*5;t+=.5){
    const walkers=[chestnutWalkerPose(t,0),chestnutWalkerPose(t,1)];
    for(let i=0;i<waterfrontCarCount();i++){
      const car=waterfrontCar(t,i);
      if(car.active)for(const p of walkers)assert.ok(Math.hypot(car.x-p.x,car.z-p.z)>.26);
    }
  }
});
