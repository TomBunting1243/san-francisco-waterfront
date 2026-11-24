import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {howardPoles,howardVehicleHeads,howardSigns,howardPedestrianHeads,addHowardJunctionStandards} from '../app/howard-junction-signals.ts';
import {createSignalHousings,createStreetIllumination,signalLensCenter} from '../app/street-illumination.ts';
import {driverPose} from '../app/driver-rides.ts';
import {StreetAssembly} from '../app/street-amenities.ts';
import {buildStreetcarTrack} from '../app/streets.ts';
import {createLandscape} from '../app/landscape.ts';

const material=new T.MeshStandardMaterial(),housing=createSignalHousings(),lighting=createStreetIllumination(new T.Group(),[],material);
const color=(hit)=>new T.Color().fromBufferAttribute(lighting.lenses.geometry.attributes.color,hit.face.a).getHexString();
const normal=h=>new T.Vector3(Math.sin(h.heading),0,Math.cos(h.heading));
function probe(h,aspect,u=0,v=0){
  const f=normal(h),p=signalLensCenter(h,aspect).add(new T.Vector3(f.z*u,v,-f.x*u).multiplyScalar(.06));
  const r=new T.Raycaster(p.clone().addScaledVector(f,.030),f.negate(),0,.031);
  const hit=r.intersectObject(lighting.lenses)[0],back=r.intersectObject(housing)[0];
  assert.ok(back,'front-facing housing behind lens');
  if(hit)assert.ok(hit.distance<back.distance&&back.distance-hit.distance<.001);
  return hit;
}
test('Howard has six through faces and separate left and permissive-right turn faces visible at the actual passenger stop',()=>{
  assert.equal(howardVehicleHeads.filter(h=>h.axis===0).length,6);
  const turn=howardVehicleHeads.filter(h=>h.axis===1);assert.deepEqual(turn.map(h=>h.section),['left','left','rightYield','rightYield']);
  const eye=driverPose('bridge',320).eye,origin=new T.Vector3(eye.x,eye.y,eye.z);
  for(const dusk of [0,1])for(const [time,aspect,on] of [[317.1,1,true],[320,0,true],[357,0,true],[358.1,2,true],[358.6,2,false],[379.25,1,true]]){
    lighting.update(time,dusk);
    for(const h of howardVehicleHeads){
      if(h.axis===0){
        const current=time===320?2:time===357?0:0;
        assert.equal(color(probe(h,current)),['ff4938','ffc444','65d98e'][current]);
        continue;
      }
      const yieldArrow=h.section==='rightYield'&&aspect===2;
      const expected=yieldArrow?(on?'ffc444':'484234'):['ff4938','ffc444','65d98e'][aspect];
      assert.equal(color(probe(h,aspect)),expected);
      if(h.section==='left'||yieldArrow){
        const s=yieldArrow?1:-1;
        assert.ok(probe(h,aspect,.044*s,.067),'arrowhead points toward designated turn');
        assert.equal(probe(h,aspect,-.044*s,.067),undefined,'arrow is distinct from a straight-through ball');
      }
      const target=signalLensCenter(h,aspect),dir=target.clone().sub(origin).normalize();
      assert.ok(normal(h).dot(dir)<-.72,'faces the inbound driver');
      const ray=new T.Raycaster(origin,dir,0,origin.distanceTo(target)+.001);
      const lens=ray.intersectObject(lighting.lenses)[0],back=ray.intersectObject(housing)[0];
      assert.ok(lens&&(!back||lens.distance<back.distance),'housing or other mast obscures the indication from the stopped eye');
    }
  }
});

test('every shaft base is supported, shares its attachments, and clears the existing rail support shafts',()=>{
  const city=createLandscape();city.root.updateMatrixWorld(true);
  // Existing full-city geometry must leave the four stopped-eye sightlines
  // open as well as the gaps between the new masts and their own housings.
  const eye=driverPose('bridge',320).eye,origin=new T.Vector3(eye.x,eye.y,eye.z);
  for(const h of howardVehicleHeads.filter(h=>h.axis===1)){
    const target=signalLensCenter(h,2),d=target.sub(origin),far=d.length()-.0001;
    assert.equal(new T.Raycaster(origin,d.normalize(),.04,far).intersectObjects(city.architectureChunks).length,0);
  }
  for(const s of howardSigns){
    const n=new T.Vector3(Math.sin(s.heading),0,Math.cos(s.heading));
    const center=s.support.clone().addScaledVector(n,s.offset*.06);center.y+=s.height*.06;
    const d=center.clone().sub(origin),len=d.length(),direction=d.normalize();
    const front=new T.Raycaster(origin,direction,.04,len+.001).intersectObjects(city.architectureChunks)[0];
    assert.ok(front&&Math.abs(front.distance-len)*Math.abs(direction.dot(n))<.0012,'assembled sign visible '+s.code);
  }
  const assembly=new StreetAssembly();addHowardJunctionStandards(assembly);
  const ocs=[];buildStreetcarTrack(()=>new T.Object3D(),(a,b)=>{
    if(a.y<.06&&b.y>.35&&Math.hypot(a.x-b.x,a.z-b.z)<.001)ocs.push(a);return new T.Object3D();
  });
  for(const [id,p] of Object.entries(howardPoles)){
    const shafts=assembly.parts.filter(o=>o.geometry.type==='CylinderGeometry'&&Math.hypot(o.position.x-p.x,o.position.z-p.z)<.000001);
    assert.equal(shafts.length,1);
    assert.ok(ocs.every(a=>Math.hypot(a.x-p.x,a.z-p.z)>.20));
    for(let i=0;i<8;i++){
      const theta=i*Math.PI/4,origin=new T.Vector3(p.x+.0098*Math.cos(theta),p.y+.016,p.z+.0098*Math.sin(theta));
      const hit=new T.Raycaster(origin,new T.Vector3(0,-1,0),0,.03).intersectObjects(city.architectureChunks)[0];
      assert.ok(hit&&hit.point.y>p.y-.001&&hit.point.y<p.y+.006,'support ring '+id+' '+hit?.point.y+' versus '+p.y);
    }
  }
});

test('pedestrian faces aim across their own leg and give the two perpendicular crossings separate WALK intervals',()=>{
  for(const [i,h] of howardPedestrianHeads.entries()){
    const other=howardPedestrianHeads[i^1],f=new T.Vector3(Math.sin(h.angle),0,Math.cos(h.angle));
    assert.ok(f.dot(new T.Vector3(other.x-h.x,0,other.z-h.z).normalize())>.9999);
    const start=new T.Vector3(h.x+f.z*(h.side-.001),h.y+.165,h.z-f.x*(h.side-.001)).addScaledVector(f,.035);
    const ray=new T.Raycaster(start,f.negate(),0,.037);
    for(const time of [2,40]){
      lighting.update(time,.9);
      const hit=ray.intersectObject(lighting.lenses)[0];
      if(time===(h.clockOffset?2:40))assert.ok(hit&&color(hit)==='fff6e8');
      else assert.ok(!hit||color(hit)!=='fff6e8');
    }
  }
});

test('two 30-inch disks face into the rail mouth; the 48-by-16-inch ONE WAY points driver-left on its own lamp',()=>{
  assert.equal(howardSigns[0].support,howardPoles[3]);assert.equal(howardSigns[1].support,howardPoles[14]);
  const lamps=howardSigns.filter(s=>s.code==='R6-1');assert.equal(lamps.length,1);
  assert.ok(Math.abs(lamps[0].support.x+23.7249)<.00001&&Math.abs(lamps[0].support.z+.648)<.00001);
  const eye=driverPose('bridge',320).eye,origin=new T.Vector3(eye.x,eye.y,eye.z);
  const temporary=new StreetAssembly();addHowardJunctionStandards(temporary);
  const h=temporary.bake('Howard sign check'),col=h.geometry.attributes.color;
  for(const [i,s] of howardSigns.entries()){
    const n=new T.Vector3(Math.sin(s.heading),0,Math.cos(s.heading)),side=new T.Vector3(n.z,0,-n.x);
    const center=s.support.clone().addScaledVector(n,s.offset*.06);center.y+=s.height*.06;
    function ink(u,v){
      const probe=center.clone().addScaledVector(side,u*.06).addScaledVector(n,.006);probe.y+=v*.06;
      const hit=new T.Raycaster(probe,n.clone().negate(),0,.007).intersectObject(h)[0];
      return hit&&new T.Color().fromBufferAttribute(col,hit.face.a).getHexString();
    }
    assert.ok(n.dot(origin.clone().sub(center).normalize())>.23);
    const to=center.clone().sub(origin),length=to.length();
    const hit=new T.Raycaster(origin,to.normalize(),0,length+.001).intersectObject(h)[0];
    assert.ok(hit&&Math.abs(hit.distance-length)*Math.abs(to.dot(n))<.0012,'readable oblique face '+i);
    if(i<2){
      assert.ok(n.x*(i?-1:1)>.95);
      assert.equal(ink(0,0),'f0efe3');assert.equal(ink(.30,.06),'bc322a');
      assert.equal(ink(.375,0),'939690');assert.equal(ink(.387,0),undefined);
      assert.equal(ink(-.387,0),undefined);
    }else{
      assert.equal(ink(-.33,.12),'f0efe3');assert.equal(ink(.33,.12),'2a2e2a');
      assert.equal(ink(.60,.185),'f0efe3');assert.equal(ink(.616,0),undefined);
      assert.equal(ink(.02,.209),undefined);
    }
  }
  h.geometry.dispose();
});
