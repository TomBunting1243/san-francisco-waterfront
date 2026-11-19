import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createWaterfrontTraffic} from '../app/waterfront-traffic.ts';
import {waterfrontCar,waterfrontCarCount,waterfrontRoadRange} from '../app/waterfront-routes.ts';
import {createStreetVehicle,streetVehicleMaterial,streetVehicleNose} from '../app/street-vehicles.ts';
import {signalAspects,roadStopLines} from '../app/waterfront-signals.ts';

test('fitted nose matches the actual painted front bumper across all four fleet profiles',()=>{
  const material=streetVehicleMaterial();
  for(let i=0;i<4;i++){
    const mesh=createStreetVehicle(i,material).children[0];mesh.geometry.computeBoundingBox();
    assert.ok(Math.abs(mesh.geometry.boundingBox.max.x*.25-streetVehicleNose(i))<1e-6);
    mesh.geometry.dispose();
  }
  material.dispose();
});

test('each through lane forms a stationary queue, clears on green, and preserves bumper clearance throughout a full lap',()=>{
  const dt=.10;
  for(const region of [undefined,'street','plaza']){
    const count=waterfrontCarCount(region),maxTime=region?128:256;
    let smallest=Infinity,maxAccel=0,largestStep=0;
    const events={};
    const prev=Array.from({length:count},(_,i)=>waterfrontCar(-dt,i,region));
    const speed=Array(count).fill(undefined);
    for(let tick=0;tick<=Math.round(maxTime/dt);tick++){
      const t=tick*dt;
      const lanes=[[],[]];
      for(let i=0;i<count;i++){
        const d=i%2?1:-1,p=waterfrontCar(t,i,region),old=prev[i],nose=streetVehicleNose(i);
        if(p.active)lanes[i%2].push({x:d*p.x,nose});
        if(p.active&&old.active){
          const ds=d*(p.x-old.x),v=ds/dt;
          assert.ok(ds>=-1e-8&&ds<=.10);largestStep=Math.max(largestStep,ds);
          if(speed[i]!==undefined)maxAccel=Math.max(maxAccel,Math.abs(v-speed[i])/dt);
          speed[i]=v;
          const select=d>0?roadStopLines.north:roadStopLines.south;
          for(const [name,line] of Object.entries(select)){
            const [start,end]=waterfrontRoadRange(region);
            if(line<start||line>end)continue;
            const key=name+d,event=events[key]??={cross:0,queue:0};
            const before=d*(old.x-line)+nose,now=d*(p.x-line)+nose;
            const farLine=(d>0?roadStopLines.south:roadStopLines.north)[name];
            if(signalAspects(t)[0]!==2)assert.ok(now<=0||d*(p.x-farLine)>=nose,
              `rear still in controlled intersection at ${t}, ${name}, car ${i}`);
            if(before<0&&now>=0){
              assert.equal(signalAspects(t)[0],2,`${region} ${key} red crossing by ${i} at ${t}`);
              event.cross++;
            }
            if(Math.abs(v)<1e-7&&signalAspects(t)[0]===0&&Math.abs(now+.05)<1e-5)event.queue++;
          }
        }else speed[i]=undefined;
        prev[i]=p;
      }
      for(const lane of lanes){
        lane.sort((a,b)=>a.x-b.x);
        for(let i=1;i<lane.length;i++){
          const a=lane[i-1],b=lane[i];smallest=Math.min(smallest,b.x-a.x-a.nose-b.nose);
        }
      }
    }
    assert.ok(smallest>.27,`tightest bumper gap ${smallest}`);
    assert.ok(maxAccel<.197,`impulse near a signal ${maxAccel}`);
    for(const event of Object.values(events)){assert.equal(event.cross,count/2);assert.ok(event.queue>=30);}
    assert.equal(Object.keys(events).length,region==='street'?2:4);
    console.log(region||'whole city',{smallest,maxAccel,largestStep,events});
  }
});

test('outer road returns stay hidden in the render batch, and re-enter at the road boundary',()=>{
  const paint=streetVehicleMaterial(),live=createWaterfrontTraffic(paint,'plaza');
  const m=new THREE.Matrix4(),[start,end]=waterfrontRoadRange('plaza');
  let hidden=0,enters=0;
  for(let t=0;t<128;t+=.2){
    live.update(t);
    for(let i=0;i<20;i++){
      const p=waterfrontCar(t,i,'plaza'),prev=waterfrontCar(t-.2,i,'plaza');
      live.traffic[i%12].getMatrixAt(Math.floor(i/12),m);
      assert.equal(m.determinant()===0,!p.active);
      if(!p.active)hidden++;
      if(p.active&&!prev.active){
        assert.ok(Math.abs(p.x-(i%2?start:end))<.19);
        enters++;
      }
    }
  }
  assert.ok(hidden>100&&enters===20);
  for(const m of live.traffic)m.geometry.dispose();paint.dispose();
});
