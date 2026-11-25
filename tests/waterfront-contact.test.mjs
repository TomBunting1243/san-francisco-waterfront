import {medianPalmBeds} from '../app/median-palm-sites.ts';
import {medianBedSoilHeight} from '../app/median-bed-surface.ts';
import {trackAt,trackCenterlines} from '../app/streets.ts';
import {pccDimensions} from '../app/pcc-layout.ts';
import inventory from '../public/data/waterfront-tree-survey.json' with {type:'json'};
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {addSurveyBlocks} from '../app/survey-blocks.ts';
import {streetVehicleMaterial} from '../app/street-vehicles.ts';
import {waterfrontCar} from '../app/waterfront-routes.ts';
import {createWaterfrontTraffic} from '../app/waterfront-traffic.ts';
import {waterfrontGardens} from '../app/waterfront-gardens.ts';

const pavement=[];
addSurveyBlocks((geometry)=>{
  geometry.computeBoundingBox();
  const mesh=new THREE.Mesh(geometry);
  pavement.push(mesh);
  return mesh;
});
const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0));
function firstSurface(x,y,z){
  ray.ray.origin.set(x,y,z);
  const candidates=pavement.filter(({geometry:{boundingBox:b}})=>
    x>=b.min.x&&x<=b.max.x&&z>=b.min.z&&z<=b.max.z&&y>=b.min.y);
  return ray.intersectObjects(candidates,false)[0]?.point.y;
}

test('both traffic directions place actual tread vertices on surveyed asphalt and pitch through the north quay grades',()=>{
  const field=createWaterfrontTraffic(streetVehicleMaterial()),mat=new THREE.Matrix4();
  const shapes=field.traffic.map(car=>{
    const pos=car.geometry.attributes.position;
    if(!car.geometry.boundingBox)car.geometry.computeBoundingBox();
    const points=[];
    for(let i=0;i<pos.count;i++)if(pos.getY(i)<car.geometry.boundingBox.min.y+1e-6)
      points.push(new THREE.Vector3().fromBufferAttribute(pos,i));
    return points;
  });
  const covered=new Set();
  for(let t=0;t<420;t+=3.71){
    field.update(t);
    for(let i=0;i<56;i++){
      const car=waterfrontCar(t,i);
      if(!car.active)continue;
      // Individual survey tiles cover the flat core and the graded quay.
      const site=[-74,-53,-36.8,-23.2,-18,16,21,71,76].find(x=>Math.abs(x-car.x)<.45);
      const key=[site,i%2,i%4].join('/');
      if(site===undefined||covered.has(key))continue;
      const batch=field.traffic[i%12];batch.getMatrixAt(Math.floor(i/12),mat);
      for(const p of shapes[i%12]){
        const wheel=p.clone().applyMatrix4(mat),road=firstSurface(wheel.x,wheel.y+.025,wheel.z);
        assert.ok(road!==undefined&&Math.abs(wheel.y-road)<.0031,'wheel/road '+[wheel.x,wheel.y,road]);
      }
      covered.add(key);
    }
  }
  assert.equal(covered.size,36);
});

test('northbound tires keep both axles on asphalt past the northern refuge flare',()=>{
  const field=createWaterfrontTraffic(streetVehicleMaterial()),matrix=new THREE.Matrix4(),visited=new Set();
  const treads=field.traffic.map(({geometry:g})=>{
    g.computeBoundingBox();
    const p=g.attributes.position,points=new Map();
    for(let i=0;i<p.count;i++)if(p.getY(i)<g.boundingBox.min.y+.000001){
      const v=new THREE.Vector3().fromBufferAttribute(p,i);points.set(v.toArray().join(','),v);
    }
    return [...points.values()];
  });
  for(let t=128;t<225;t+=.09){
    field.update(t);
    for(let i=1;i<56;i+=2){
      const car=waterfrontCar(t,i);
      if(!car.active||car.x<13.4||car.x>15.6)continue;
      visited.add(i%4);
      field.traffic[i%12].getMatrixAt(Math.floor(i/12),matrix);
      for(const pt of treads[i%12]){
        const v=pt.clone().applyMatrix4(matrix),road=firstSurface(v.x,v.y+.026,v.z);
        assert.ok(road!==undefined&&Math.abs(v.y-road)<.0031,'north refuge tire '+[v.x,v.z,road]);
      }
    }
  }
  assert.deepEqual([...visited].sort(),[1,3]);
});

test('tram reservation stems enter the battered curb, sidewalk or asphalt at the full base ring',()=>{
  const gardens=waterfrontGardens([]);
  gardens.root.updateMatrixWorld(true);
  const soils=gardens.root.getObjectsByProperty('name','Tram median root soil');
  assert.equal(soils.length,2);
  const sites=[10828325280,10828325157,10828325159,10828325161,12793548823,12793548827,
    12793548824,12793548836,13605228874,13605228878,13605283525];
  for(const id of sites){
    const t=gardens.treeAnchors.find(a=>a.id===id);
    assert.ok(t,'missing tree '+id);
    const levels=Array.from({length:16},(_,i)=>{
      const angle=i*Math.PI/8;
      const pavementY=firstSurface(t.x+.019*Math.cos(angle),.12,t.z+.019*Math.sin(angle));
      const soilY=ray.intersectObjects(soils,false)[0]?.point.y;
      return Math.max(pavementY??-Infinity,soilY??-Infinity);
    });
    assert.ok(levels.every(Number.isFinite),'pavement around tree '+id);
    assert.ok(Math.abs(Math.min(...levels)-t.y)<.0012,'registered base '+id);
  }
});

test('33 median stems stand in individual physical openings with rail clearance and continuous stone rims',()=>{
  const gardens=waterfrontGardens([]),byId=new Map(gardens.treeAnchors.map(t=>[t.id,t]));
  assert.equal(medianPalmBeds.size,33);
  assert.equal(new Set([...medianPalmBeds.values()].map(b=>b.siteId)).size,33);
  assert.deepEqual([...medianPalmBeds.values()].filter(b=>b.raised).map(b=>b.siteId),[132117]);
  for(const [id,bed] of medianPalmBeds){
    const trunk=byId.get(id);
    assert.deepEqual([trunk.x,trunk.y,trunk.z],[bed.x,medianBedSoilHeight(bed),bed.z]);
    const cs=Math.cos(bed.angle),sn=Math.sin(bed.angle);
    for(const [u,v,rim] of [[.001,.002,false],...Array.from({length:16},(_,i)=>
      [.020*Math.cos(i*.39),.020*Math.sin(i*.39),false]),[bed.halfLength-.001,.004,true],
      [-bed.halfLength+.001,-.004,true],[.010,bed.halfWidth-.001,true],[-.012,-bed.halfWidth+.001,true]]){
      const x=bed.x+cs*u-sn*v,z=bed.z+sn*u+cs*v;
      const height=rim?bed.grade+(bed.raised?.009:0):trunk.y;
      assert.ok(Math.abs(firstSurface(x,.14,z)-height)<.00008,'exposed planting at '+bed.siteId+' '+[x,z]);
      const hits=ray.intersectObjects(pavement.filter(m=>m.geometry.boundingBox.containsPoint(new THREE.Vector3(x,m.geometry.boundingBox.min.y,z))),false);
      assert.equal(hits.filter(h=>Math.abs(h.point.y-height)<.0001).length,1,'competing planting surface at '+bed.siteId);
    }
    const clearance=Math.min(...trackCenterlines.map(line=>{
      const rail=trackAt(bed.x,line);return Math.abs(rail.z-bed.z)*Math.cos(rail.heading);
    }));
    const dbh=inventory.trees[id]?.dbhInches??20;
    const maxBasalRadius=1.70*dbh*.0254*.03;
    assert.ok(clearance>pccDimensions.width/2+maxBasalRadius,'PCC side clears lower stem at '+bed.siteId);
  }
});
