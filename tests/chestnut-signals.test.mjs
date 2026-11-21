import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createLandscape} from '../app/landscape.ts';
import {chestnutPedestrianHeads,chestnutVehicleHeads} from '../app/chestnut-signals.ts';
import {createSignalHousings,createStreetField,createStreetIllumination,signalLensCenter} from '../app/street-illumination.ts';
import {driverPose} from '../app/driver-rides.ts';
import {signalAspects} from '../app/waterfront-signals.ts';

test('Chestnut standards rise from surveyed pavement and WALK faces point toward the waiting lanes',()=>{
  const city=createLandscape(),housing=createSignalHousings();
  const lighting=createStreetIllumination(new T.Group(),[],new T.MeshBasicMaterial());
  lighting.update(39,1);
  city.root.updateMatrixWorld(true);
  const down=new T.Vector3(0,-1,0);
  for(const [i,h] of chestnutPedestrianHeads.entries()){
    const other=chestnutPedestrianHeads[i^1],normal=new T.Vector3(Math.sin(h.angle),0,Math.cos(h.angle));
    const toward=new T.Vector3(other.x-h.x,0,other.z-h.z).normalize();
    assert.ok(toward.dot(normal)>.999);
    const land=new T.Raycaster(new T.Vector3(h.x+.012,h.y+.05,h.z),down).intersectObjects(city.architectureChunks)[0];
    assert.ok(land&&Math.abs(land.point.y-h.y)<.001,'pavement support '+i);
    const offset=h.side-.001;
    const origin=new T.Vector3(h.x+normal.z*offset,h.y+.165,h.z-normal.x*offset).addScaledVector(normal,.28);
    const ray=new T.Raycaster(origin,normal.clone().negate(),0,.30);
    const light=ray.intersectObject(lighting.lenses)[0],back=ray.intersectObject(housing)[0];
    assert.ok(light&&back&&light.distance<back.distance&&back.distance-light.distance<.001);
  }
  lighting.dispose();housing.geometry.dispose();
});

test('Chestnut overhead signals face the approaching passenger and illuminate the junction in their shared phase',()=>{
  const lighting=createStreetIllumination(new T.Group(),[],new T.MeshBasicMaterial()),housing=createSignalHousings();
  const field=createStreetField([]),{width,data}=field.image;
  const colors=['#ff4938','#ffc444','#65d98e'].map(c=>new T.Vector3(...new T.Color(c).toArray()));
  for(const h of chestnutVehicleHeads){
    const normal=new T.Vector3(Math.sin(h.heading),0,Math.cos(h.heading));
    const center=signalLensCenter(h),u=Math.floor((center.x-78)/.12),v=674+Math.floor((center.z+6.5)/.12);
    assert.ok(data[(v*width+u)*4+1+h.axis]>100,'signal spill tracked on the northern quay');
    for(const t of [18,34,37,45,60]){
      const aspect=signalAspects(t)[h.axis];lighting.update(t,1);
      const target=signalLensCenter(h,aspect),origin=target.clone().addScaledVector(normal,.45);
      const ray=new T.Raycaster(origin,normal.clone().negate(),0,.48);
      const front=ray.intersectObject(lighting.lenses)[0],casing=ray.intersectObject(housing)[0];
      assert.ok(front&&casing&&front.distance<casing.distance);
      assert.ok(new T.Vector3().fromBufferAttribute(lighting.lenses.geometry.attributes.color,front.face.a).distanceTo(colors[aspect])<.00001);
    }
  }
  const t=527.9,eye=driverPose('bridge',t).eye;
  assert.equal(signalAspects(t)[0],2);
  for(const h of chestnutVehicleHeads.filter(h=>h.heading<0)){
    const center=signalLensCenter(h,2),p=new T.Vector3(eye.x,eye.y,eye.z);
    const to=p.clone().sub(center).normalize();
    assert.ok(to.dot(new T.Vector3(Math.sin(h.heading),0,Math.cos(h.heading)))>.96);
  }
  field.dispose();lighting.dispose();housing.geometry.dispose();
});
