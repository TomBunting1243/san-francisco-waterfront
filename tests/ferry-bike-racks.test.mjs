import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createLandscape} from '../app/landscape.ts';
import market from '../public/data/market-street.json' with {type:'json'};
import routes from '../public/data/promenade-transit.json' with {type:'json'};
import {busPose} from '../app/promenade-transit.ts';
import {createFerryBikeRacks,ferryRackSites} from '../app/ferry-bike-racks.ts';

const world=createLandscape();
world.root.updateMatrixWorld(true);

test('all eleven hollow stands are seeded into clear pavement outside the Steuart coach envelope',()=>{
  const rack=createFerryBikeRacks();
  const ray=(x,y,z,reach,target)=>new T.Raycaster(new T.Vector3(x,y,z),new T.Vector3(0,-1,0),0,reach).intersectObjects(target)[0];
  const stop=busPose(0);
  assert.equal(rack.geometry.index.count/3,2656);
  for(const site of ferryRackSites){
    const c=Math.cos(site.angle),s=Math.sin(site.angle);
    for(let i=0;i<site.count;i++){
      const t=(i-(site.count-1)/2)*.06*site.pitch;
      const cx=site.x+c*t,cz=site.z+s*t;
      for(const side of [-1,1]){
        const x=cx-s*side*.39*.06,z=cz+c*side*.39*.06;
        const soil=ray(x,site.y+.0003,z,.003,world.architectureChunks);
        const point=new T.Vector2(x,z);
        for(const [lines,clearance] of [[market.crossings.map(r=>r[1]),.35],[[routes.inbound,routes.outbound],.30]]){
          for(const line of lines)for(let j=1;j<line.length;j++){
            const a=new T.Vector2(...line[j-1]),d=new T.Vector2(...line[j]).sub(a);
            const u=T.MathUtils.clamp(point.clone().sub(a).dot(d)/(d.lengthSq()||1),0,1);
            assert.ok(point.distanceTo(a.addScaledVector(d,u))>clearance);
          }
        }
        assert.ok(soil&&Math.abs(soil.point.y-site.y)<.001,'clear seat on paved apron/sidewalk at '+site.osm);
        assert.ok(Math.hypot(x-stop.x,z-stop.z)>3);
      }
      const rail=new T.Raycaster(new T.Vector3(cx,site.y+.08,cz),new T.Vector3(0,-1,0),0,.08).intersectObject(rack).find(hit=>hit.faceIndex<1188);
      assert.ok(rail&&Math.abs((rail.point.y-site.y)/.06-.81)<.04);
      const waist=new T.Vector3(cx,site.y+.025,cz);
      const throughHoop=new T.Raycaster(waist.addScaledVector(new T.Vector3(c,0,s),-.015),new T.Vector3(c,0,s),0,.03);
      assert.equal(throughHoop.intersectObject(rack).filter(hit=>hit.faceIndex<1188).length,0);
    }
  }
});

test('four tire contacts sit on real paving with both frames parallel to their end stands',()=>{
  const mesh=createFerryBikeRacks(),vertices=mesh.geometry.getAttribute('position');
  assert.equal(vertices.count,1696);
  const bikes=[];
  for(const [site,stand,side,heading] of [[ferryRackSites[0],0,-1,1],[ferryRackSites[2],5,1,-1]]){
    const row=new T.Vector3(Math.cos(site.angle),0,Math.sin(site.angle)),along=new T.Vector3(-row.z,0,row.x);
    const cx=new T.Vector3(site.x,site.y,site.z).addScaledVector(row,(stand-(site.count-1)/2)*site.pitch*.06);
    const cloud=[];
    for(let i=660;i<vertices.count;i++){
      const p=new T.Vector3().fromBufferAttribute(vertices,i).sub(cx).divideScalar(.06);
      if(p.length()<2)cloud.push({p,x:p.dot(along)*heading,h:p.y,z:p.dot(row)*side});
    }
    assert.equal(cloud.length,518);
    bikes.push(cloud);
    const feet=cloud.filter(q=>q.h<.0001);
    assert.equal(feet.length,2);
    for(const sign of [-1,1]){
      const foot=feet.find(q=>q.x*sign>0);
      assert.ok(Math.abs(foot.x-sign*.535)<.001 && Math.abs(foot.z-.147)<.001);
      const position=foot.p.clone().multiplyScalar(.06).add(cx);
      const floor=new T.Raycaster(position.clone().add(new T.Vector3(0,.0004,0)),new T.Vector3(0,-1,0),0,.003).intersectObjects(world.architectureChunks)[0];
      assert.ok(floor && Math.abs(floor.point.y-position.y)<.0001, 'actual paving supports the bottom of each tire');
    }
    assert.ok(cloud.every(q=>q.h>=-.0001&&q.h<1.04&&Math.abs(q.x)<.89));
    // Row spacing is 0.91 or 1.08 m. Even the inboard handlebar clears the
    // nearest unoccupied stand plane by >0.63 m throughout the entire bike.
    assert.ok(Math.min(...cloud.map(q=>q.z+site.pitch))>.63);
    // Shackle runs inboard of the hoop and outboard of the frame, enclosing
    // the steel stand leg at x=.39 and the down-tube beside it.
    const lock=cloud.filter(q=>q.h>.614&&q.h<.646&&q.x>.312&&q.x<.47);
    assert.ok(Math.min(...lock.map(q=>q.z))<-.028&&Math.max(...lock.map(q=>q.z))>.085);
  }
  assert.equal(bikes.reduce((n,q)=>n+q.length,660),vertices.count);
});
