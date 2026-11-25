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
  const cityEnd=marketPedestrianHeads[4];
  assert.ok(Math.abs((cityEnd.x+56)*132-7310.6)<1);
  assert.ok(Math.abs((2-cityEnd.z)*132-1085.7)<1);
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

test('the two streams from Market enter on WALK, clear the traffic lane, and reach supported landings',async()=>{
  const {plazaCrossingCount,plazaCrossingPose}=await import('../app/plaza-walkers.ts');
  const {waterfrontCar,waterfrontCarCount,waterfrontWalker,waterfrontWalkerCount}=await import('../app/waterfront-routes.ts');
  const {frontMarketShopperCount}=await import('../app/market-shoppers.ts');
  const world=createLandscape();
  const granite=world.root.getObjectByName('Market granite and herringbone promenade');
  const zone=new THREE.Box3(new THREE.Vector3(-1.8,-.1,-8.6),new THREE.Vector3(-.12,.48,-4.25));
  const tri=new THREE.Triangle(),box=new THREE.Box3(),points=[];
  for(const mesh of [...world.architectureChunks,granite]){
    const g=mesh.geometry;g.computeBoundingBox();
    if(!g.boundingBox.intersectsBox(zone))continue;
    const pos=g.attributes.position,ix=g.index;
    for(let i=0;i<(ix?.count??pos.count);i+=3){
      const corners=[tri.a,tri.b,tri.c];
      for(const [j,v] of corners.entries())v.fromBufferAttribute(pos,ix?ix.getX(i+j):i+j);
      if(box.setFromPoints(corners).intersectsBox(zone))for(const v of corners)points.push(v.x,v.y,v.z);
    }
  }
  const paving=new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(points,3)),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0),0,.22);
  const street=z=>z> -6.249&&z< -5.45;
  for(let i=0;i<plazaCrossingCount;i++){
    let entries=0,waited=false,seenWest=false,seenMedian=false,previous=plazaCrossingPose(-.25,i);
    for(let step=0;step<512;step++){
      const t=step/4,p=plazaCrossingPose(t,i);
      if(street(p.z)){
        assert.notEqual(marketPedestrianPhase(t),'stop');
        if(!street(previous.z)){entries++;assert.equal(marketPedestrianPhase(t),'walk');}
        for(let j=1;j<waterfrontCarCount();j+=2){
          const car=waterfrontCar(t,j);
          if(car.active&&Math.abs(car.z-p.z)<.09)assert.ok(Math.abs(car.x-p.x)>.20,'vehicle encroaches on walker');
        }
      }
      waited ||= p.standing&&p.z< -5&&marketPedestrianPhase(t)==='stop';
      seenWest ||= p.z< -8;seenMedian ||= p.z> -4.7;
      assert.ok(Math.hypot(p.x-previous.x,p.z-previous.z)<.035);
      for(let j=0;j<i;j++){
        const q=plazaCrossingPose(t,j);
        assert.ok(Math.hypot(p.x-q.x,p.z-q.z)>.047,'walking companions need shoulder room');
      }
      if(step%3===0){
        ray.ray.origin.set(p.x,p.y+.155,p.z);
        const floor=ray.intersectObject(paving,false)[0];
        assert.ok(floor&&Math.abs(floor.point.y-p.y)<.006,'unsupported foot or obstruction at '+p.x+','+p.z);
      }
      previous=p;
    }
    assert.equal(entries,2);
    assert.ok(waited&&seenWest&&seenMedian);
    for(const region of [undefined,'plaza']){
      const offset=waterfrontWalkerCount(region)-2-frontMarketShopperCount-plazaCrossingCount;
      assert.deepEqual(waterfrontWalker(42,offset+i,region),plazaCrossingPose(42,i));
    }
  }
});
