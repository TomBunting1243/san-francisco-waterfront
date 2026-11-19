import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createBridgeTraffic} from '../app/traffic-batches.ts';
import {streetVehicleMaterial} from '../app/street-vehicles.ts';
import {bridgeLayout} from '../app/bridge-layout.ts';
import {bridgeLaneCenters} from '../app/bridge-deck.ts';
import {driverPose,rideDuration} from '../app/driver-rides.ts';

test('both traffic decks share one draw and twelve painted geometries through repeated wraps',()=>{
  const material=streetVehicleMaterial(),{cars,batch,update}=createBridgeTraffic(material);
  assert.equal(batch.instanceCount,cars.length);assert.ok(cars.length<=100&&batch.isBatchedMesh);
  const models=new Set(),axis=new THREE.Vector3(1,0,0),matrix=new THREE.Matrix4(),point=new THREE.Vector3();
  for(const t of [0,6.75,180,7200]){
    update(t);
    for(const [i,car] of cars.entries()){
      batch.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix);
      const west=car.rotation.y>0;
      assert.ok(bridgeLaneCenters.some(x=>Math.abs(x-point.x)<.00001));
      assert.ok(Math.abs(point.y-(west?bridgeLayout.upperDeck+.063:bridgeLayout.lowerDeck+.044))<.00001);
      assert.ok(point.z>=0&&point.z<bridgeLayout.length+(west?8.6:0));
      assert.ok(axis.clone().transformDirection(matrix).z*(west?-1:1)>.999);
      assert.ok(car.position.distanceTo(point)<.00002);
      models.add(batch.getGeometryIdAt(i));
      if(t===0){
        const above=point.clone();above.y+=.3;
        assert.ok(new THREE.Raycaster(above,new THREE.Vector3(0,-1,0),0,.5).intersectObject(batch).some(h=>h.batchId===i));
        assert.ok(new THREE.Box3().setFromObject(car).getSize(new THREE.Vector3()).x<.216);
      }
    }
  }
  assert.equal(models.size,12);
  batch.dispose();material.dispose();
});

test('the driver has a reserved moving gap, neighboring passes, and physically separated traffic in every lane',()=>{
  const material=streetVehicleMaterial(),{cars,batch,update}=createBridgeTraffic(material);
  const upper=cars.filter(c=>c.rotation.y>0),seen=new Map(),passes=new Set(),overtakes=new Set();
  const end=rideDuration('bridge');
  const initial=cars.map(c=>c.position.z);
  update(.01);
  const westSpeeds=new Set(),eastSpeeds=new Set();
  for(const [i,c] of cars.entries()){
    const speed=Math.round((c.position.z-initial[i])*10000)/100;
    (c.rotation.y>0?westSpeeds:eastSpeeds).add(speed);
    if(c.rotation.y>0&&c.position.x===bridgeLaneCenters[3])assert.equal(speed,-1.1);
    assert.ok(c.rotation.y>0?speed<0:speed>0);
  }
  assert.equal(westSpeeds.size,5);assert.equal(eastSpeeds.size,5);
  for(let tick=0;tick<=Math.ceil(end*4);tick++){
    const t=Math.min(end,tick/4),station=driverPose('bridge',t).station;
    update(t);
    for(const west of [true,false])for(const x of bridgeLaneCenters){
      const lane=cars.filter(c=>(c.rotation.y>0)===west&&c.position.x===x).map(c=>c.position.z).sort((a,b)=>a-b);
      assert.ok(lane.length>=5);
      const length=bridgeLayout.length+(west?8.6:0);
      for(let i=0;i<lane.length;i++)assert.ok(((lane[(i+1)%lane.length]-lane[i]+length)%length)>9);
    }
    let neighbors=0;
    for(const car of upper){
      const delta=car.position.z-station;
      if(car.position.x===bridgeLaneCenters[3]){
        const length=bridgeLayout.length+8.6;
        const around=THREE.MathUtils.euclideanModulo(delta,length);
        assert.ok(Math.min(around,length-around)>6.7);continue;
      }
      if(delta<0&&delta>-18)neighbors++;
      const old=seen.get(car);
      // Count crossings of the driver's station; exclude a vehicle re-entering at the portal.
      if(old!==undefined&&Math.abs(old-delta)<1){
        if(old>0&&delta<=0)passes.add(car);
        if(old<0&&delta>=0)overtakes.add(car);
      }
      seen.set(car,delta);
    }
    if(station>19&&station<bridgeLayout.length-2)assert.ok(neighbors>=3);
  }
  assert.ok(passes.size>=4&&overtakes.size>=4,'multiple distinct neighbors pass and are passed');
  batch.dispose();material.dispose();
});
