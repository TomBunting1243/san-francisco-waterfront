import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {bealePoles,bealePedestrianHeads,bealeVehicleHeads} from '../app/howard-beale-signals.ts';
import {collectStreetGlobes,createStreetField,createStreetIllumination,createSignalHousings,signalLensCenter} from '../app/street-illumination.ts';
import {signalAspects,marketPedestrianPhase} from '../app/waterfront-signals.ts';
import {addSurveyBlocks} from '../app/survey-blocks.ts';
import {driverPose} from '../app/driver-rides.ts';
import crossings from '../public/data/transbay-crossings.json' with {type:'json'};

test('photographed Park Tower repeater and Beale mast face the approaching traffic and operate in the shared batch',()=>{
  const system=createStreetIllumination(new T.Group(),[],new T.MeshStandardMaterial()),shell=createSignalHousings();
  for(const dusk of [0,1])for(const t of [0,32,36,38,58,62,268]){
    system.update(t,dusk);const phases=signalAspects(t);
    for(const h of bealeVehicleHeads){
      const a=phases[h.axis],c=signalLensCenter(h,a),normal=new T.Vector3(Math.sin(h.heading),0,Math.cos(h.heading));
      const ray=new T.Raycaster(c.clone().addScaledVector(normal,.03),normal.clone().negate(),0,.032);
      const lens=ray.intersectObject(system.lenses)[0];assert.ok(lens);
      assert.ok(lens.distance<ray.intersectObject(shell)[0].distance);
      assert.equal(new T.Color().fromBufferAttribute(system.lenses.geometry.attributes.color,lens.face.a).getHexString(),['ff4938','ffc444','65d98e'][a]);
    }
  }
  for(const t of [262,264,266]){
    const {eye}=driverPose('bridge',t);const p=new T.Vector3(eye.x,eye.y,eye.z),face=bealeVehicleHeads[0],target=signalLensCenter(face,2),d=target.clone().sub(p).normalize();
    assert.ok(d.x*Math.sin(face.heading)+d.z*Math.cos(face.heading)<-.8);
    const r=new T.Raycaster(p,d,0,target.distanceTo(p)+.0002);
    assert.ok(r.intersectObject(system.lenses)[0].distance<(r.intersectObject(shell)[0]?.distance??Infinity));
  }
});
test('both measured standards have their complete footprint on raised ground, and the attached pedestrian faces clear cross traffic',()=>{
  const ground=[];addSurveyBlocks(g=>{const m=new T.Mesh(g);g.computeBoundingBox();ground.push(m);return m;});
  for(const p of Object.values(bealePoles))for(let i=0;i<12;i++){
    const x=p.x+.010*Math.cos(i*Math.PI/6),z=p.z+.010*Math.sin(i*Math.PI/6);
    const r=new T.Raycaster(new T.Vector3(x,.08,z),new T.Vector3(0,-1,0),0,.08);
    const h=r.intersectObjects(ground.filter(({geometry:{boundingBox:b}})=>x>=b.min.x&&x<=b.max.x&&z>=b.min.z&&z<=b.max.z))[0];
    assert.ok(h&&Math.abs(h.point.y-p.y)<.00022,'landing '+[x,z,h?.point.y]);
  }
  for(let t=0;t<64;t+=.5)for(const p of bealePedestrianHeads){
    if(marketPedestrianPhase(t+p.clockOffset)==='walk')assert.equal(signalAspects(t)[p.clockOffset===38?1:0],0);
  }
});
test('the bridge sedan sees green from entry into the Beale west crosswalk through rear-bumper clearance of the east crosswalk',()=>{
  const site=crossings.sites.find(s=>s.name==='Howard / Beale');
  const forward=new T.Vector2(.15131,.98849);
  const extent=leg=>site.legs.find(l=>l.side===leg).marks.flat(2).map(([x,z])=>x*forward.x+z*forward.y);
  const first=Math.min(...extent('inland')),last=Math.max(...extent('bay'));
  let entered,cleared;
  for(let frame=260*120;frame<=277*120;frame++){
    const t=frame/120,{eye,look}=driverPose('bridge',t),d=new T.Vector2(look.x-eye.x,look.z-eye.z).normalize();
    const right=new T.Vector2(-d.y,d.x),center=new T.Vector2(eye.x,eye.z).addScaledVector(right,.0228);
    const projected=center.dot(forward),reach=.14*Math.abs(d.dot(forward))+.054*Math.abs(right.dot(forward));
    if(projected+reach<first)continue;
    if(!entered)entered=t;
    if(projected-reach>last){cleared=t;break;}
    assert.deepEqual(signalAspects(t),[2,0]);
  }
  assert.ok(entered>265&&entered<270&&cleared>268&&cleared<274,[entered,cleared]);
});

test('both Beale mast lamps light the pavement directly beneath the modeled lenses',()=>{
  const shell=createSignalHousings(),globes=collectStreetGlobes(shell,[]);
  assert.equal(globes.length,6);
  const field=createStreetField(globes),{width,data}=field.image;
  const read=(x,z)=>4*(Math.floor((z+64)/.12)*width+Math.floor((x+56)/.12));
  for(let i=0;i<globes.length;i+=3){
    const [x,y,z]=globes.slice(i,i+3),texel=read(x,z);
    assert.ok(data[texel]>215&&Math.abs(data[texel+3]/255-y)<.005);
    assert.ok(data[read(x+.8,z)]<data[texel]/2);
    const ray=new T.Raycaster(new T.Vector3(x,y-.002,z),new T.Vector3(0,1,0),0,.008);
    const surface=ray.intersectObject(shell)[0];
    assert.ok(surface&&Math.abs(surface.point.y-y)<.0001);
  }
  field.dispose();
});
