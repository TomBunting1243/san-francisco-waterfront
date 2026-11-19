import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createLandscape} from '../app/landscape.ts';
import {marketPedestrianHeads} from '../app/market-crossing-signals.ts';
import {createSignalHousings,createStreetIllumination} from '../app/street-illumination.ts';
import {marketPedestrianPhase,signalAspects} from '../app/waterfront-signals.ts';

test('the six Market heads stand on real landings and face the opposite side of their own marked crossing',()=>{
  const world=createLandscape(),down=new THREE.Vector3(0,-1,0);
  world.root.updateMatrixWorld(true);
  const housing=createSignalHousings();
  const lighting=createStreetIllumination(new THREE.Group(),[],new THREE.MeshBasicMaterial());
  lighting.update(39,1);
  for(const [i,head] of marketPedestrianHeads.entries()){
    const h=marketPedestrianHeads[i^1],dx=h.x-head.x,dz=h.z-head.z;
    const nx=Math.sin(head.angle),nz=Math.cos(head.angle);
    assert.ok((dx*nx+dz*nz)/Math.hypot(dx,dz)>.999);
    const landing=new THREE.Raycaster(new THREE.Vector3(head.x+.009,.14,head.z),down,0,.2)
      .intersectObject(world.root,true).find(hit=>hit.face?.normal.y>.7);
    assert.ok(landing&&Math.abs(landing.point.y-head.y)<.003,'curb support at '+i+' '+landing?.point.y);
    // Sight from the opposite approach to the illuminated walking person's head.
    const shift=(head.x<-.8||head.z<-5?-.015:.015)-.001;
    const from=new THREE.Vector3(head.x+nz*shift+nx*.35,head.y+.165,head.z-nx*shift+nz*.35);
    const ray=new THREE.Raycaster(from,new THREE.Vector3(-nx,0,-nz),0,.36);
    const symbol=ray.intersectObject(lighting.lenses)[0],panel=ray.intersectObject(housing)[0];
    assert.ok(symbol&&panel&&symbol.distance<panel.distance,'visible WALK outside actual casing '+i);
    assert.ok(panel.distance-symbol.distance<.001);
  }
  lighting.dispose();housing.geometry.dispose();
});

test('Market WALK and flashing clearance/countdown stay legible day and night in the shared traffic lens batch',()=>{
  const lighting=createStreetIllumination(new THREE.Group(),[],new THREE.MeshBasicMaterial()),mesh=lighting.lenses;
  const {index,attributes:{position,color}}=mesh.geometry;
  function active(time,dusk=0,enabled=true){
    lighting.update(time,dusk,enabled);
    const lit={white:0,hand:0,digits:0};
    const h=marketPedestrianHeads[0];
    for(let i=0;i<index.count;i+=3){
      const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2);
      if(a===b||a===c||b===c)continue;
      const x=(position.getX(a)+position.getX(b)+position.getX(c))/3;
      if(Math.abs(x-h.x)>.05||Math.abs(position.getZ(a)-h.z)>.035)continue;
      const u=(x-h.x)*Math.cos(h.angle)-(position.getZ(a)-h.z)*Math.sin(h.angle)+.015;
      lit[color.getY(a)>.6?'white':u>0?'digits':'hand']++;
    }
    return lit;
  }
  const stop=active(37),walk=active(38),fourteen=active(46),flash=active(46.6),one=active(59.6);
  assert.ok(stop.hand>10&&!stop.white&&!stop.digits);
  assert.ok(walk.white>10&&!walk.hand&&!walk.digits);
  assert.equal(fourteen.hand,stop.hand);assert.equal(fourteen.digits,12);
  assert.deepEqual(flash,{white:0,hand:0,digits:12});
  assert.deepEqual(one,{white:0,hand:0,digits:4});
  assert.deepEqual(active(60),stop);assert.deepEqual(active(102,1),walk);
  const version=index.version;
  assert.deepEqual(active(102,1),walk);assert.equal(index.version,version);
  assert.deepEqual(active(102,1,false),{white:0,hand:0,digits:0});
  for(let t=0;t<128;t+=.25){
    if(marketPedestrianPhase(t)!=='stop')assert.equal(signalAspects(t)[0],0);
  }
  lighting.dispose();
});
