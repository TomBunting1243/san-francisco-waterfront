import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createUrbanContext} from '../app/urban-context.ts';
import {addNorthQuayFront} from '../app/north-quay-bulkhead.ts';
import {northWaterfrontGrade,streetPose} from '../app/streets.ts';

test('Chestnut passenger sees two recessed pier entries, real window jambs and the former rail portals',()=>{
  const camera=new T.PerspectiveCamera(52,1.65,.012,170);
  camera.position.set(82.151604,.337971,-3.102951);camera.lookAt(89,.31,-4.59);camera.updateMatrixWorld(true);
  const city=createUrbanContext();assert.ok(city.prepareRideView(camera,Infinity));
  const ray=new T.Raycaster();
  for(const south of [true,false]){
    const lo=south?80.97:83.62,hi=south?83.64:91.94;
    const front=x=>(south?-2.19:-2.77)+(south?-.48:-1.59)*(x-lo)/(hi-lo);
    const floor=(northWaterfrontGrade(lo)+northWaterfrontGrade(hi))/2+.016;
    const samples=south?
      [[82.995,.49,.194],[82.45,.21,.098]]:
      [[90.205,.23,.189],[86.04,.21,.188],[86.63,.21,.190],[84.04,.21,.169],[84.41,.32,.150],[83.63,.32,.126]];
    for(const [x,h,dist] of samples){
      ray.set(new T.Vector3(x,floor+h,front(x)-.15),new T.Vector3(0,0,1));ray.far=.40;
      const top=ray.intersectObjects(city.children)[0];
      assert.ok(top&&Math.abs(top.distance-dist)<.003,'street-facing depth at '+[x,h]);
      assert.equal(top.object.geometry.attributes.uv.getX(top.face.a),-1,'generic facade shader would add false windows');
    }
    let corners=0,triangles=0;
    addNorthQuayFront({
      vertex(x,y,z){
        // Street-facing relief and both side returns stay behind the footway.
        assert.ok(z>=front(x)-.061,'stone projects beyond the measured wall allowance');
        assert.ok(z-streetPose(x,1).z>.59,'carriageway clearance at '+x);
        return corners++;
      },
      triangle(){triangles++;},quad(){triangles+=2;},
    },south);
    assert.ok(triangles<(south?1400:2500),'tile triangle budget');
  }
});

test('the pier promenade has one concrete surface from the inside of the surveyed curb to the street wall',async()=>{
  const {pier2931Walk}=await import('../app/north-quay-promenade.ts');
  const {addSurveyBlocks}=await import('../app/survey-blocks.ts');
  const group=new T.Group();addSurveyBlocks(geo=>{const m=new T.Mesh(geo);group.add(m);return m;});
  const street=group.getObjectByName('Northern Embarcadero street and pier approaches');
  const ray=new T.Raycaster(new T.Vector3(),new T.Vector3(0,-1,0));
  for(let x=81.013;x<91.94;x+=.0791){
    const {curbZ,wallZ,y}=pier2931Walk(x);
    assert.ok(wallZ-curbZ>.43);
    for(const t of [.006,.25,.75,.992]){
      ray.ray.origin.set(x,1,curbZ+(wallZ-curbZ)*t);
      const hits=ray.intersectObject(street);
      assert.equal(hits.length,1,'overlapping road or missing concrete at '+[x,t]);
      assert.ok(Math.abs(hits[0].point.y-y)<.00004);
      const tone=new T.Color().fromBufferAttribute(street.geometry.attributes.color,hits[0].face.a);
      assert.equal(tone.getHexString(),'c9c7b9');
    }
    ray.ray.origin.set(x,1,curbZ-.010);
    assert.ok(Math.abs(ray.intersectObject(street)[0].point.y-y)<.00004,'uncoupled curb top at '+x);
    ray.set(new T.Vector3(x,y-.009,curbZ-.13),new T.Vector3(0,0,1));
    const face=ray.intersectObject(street)[0];
    assert.ok(face&&Math.abs(face.distance-.105)<.002,'exposed road-side curb face at '+x);
    ray.ray.direction.set(0,-1,0);
  }
  assert.equal(pier2931Walk(80.9),undefined);assert.equal(pier2931Walk(92),undefined);
});
