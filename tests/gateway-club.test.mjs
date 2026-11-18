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
