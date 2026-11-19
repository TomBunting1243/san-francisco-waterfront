import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createGatewayClub,gatewayClubGround} from '../app/gateway-club.ts';
import {waterfrontLandscape} from '../app/waterfront-gardens.ts';

const {areas,paths}=waterfrontLandscape;
const club=createGatewayClub(areas,paths);
club.root.updateMatrixWorld(true);
const ray=(x,z)=>new THREE.Raycaster(new THREE.Vector3(x,1,z),new THREE.Vector3(0,-1,0));
const average=p=>p.reduce(([a,b],[x,z])=>[a+x/p.length,b+z/p.length],[0,0]);

test('Golden Gateway keeps six tennis courts and six pickleball courts inside the observed enclosures',()=>{
  assert.equal(club.courts.filter(c=>c.sport==='tennis').length,6);
  assert.equal(club.courts.filter(c=>c.sport==='pickleball').length,6);
  for(const {id,sport,markings} of club.courts){
    const corners=areas.find(a=>a.id===id).p.slice(0,-1);
    assert.ok(corners.every(([x,z])=>gatewayClubGround(x,z)),'Enclosure overlaps playing area '+id);
    const court=club.root.getObjectByName(`${sport==='tennis'?'Tennis':'Pickleball'} court ${id}`);
    assert.ok(court.getObjectByName('Court net'));
    assert.ok(ray(...average(corners)).intersectObject(court.getObjectByName('Blue playing surface')).length>0);
    assert.equal(markings.length,sport==='tennis'?11:8);
    if(sport==='pickleball'){
      const midpoints=markings.slice(4,6).map(m=>average([m.from,m.to]));
      const kitchenWidth=Math.hypot(midpoints[1][0]-midpoints[0][0],midpoints[1][1]-midpoints[0][1])/.06;
      assert.ok(Math.abs(kitchenWidth-4.2672)<.06,'The tennis-sized service box must not replace the pickleball kitchen');
    }
  }
});

test('the aquatic deck leaves both real pools and the spa open at their mapped elevations',()=>{
  const deck=club.root.getObjectByName('Pool deck with cutouts');
  assert.deepEqual(club.pools.map(p=>p.lanes),[6,2,0]);
  for(const {id,lanes} of club.pools){
    const center=average(areas.find(a=>a.id===id).p.slice(0,-1));
    assert.equal(ray(...center).intersectObject(deck).length,0,'Deck covers a pool');
    const pool=club.root.getObjectByName(lanes===6?'Six-lane lap pool':lanes===2?'Teaching pool':'Small spa basin');
    assert.ok(ray(...center).intersectObject(pool).length);
    assert.equal(pool.children.filter(child=>child.name==='Pool lane marking').length,lanes);
  }
  const door=club.root.getObjectByName('Drumm Street club entrance');
  const [x,z]=paths.find(path=>path.id===1505475434).p[0];
  assert.ok(ray(x,z).intersectObject(door.getObjectByName('Club access path')).length);
  assert.ok(club.root.getObjectByName('Tennis front desk pavilion'));
});

test('waterfront lot follows the court fences and keeps two marked rows outside the drive aisle',()=>{
  const lot=club.root.getObjectByName('Golden Gateway waterfront parking'),apron=lot.getObjectByName('Triangular parking apron');
  const parked=lot.children.filter(m=>m.name==='Parked vehicle');
  assert.ok(parked.length>30);
  assert.ok(lot.children.filter(m=>m.name==='Parking stripe').length>65);
  for(const car of parked){
    const v=car.getWorldPosition(new THREE.Vector3());
    assert.ok(ray(v.x,v.z).intersectObject(apron).length,'car sits within traced parking aisle perimeter');
    assert.ok(!gatewayClubGround(v.x,v.z),'parking stays outside the courts and aquatic enclosures');
  }
  // The rectified aerial shows a clear east-west drive aisle through these samples.
  for(const [u,v] of [[213,148],[310,152],[392,154]]){
    const x=(9000+u*1550/900)/132-56,z=2-(750+v*1550/900)/132;
    assert.equal(ray(x,z).intersectObject(lot,true)[0]?.object,apron);
  }
});

test('the two Sue Bierman parcels use surveyed ground beneath the lawns, walks and playground',async()=>{
  const {sueBiermanPark,biermanGround}=await import('../app/sue-bierman.ts');
  const park=sueBiermanPark();park.updateMatrixWorld(true);
  const surfaces=park.children.filter(m=>m.isMesh);
  for(const [x,z] of [[9,-8.9],[10.1,-9.7],[11,-10],[12,-11.4],[13.5,-15],[14.8,-16.3],[16,-17.1],[11.54,-6.5]]){
    const hits=ray(x+.001,z+.003).intersectObjects(surfaces);
    assert.equal(hits.length,1,'one finished land cover at '+[x,z]);
    assert.ok(Math.abs(hits[0].point.y-biermanGround(x+.001,z+.003))<.0001);
  }
  assert.ok(biermanGround(14.8,-16.3)-biermanGround(13.5,-15)>.07);
  const play=park.getObjectByName('Waterfront Playground safety surface');
  for(const name of ['Waterfront Playground rope climber','Waterfront Playground swings']){
    const p=park.getObjectByName(name).position,hit=ray(p.x,p.z).intersectObject(play)[0];
    assert.ok(hit&&Math.abs(hit.point.y-p.y)<.0001);
  }
});
