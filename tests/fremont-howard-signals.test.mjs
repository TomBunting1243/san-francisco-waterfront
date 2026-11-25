import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {fremontPedestrianHeads,fremontPoles,fremontVehicleHeads} from '../app/fremont-howard-signals.ts';
import {createStreetIllumination,createSignalHousings,signalLensCenter} from '../app/street-illumination.ts';
import {signalAspects,fremontClockOffset} from '../app/waterfront-signals.ts';
import {driverPose} from '../app/driver-rides.ts';
import {addSurveyBlocks} from '../app/survey-blocks.ts';

const lighting=createStreetIllumination(new T.Group(),[],new T.MeshStandardMaterial());
const housing=createSignalHousings();
const ink=['ff4938','ffc444','65d98e'];
function fromDriver(t){
  const {eye}=driverPose('bridge',t);return new T.Vector3(eye.x,eye.y,eye.z);
}
test('photographed Howard and Fremont vehicle faces operate on the Fremont cabinet in daylight and at night',()=>{
  assert.equal(fremontVehicleHeads.filter(h=>h.axis===0).length,3);
  assert.equal(fremontVehicleHeads.filter(h=>h.axis===1).length,4);
  for(const dusk of [0,1])for(const t of [224,233,239,240,250,255.5,259,272,276,278,282]){
    lighting.update(t,dusk);
    const phase=signalAspects(t+fremontClockOffset);
    for(const h of fremontVehicleHeads){
      const section=phase[h.axis],p=signalLensCenter(h,section);
      const normal=new T.Vector3(Math.sin(h.heading),0,Math.cos(h.heading));
      const ray=new T.Raycaster(p.clone().addScaledVector(normal,.032),normal.clone().negate(),0,.034);
      const face=ray.intersectObject(lighting.lenses)[0],shell=ray.intersectObject(housing)[0];
      assert.ok(face&&shell&&face.distance<shell.distance);
      assert.equal(new T.Color().fromBufferAttribute(lighting.lenses.geometry.attributes.color,face.face.a).getHexString(),ink[section]);
      if(h.axis===0&&t===250){
        const eye=fromDriver(t),d=p.clone().sub(eye).normalize();
        assert.ok(d.dot(normal)<-.88);
        ray.set(eye,d);ray.far=eye.distanceTo(p)+.0001;
        assert.ok(ray.intersectObject(lighting.lenses)[0].distance<(ray.intersectObject(housing)[0]?.distance??Infinity));
      }
    }
  }
});
test('four corner shafts sit fully on raised paving and serve all four pedestrian crossings',()=>{
  const paving=[];addSurveyBlocks(g=>{g.computeBoundingBox();const m=new T.Mesh(g);paving.push(m);return m;});
  for(const pole of Object.values(fremontPoles)){
    const attached=fremontPedestrianHeads.filter(h=>h.x===pole.x&&h.z===pole.z);
    assert.equal(attached.length,2);
    assert.ok(Math.abs(Math.cos(attached[0].angle-attached[1].angle))<.25);
    for(let i=0;i<12;i++){
      const x=pole.x+.0075*Math.cos(i*Math.PI/6),z=pole.z+.0075*Math.sin(i*Math.PI/6);
      const ray=new T.Raycaster(new T.Vector3(x,.10,z),new T.Vector3(0,-1,0),0,.10);
      const top=ray.intersectObjects(paving)[0];assert.ok(top&&Math.abs(top.point.y-pole.y)<.0001);
    }
  }
  const g=lighting.lenses.geometry;
  for(const t of [24,50]){
    lighting.update(t,0);
    for(const h of fremontPedestrianHeads){
      const center=new T.Vector3(h.x+Math.cos(h.angle)*.028+Math.sin(h.angle)*.0071,h.y+.156,h.z-Math.sin(h.angle)*.028+Math.cos(h.angle)*.0071);
      const colors=new Set(),pt=new T.Vector3();
      for(let i=0;i<g.index.count;i+=3){
        const j=g.index.getX(i);if(j===g.index.getX(i+1))continue;
        pt.fromBufferAttribute(g.attributes.position,j);
        if(pt.distanceTo(center)>.016)continue;
        colors.add(new T.Color().fromBufferAttribute(g.attributes.color,j).getHexString());
      }
      const walks=(t+h.clockOffset)%64>=38&&(t+h.clockOffset)%64<46;
      assert.deepEqual([...colors], [walks?'fff6e8':'ff8729']);
    }
  }
});

test('Fremont green covers the first bumper at the measured limit line through the last bumper exiting the Howard crossing',()=>{
  // Traced city-ortho stop stripe and the outer edge of the east-leg ladder.
  const stop=[[-29.74707,-32.45924],[-29.60057,-31.38906]];
  const exit=[[-28.10030,-31.28912],[-29.12124,-31.13288]];
  function signed(line,x,z){
    const [[a,b],[c,d]]=line;
    return ((x-a)*(d-b)-(z-b)*(c-a))/Math.hypot(c-a,d-b);
  }
  let entered,cleared;
  for(let frame=247*120;frame<265*120;frame++){
    const t=frame/120,{eye,look}=driverPose('bridge',t);
    const forward=new T.Vector2(look.x-eye.x,look.z-eye.z).normalize(),right=new T.Vector2(-forward.y,forward.x);
    const center=new T.Vector2(eye.x,eye.z).addScaledVector(right,.0228);
    const bumper=(fore,side)=>center.clone().addScaledVector(forward,fore).addScaledVector(right,side);
    const nose=[bumper(.14,-.054),bumper(.14,.054)],tail=[bumper(-.14,-.054),bumper(-.14,.054)];
    if(entered===undefined&&nose.some(p=>signed(stop,p.x,p.y)>=-.010))entered=t;
    if(entered!==undefined){
      assert.deepEqual(signalAspects(t+fremontClockOffset),[2,0]);
      if(tail.every(p=>signed(exit,p.x,p.y)>.005)){cleared=t;break;}
    }
  }
  assert.ok(entered>252&&entered<254&&cleared>257&&cleared<261);
});

test('both sedan axles stay on asphalt inside the Fremont turn pocket and the single eastbound Howard travel lane',()=>{
  const surfaces=[];
  addSurveyBlocks(g=>{g.computeBoundingBox();const m=new T.Mesh(g);surfaces.push(m);return m;});
  const ray=new T.Raycaster(new T.Vector3(),new T.Vector3(0,-1,0),0,.085);
  const arrowHits=new Set();let eastSamples=0;
  for(let frame=246*12;frame<=276*12;frame++){
    const {eye,look}=driverPose('bridge',frame/12);
    const d=new T.Vector2(look.x-eye.x,look.z-eye.z).normalize();
    for(const along of [-.09,.09])for(const side of [-.054,.054]){
      const x=eye.x+along*d.x-(.0228+side)*d.y,z=eye.z+along*d.y+(.0228+side)*d.x;
      const a=x+28.766041,b=z+30.979132;
      const u=245+(.001297019*a+.008473203*b)/(.06/7)**2;
      const v=245+(-.008473203*a+.001297019*b)/(.06/7)**2;
      if(v>=334&&v<=484){
        const divider=149-2*(v-334)/150;
        assert.ok(u>divider+1&&u<173,'Fremont tire stays between divider and east curb');
        for(const station of [378,475])if(Math.abs(station-v)<3)arrowHits.add(station);
      }
      if(u>=245&&u<=762){
        assert.ok(v>250&&v<268,'Howard tire stays between yellow and parked vehicles');
        eastSamples++;
      }
      ray.ray.origin.set(x,.10,z);
      const chunks=surfaces.filter(({geometry:{boundingBox:box}})=>x>=box.min.x&&x<=box.max.x&&z>=box.min.z&&z<=box.max.z);
      const hit=ray.intersectObjects(chunks)[0];
      assert.ok(hit&&Math.abs(hit.point.y-.031)<.002,'surveyed asphalt at both axles '+[u,v,hit?.point.y]);
    }
  }
  assert.deepEqual([...arrowHits].sort(),[378,475]);assert.ok(eastSamples>300);
});
