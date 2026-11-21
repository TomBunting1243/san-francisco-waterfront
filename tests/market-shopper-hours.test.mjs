import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createLandscape,createCityVignette} from '../app/landscape.ts';
import {marketShopperAttendance,frontMarketShopperCount} from '../app/market-shoppers.ts';
import {frontMarketShopperStart,waterfrontWalker} from '../app/waterfront-routes.ts';

test('full city and plaza shoppers follow their own market through still, seek and reopen',()=>{
  const full=createLandscape();
  for(const [world,region] of [[full,undefined],[createCityVignette('plaza'),'plaza']]){
    const front=frontMarketShopperStart(region);
    const rear=world.residentPositions.flatMap((p,i)=>p.rearShopper?[world.walkerCount+i]:[]);
    const attendance=marketShopperAttendance(front,rear);
    assert.equal(rear.length,6);
    const slots=[...Array.from({length:frontMarketShopperCount},(_,i)=>front+i),...rear];
    assert.equal(new Set(slots).size,10);
    assert.ok(slots.every(i=>i>=0&&i<world.seatStart));
    const matrix=new THREE.Matrix4();
    const nearby=front-1;world.people.bodies.getMatrixAt(nearby,matrix);const neighbor=matrix.clone();
    const draw=(time,still)=>{
      world.ferryMarket.update(Date.parse(time),still);
      const changed=attendance.update(world.ferryMarket.activity);
      for(const i of slots){
        if(attendance.absent.has(i))world.people.hide(i);
        else{
          const p=i<world.walkerCount?waterfrontWalker(0,i,region):world.residentPositions[i-world.walkerCount];
          world.people.update(i,p.x,p.z,0,1,p.y,0,true);
        }
      }
      world.people.flush();return changed;
    };
    assert.equal(draw('2026-11-20T20:00:00Z',true),true);
    assert.equal(attendance.absent.size,0);
    assert.equal(draw('2026-11-21T04:00:00Z',true),true);
    assert.deepEqual([...attendance.absent],slots);
    for(const i of slots){
      assert.ok(world.people.isHidden(i));
      for(const mesh of world.people.group.children){
        const paired=['Contour trousers','Painted sleeves','Shoes','Foot contact shadows'].includes(mesh.name);
        for(const index of paired?[2*i,2*i+1]:[i]){
          mesh.getMatrixAt(index,matrix);assert.equal(matrix.determinant(),0,mesh.name);
        }
      }
    }
    assert.equal(draw('2026-11-21T04:00:00Z',true),false);
    assert.equal(draw('2026-11-21T20:00:00Z',false),true);
    assert.equal(attendance.absent.size,0);
    for(const i of slots){
      assert.equal(world.people.isHidden(i),false);
      world.people.bodies.getMatrixAt(i,matrix);assert.ok(matrix.determinant()>0);
    }
    world.people.bodies.getMatrixAt(nearby,matrix);assert.deepEqual(matrix.elements,neighbor.elements);
    attendance.update({front:1,rear:0});assert.deepEqual([...attendance.absent],rear);
    attendance.update({front:.90,rear:.90});assert.ok(attendance.absent.size>0&&attendance.absent.size<10);
  }
  assert.equal(frontMarketShopperStart('street'),-1);
});
