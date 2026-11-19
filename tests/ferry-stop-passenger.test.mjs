import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {ferryPassengerPose,createFerryPassenger} from '../app/ferry-stop-passenger.ts';
import {ambientStreetcarCall,ambientStreetcarPeriod,washingtonDoorOpening} from '../app/washington-call.ts';
import {streetcarPose} from '../app/streets.ts';
import {driverPose,museumLegDuration} from '../app/driver-rides.ts';
import {createStreetcar,setPccExitDoor} from '../app/streetcar.ts';
import {pccExitX} from '../app/pcc-layout.ts';
import {createLandscape} from '../app/landscape.ts';
import {ferryTreads} from '../app/ferry-portico-access.ts';
import {createStreetVehicle,streetVehicleMaterial} from '../app/street-vehicles.ts';
import {waterfrontCar,waterfrontCarCount} from '../app/waterfront-routes.ts';
import {marketPedestrianPhase,signalAspects,signalPeriod} from '../app/waterfront-signals.ts';

const down=new T.Vector3(0,-1,0),ray=new T.Raycaster();
const vector=p=>new T.Vector3(p.x,p.y,p.z);
function assertNear(actual,expected,tolerance,what){
  assert.ok(Math.abs(actual-expected)<=tolerance,what+' expected '+expected+' measured '+actual);
}
function checkTorso(p,objects,t){
  for(const [x,z] of [[1,0],[0,1],[.707,.707],[-.707,.707]]){
    const dir=new T.Vector3(x,0,z);
    const from=new T.Vector3(p.x,p.y+.068,p.z).addScaledVector(dir,-.013);
    ray.set(from,dir);ray.far=.026;
    assert.equal(ray.intersectObjects(objects,false).length,0,'blocked torso at '+[t,p.x,p.z]);
  }
}

test('the Ferry traveler rides 1051 and steps down all four physical treads in the open center exit',()=>{
  const car=createStreetcar().group,parts=[];car.traverseVisible(part=>{if(part.isMesh)parts.push(part);});
  const passenger=createFerryPassenger();
  const pose=t=>driverPose('streetcar',museumLegDuration+t).body;
  for(const t of [-8,-3,0,2.05,2.59,3.14,3.68]){
    const body=pose(t);car.position.set(body.x,body.y,body.z);car.rotation.y=body.heading;car.rotation.z=body.pitch;
    setPccExitDoor(car,washingtonDoorOpening(t));car.updateMatrixWorld(true);
    const p=ferryPassengerPose(t,t+7,body);passenger.update(t,t+7,body);
    assert.ok(passenger.rider.visible&&p.visible);
    assert.ok(passenger.rider.position.distanceTo(vector(p))<1e-8);
    const local=car.worldToLocal(vector(p));
    assertNear(local.x,pccExitX,.0001,'feet aligned with center door');
    if(t<0)continue;
    ray.set(vector(p).addScaledVector(down,-.003),down);ray.far=.006;
    assertNear(ray.intersectObjects(parts,false)[0]?.point.y,p.y,.0002,'tread supports both travel and rendered root at '+t);
    if(t>0){
      assert.equal(washingtonDoorOpening(t),1);checkTorso(p,parts,t);
    }
  }
});

// Extract the actual rendered triangles that intersect this route's box. This
// preserves source winding and the paving shader's original mesh transform
// without ray-testing the rest of downtown on every sample.
function routeSurfaces(world){
  const limits=new T.Box3(new T.Vector3(-.55,.010,-3.57),new T.Vector3(1.95,.22,-.65));
  const points=[],a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),bounds=new T.Box3();
  for(const o of [...world.architectureChunks,world.root.getObjectByName('Market granite and herringbone promenade')]){
    if(!bounds.setFromObject(o).intersectsBox(limits))continue;
    const g=o.geometry,attr=g.attributes.position;
    for(let i=0;i<g.index.count;i+=3){
      a.fromBufferAttribute(attr,g.index.getX(i)).applyMatrix4(o.matrixWorld);
      b.fromBufferAttribute(attr,g.index.getX(i+1)).applyMatrix4(o.matrixWorld);
      c.fromBufferAttribute(attr,g.index.getX(i+2)).applyMatrix4(o.matrixWorld);
      bounds.makeEmpty().expandByPoint(a).expandByPoint(b).expandByPoint(c);
      if(bounds.intersectsBox(limits))points.push(...a.toArray(),...b.toArray(),...c.toArray());
    }
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points,3));
  return new T.Mesh(g,new T.MeshBasicMaterial());
}
test('the entire exit has a supported low berth, ramp, refuge, road, seven treads and a clear path inside the Ferry Building',()=>{
  const world=createLandscape();world.root.updateMatrixWorld(true);
  const surface=routeSurfaces(world),objects=[surface],seenTreads=new Set();
  const stages=new Set();
  // At this signal offset the rider reaches the button at the start of WALK.
  for(let i=0;i<620;i++){
    const t=4.36+i*.1,p=ferryPassengerPose(t,t+7);
    if(!p.visible)break;
    ray.set(vector(p).addScaledVector(down,-.007),down);ray.far=.018;
    const top=ray.intersectObject(surface,false)[0]?.point.y;
    if(p.z>=-1.986&&p.z<=-1.762){
      // Verify the middle of each tread, away from the raised next nosing.
      const tread=ferryTreads.find(q=>Math.abs(q.z-p.z)<.007);
      if(tread){assertNear(top,tread.top,.00020,'physical stair at '+p.z);assertNear(p.y,tread.top,.00020,'sole on stair');seenTreads.add(tread.z);}
    }else{
      assertNear(top,p.y,.0020,'foot support at '+[t.toFixed(2),p.x.toFixed(3),p.z.toFixed(3)]);
    }
    checkTorso(p,objects,t);
    if(p.x>1.20&&p.z< -3.4&&Math.abs(p.y-.067)<.0001)stages.add('low berth');
    if(p.x>.45&&p.x<.8&&p.y>.031&&p.y<.067)stages.add('ramp');
    if(p.z> -3.28&&p.z< -3.22)stages.add('refuge');
    if(p.z> -2.9&&p.z< -2.55)stages.add('road');
    if(p.z> -1.35&&Math.abs(p.y-.103)<.0002)stages.add('hall');
  }
  assert.equal(seenTreads.size,7);assert.equal(stages.size,5);
  surface.geometry.dispose();surface.material.dispose();
});

test('every signal start offset admits the passenger on WALK and clears the live traffic lanes before release',()=>{
  const material=streetVehicleMaterial();
  const bounds=Array.from({length:4},(_,i)=>{
    const car=createStreetVehicle(i,material),box=new T.Box3().setFromObject(car);
    car.traverse(p=>p.geometry?.dispose());
    return {nose:.25*Math.max(-box.min.x,box.max.x),halfWidth:.25*Math.max(-box.min.z,box.max.z)};
  });
  material.dispose();
  for(let offset=0;offset<signalPeriod;offset++){
    let began=false,crossed=false,clear=false;
    for(let i=0;i<=1000;i++){
      const t=31+i*.08,elapsed=offset+t,p=ferryPassengerPose(t,elapsed);
      if(!began&&p.z> -3.24499){
        assert.equal(marketPedestrianPhase(elapsed),'walk','start offset '+offset);began=true;
      }else if(!began){
        assertNear(p.x,-.20,1e-7,'stationary refuge');assertNear(p.z,-3.245,1e-7,'stationary refuge');
      }
      if(p.z>=-2.382){clear=true;break;}
      if(p.z> -3.066){
        crossed=true;assert.equal(signalAspects(elapsed)[0],0);
        for(const region of [undefined,'plaza'])for(let n=0;n<waterfrontCarCount(region);n++){
          const car=waterfrontCar(elapsed,n,region);
          if(!car.active||Math.abs(car.x-p.x)>.3)continue;
          const dx=p.x-car.x,dz=p.z-car.z,c=Math.cos(car.heading),s=Math.sin(car.heading),profile=bounds[n%4];
          assert.ok(Math.abs(dx*c-dz*s)>profile.nose+.015||Math.abs(dx*s+dz*c)>profile.halfWidth+.015,
            'traveler overlaps active vehicle '+[region,n,offset,t]);
        }
      }
    }
    assert.ok(began&&crossed&&clear,'completed crossing at start offset '+offset);
  }
});

test('full and plaza ambient cycles finish in the hall, clear the old traveler, and reintroduce the next aboard a moving car',()=>{
  for(const plaza of [false,true]){
    const period=ambientStreetcarPeriod(plaza),call=t=>ambientStreetcarCall(t,plaza);
    let lastTime=-Infinity,wasVisible=false,finished=0,joins=0;
    for(let i=0;i<Math.ceil(period*(plaza?6:2)*5);i++){
      const elapsed=i/5,a=call(elapsed),body=streetcarPose(a.station);
      const p=ferryPassengerPose(a.passengerTime,elapsed,body);
      if(a.passengerTime<lastTime){
        assert.equal(wasVisible,false,'prior person already out of sight at cycle reset');
        assert.ok(p.visible&&a.ferryTime< -11.7&&a.ferryTime>=-12.01);
        assert.ok(Math.hypot(p.x-body.x,p.z-body.z)<.20,'new traveler is aboard the approaching car');
        joins++;
      }else if(wasVisible&&!p.visible){
        assert.ok(p.z> -1.10&&Math.abs(p.y-.103)<.002,'leaves scene inside the hall');finished++;
      }
      if(a.ferryTime<-.1&&a.ferryTime>-.5&&a.passengerTime>30)assert.ok(p.x<.45,'shorter vehicle lap cannot restart the passenger');
      wasVisible=p.visible;lastTime=a.passengerTime;
    }
    assert.ok(finished>=1&&joins>=1);
  }
});
