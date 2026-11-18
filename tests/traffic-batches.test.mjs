import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createBridgeTraffic} from '../app/traffic-batches.ts';
import {streetVehicleMaterial} from '../app/street-vehicles.ts';
import {bridgeLayout} from '../app/bridge-layout.ts';
import {bridgeLaneCenters} from '../app/bridge-deck.ts';

test('one bridge draw batch carries every painted car on the correct deck and lane through repeated wraps',()=>{
  const material=streetVehicleMaterial(),{cars,batch,update}=createBridgeTraffic(material);
  assert.equal(cars.length,22);assert.equal(batch.instanceCount,22);assert.ok(batch.isBatchedMesh);
  const axis=new THREE.Vector3(1,0,0),matrix=new THREE.Matrix4(),point=new THREE.Vector3();
  for(const t of [0,6.75,180,7200]){
    update(t);
    for(const [i,car] of cars.entries()){
      batch.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix);
      const z=THREE.MathUtils.euclideanModulo(i*8+t*(i%2?1.1:-1.1),bridgeLayout.length);
      assert.ok(Math.abs(point.z-z)<.00002);
      assert.ok(Math.abs(point.x-bridgeLaneCenters[Math.floor(i/2)%bridgeLaneCenters.length])<.00001);
      assert.ok(Math.abs(point.y-(i%2?bridgeLayout.lowerDeck+.044:bridgeLayout.upperDeck+.063))<.00001);
      assert.ok(axis.clone().transformDirection(matrix).z*(i%2?1:-1)>.999);
      const fromAbove=point.clone();fromAbove.y+=.3;
      const hit=new THREE.Raycaster(fromAbove,new THREE.Vector3(0,-1,0),0,.5).intersectObject(batch);
      assert.ok(hit.some(h=>h.batchId===i),`rendered car ${i} at ${t}`);
      assert.equal(batch.getGeometryIdAt(i),batch.getGeometryIdAt(i%12));
      assert.ok(car.position.distanceTo(point)<.00002);
    }
  }
  batch.dispose();material.dispose();
});
