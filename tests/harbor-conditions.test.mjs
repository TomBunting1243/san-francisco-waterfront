import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {harborConditionsAt,refreshHarborTide} from '../app/harbor-conditions.ts';
import {nextHarborDeparture,serviceDayCalls} from '../app/harbor-timetable.ts';
import {ferryPose,sailingPose} from '../app/motion.ts';
import {ferryPassengerPose} from '../app/ferry-passengers.ts';
import {waterHeight} from '../app/water-surface.ts';
import {buildFerryTerminal,prepareFerryTerminalTide,createBoardingBrows,ferryConnections} from '../app/ferry-terminal.ts';
import {bakeBlocks} from '../app/city-blocks.ts';
import {createTideUpdater} from '../app/tidal-berths.ts';
import {fireboatPose} from '../app/fireboat.ts';

test('SF Bay Ferry calendar, exceptions, platform and midnight are taken from the published service day',()=>{
  assert.deepEqual(nextHarborDeparture('2026-11-18',680),{status:'scheduled',minutes:680,gate:'F',destination:'Richmond',daysAhead:0});
  assert.deepEqual(nextHarborDeparture('2026-11-18',1439),{status:'scheduled',minutes:385,gate:'G',destination:'Oakland',daysAhead:1});
  assert.equal(serviceDayCalls('2026-11-26').length,0);
  assert.equal(nextHarborDeparture('2026-11-26',680).daysAhead,1);
  assert.equal(nextHarborDeparture('2027-03-01',720).status,'outside feed');
  const wed={date:'2026-11-18',minutes:679,weekend:false},holiday={...wed,date:'2026-11-26'};
  assert.equal(ferryPose(0,1,wed).berth,'F2');
  assert.equal(ferryPose(0,1,wed).scheduledMinute,680);
  assert.equal(ferryPose(0,1,wed).phase,'alongside');
  assert.equal(ferryPose(7,1,wed).phase,'backing');
  assert.equal(ferryPose(0,1,holiday).phase,'off service');
  assert.equal(ferryPose(0,0,holiday).phase,'arriving','the introductory scene opens with Pyxis');
});

test('NOAA hourly offline prediction, live reading, stale cutoff and shared Pacific custom date',async t=>{
  const at=new Date('2026-11-01T01:00:00Z');
  assert.equal(harborConditionsAt(at).tide.meters,1.37);
  assert.equal(harborConditionsAt(at).clock.date,'2026-10-31');
  const date=new Date('2026-11-18T19:20:00Z'),mock=t.mock.method(globalThis,'fetch',async()=>({
    ok:true,json:async()=>({data:[{t:'2026-11-18 19:18',v:'1.513'}]}),
  }));
  await Promise.all([refreshHarborTide(date),refreshHarborTide(date)]);
  assert.equal(mock.mock.callCount(),1);
  const live=harborConditionsAt(date),custom=harborConditionsAt(date,680);
  assert.deepEqual(live.tide,{source:'observed',meters:1.513});
  assert.equal(custom.tide.source,'predicted');assert.equal(custom.next.gate,'F');
  assert.ok(Math.abs(live.tideOffset-(1.513-.951)*.06)<1e-12);
  assert.equal(harborConditionsAt(new Date('2026-11-18T20:00:00Z')).tide.source,'predicted');
  assert.equal(harborConditionsAt(new Date('2028-01-01T01:00:00Z')).tide.source,'mean level');
});

test('low and high tide move each vessel, E float, articulated gangway, brow and passengers around fixed landings',()=>{
  const root=new THREE.Group(),mat=new THREE.MeshStandardMaterial();
  const put=(g,c,x,y,z,parent)=>{const m=new THREE.Mesh(g,mat);m.position.set(x,y,z);parent.add(m);return m;};
  const terminal=buildFerryTerminal(put,root),brows=createBoardingBrows(1);
  prepareFerryTerminalTide(terminal);root.updateMatrixWorld(true);
  const parts=[];terminal.traverse(o=>{if(o.isMesh)parts.push(o);});
  const chunks=bakeBlocks(parts,mat),updateTide=createTideUpdater(chunks);
  const link=new THREE.Group();link.add(...chunks);link.updateMatrixWorld(true);
  const c=ferryConnections.find(g=>g.gate==='E'),pile=terminal.getObjectByName('Gate E floating pontoon').getObjectByName('Independent guide pile');
  const down=(mesh,x,z,top)=>new THREE.Raycaster(new THREE.Vector3(x,top,z),new THREE.Vector3(0,-1,0)).intersectObject(mesh)[0]?.point.y;
  for(const offset of [-.083,.061,0]){
    updateTide(offset);root.updateMatrixWorld(true);
    assert.equal(pile.getWorldPosition(new THREE.Vector3()).y,pile.position.y);
    assert.ok(Math.abs(down(link,c.to[0],c.to[1]+.028,c.deckY+offset+.012)-c.deckY-offset)<.003);
    for(const t of [.02,.5,.98]){
      const x=c.from[0]+(c.to[0]-c.from[0])*t,z=c.from[1]+(c.to[1]-c.from[1])*t;
      const expected=c.landY+(c.deckY+offset-c.landY)*t;
      assert.ok(Math.abs(down(link,x,z,expected+.015)-expected)<.008);
    }
    const clock={weekend:false,minutes:435},p=ferryPose(23,0,{...clock,tideOffset:offset}),base=ferryPose(23,0,clock);
    assert.ok(Math.abs(p.y-base.y-offset)<1e-12);assert.equal(p.y,waterHeight(p.x,p.z,23,offset));
    assert.ok(Math.abs(fireboatPose(20,offset).y-fireboatPose(20).y-offset)<1e-12);
    assert.ok(Math.abs(sailingPose(20,2,offset).y-sailingPose(20,2).y-offset)<1e-12);
    brows.update(0,p);
    const browMatrix=new THREE.Matrix4();brows.mesh.getMatrixAt(0,browMatrix);
    const shipEdge=new THREE.Vector3(.5,.5,0).applyMatrix4(browMatrix);
    assert.ok(Math.abs(shipEdge.y-(p.y+p.boardingFreeboard))<.001);
    // At the measured shore hinge the route grade and the baked faces must
    // still agree after the water moves. A ray from head height also catches
    // any fixed edge beam or handrail projecting across the walkway.
    const jointTime=549.76;
    const joint=ferryPassengerPose(jointTime,0,ferryPose(jointTime,0,{...clock,tideOffset:offset}));
    for(const side of [-.016,0,.016]){
      const x=joint.x+Math.sin(joint.heading)*side,z=joint.z-Math.cos(joint.heading)*side;
      assert.ok(Math.abs(down(link,x,z,joint.y+.117)-joint.y)<.012);
    }
    for(const time of [22,25,28,31]){
      const a=ferryPassengerPose(time,0,p),b=ferryPassengerPose(time,0,base);
      assert.ok(Math.abs(a.y-b.y-offset)<1e-9);
    }
  }
});
