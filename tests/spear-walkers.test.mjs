import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {spearWalkerCount,spearWalkerPose} from '../app/spear-walkers.ts';
import {waterfrontWalkerCount,waterfrontWalker,waterfrontCar,waterfrontCarCount} from '../app/waterfront-routes.ts';
import {signalAspects,signalPeriod} from '../app/waterfront-signals.ts';
import {addSurveyBlocks} from '../app/survey-blocks.ts';
import {driverPose,rideDuration} from '../app/driver-rides.ts';

test('three ordinary city cast slots wait on sidewalks and traverse one registered leg on their green',()=>{
  const ids=Array.from({length:waterfrontWalkerCount()},(_,i)=>i).filter(i=>{
    const p=waterfrontWalker(0,i);return Math.hypot(p.x+25.894,p.z+12.65)<1.33;
  });
  assert.equal(spearWalkerCount,3);assert.equal(ids.length,3);
  for(let t=-1;t<signalPeriod*2;t+=.125){
    const walkers=ids.map((id,i)=>{
      const p=waterfrontWalker(t,id),before=spearWalkerPose(t-.125,i);
      assert.deepEqual(p,spearWalkerPose(t,i));
      const speed=Math.hypot(p.x-before.x,p.z-before.z)/.125;
      assert.ok(speed<.095);
      assert.ok(Math.cos(p.heading-before.heading)>.98);
      if(p.standing)assert.equal(p.y,.045);
      else assert.equal(signalAspects(t)[i===2?1:0],2);
      // Both registered mast bases, including the main mast on the right.
      for(const [u,v] of [[171,429],[438,432]]){
        const x=-25.894+(.988686*(u-300)+.150004*(v-300))/200;
        const z=-12.65+(-.150004*(u-300)+.988686*(v-300))/200;
        assert.ok(Math.hypot(p.x-x,p.z-z)>.072,'mast and shoulder clearance');
      }
      return p;
    });
    for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)
      assert.ok(Math.hypot(walkers[i].x-walkers[j].x,walkers[i].z-walkers[j].z)>.060,'pedestrians have shoulder clearance');
  }
  assert.ok(ids.every(id=>waterfrontWalker(292,id).standing));
  assert.equal(waterfrontWalker(296,ids[2]).standing,false);
});

test('pedestrians remain on the actual municipal sidewalks, gutter cuts and marked asphalt',()=>{
  const root=new THREE.Group();addSurveyBlocks(g=>{const m=new THREE.Mesh(g);root.add(m);return m;});
  const ray=new THREE.Raycaster();ray.ray.direction.set(0,-1,0);
  const bounds=new THREE.Box3(new THREE.Vector3(-27.3,0,-14),new THREE.Vector3(-24.6,.055,-11.4));
  const local=root.children.filter(m=>new THREE.Box3().setFromObject(m).intersectsBox(bounds));
  for(let i=0;i<3;i++){
    let paintHits=0;
    for(let n=0;n<signalPeriod*12;n++){
      const p=spearWalkerPose(n/12,i);ray.ray.origin.set(p.x,.055,p.z);
      let surface=ray.intersectObjects(local,false)[0];
      // The independently surveyed curb back and sidewalk have a <2 cm seam.
      // Sample the same shoe sole on either side when the center hits that seam.
      for(const shift of [-.002,.002]){
        if(surface)break;
        ray.ray.origin.set(p.x+shift*Math.cos(p.heading),.055,p.z+shift*Math.sin(p.heading));
        surface=ray.intersectObjects(local,false)[0];
      }
      assert.ok(surface,'unsupported sole '+n+'/'+i);
      assert.ok(Math.abs(surface.point.y-p.y)<.0016,'foot height '+n+'/'+i+' '+surface.point.y+' / '+p.y);
      if(surface.object.name==='Crosswalk paint · Howard / Spear')paintHits++;
    }
    assert.ok(paintHits>18,'foot path traverses the stripes');
  }
});

test('the full bridge drive clears each crossing pedestrian',()=>{
  let checks=0;
  for(let t=0;t<rideDuration('bridge');t+=.04){
    const {eye}=driverPose('bridge',t);
    if(Math.hypot(eye.x+25.894,eye.z+12.65)>2.9)continue;
    for(let i=0;i<3;i++){
      const p=spearWalkerPose(t,i);
      assert.ok(Math.hypot(eye.x-p.x,eye.z-p.z)>.21,'sedan footprint '+i+' at '+t);
      checks++;
    }
  }
  assert.ok(checks>250);
  for(let t=0;t<signalPeriod*2;t+=.5){
    const walkers=Array.from({length:spearWalkerCount},(_,i)=>spearWalkerPose(t,i));
    for(let i=0;i<waterfrontCarCount();i++){
      const car=waterfrontCar(t,i);
      if(car.active)for(const p of walkers)
        assert.ok(Math.hypot(car.x-p.x,car.z-p.z)>.26,'moving street vehicle clearance');
    }
  }
});
