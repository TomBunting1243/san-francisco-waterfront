import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {addSurveyBlocks} from '../app/survey-blocks.ts';
import {howardMissionCyclePoint} from '../app/howard-mission-bikeway.ts';
import {bakeRigidChunk} from '../app/city-blocks.ts';
import {driverPose} from '../app/driver-rides.ts';
import {waterfrontCar} from '../app/waterfront-routes.ts';
import {streetVehicleNose} from '../app/street-vehicles.ts';

const scene=[];
addSurveyBlocks(g=>{g.computeBoundingBox();const m=new T.Mesh(g);scene.push(m);return m;});
const parts=scene.filter(m=>m.geometry.boundingBox.intersectsBox(new T.Box3(new T.Vector3(-23.2,.029,-2.5),new T.Vector3(-13.2,.10,-.60))));
const rails=parts.find(m=>m.name==='Howard–Mission concrete islands and railings');
const paint=parts.find(m=>m.name==='Howard–Mission receiving lanes');
const ray=new T.Raycaster(undefined,new T.Vector3(0,-1,0),0,.2);
function hits(x,z,list=parts){
  ray.ray.origin.set(x,.18,z);
  return ray.intersectObjects(list,false).filter(h=>h.face.normal.y>.4);
}
const at=(u,d,list)=>{const {x,z}=howardMissionCyclePoint(u,-1);return hits(x,z-(16+d)/132,list);};
function triangles(part,inspect){
  const g=part.geometry,idx=g.index,xyz=g.attributes.position;
  for(let i=0;i<idx.count;i+=3){
    const a=new T.Vector3().fromBufferAttribute(xyz,idx.getX(i)),b=new T.Vector3().fromBufferAttribute(xyz,idx.getX(i+1)),c=new T.Vector3().fromBufferAttribute(xyz,idx.getX(i+2));
    inspect(a,b,c);
  }
}

test('every receiving-lane paint triangle is asphalt-supported and isolated from the existing Howard and Mission crossings',()=>{
  assert.ok(rails&&paint);assert.equal(paint.geometry.userData.roadPaint,'Waterfront crossings');
  triangles(paint,(a,b,c)=>{
    assert.ok(new T.Triangle(a,b,c).getNormal(new T.Vector3()).y>.99);
    const mid=a.add(b).add(c).multiplyScalar(1/3),h=hits(mid.x,mid.z);
    assert.equal(h.filter(q=>q.object.geometry.userData.roadPaint).length,1,'paint overlaps at '+mid.toArray());
    assert.equal(h[0].object,paint);
    assert.ok(Math.abs(h[1].point.y-.031)<1e-5,'pavement under paint');
  });
  for(const [u,v] of [[4398,400.4],[4900,461],[5270,506],[5560,533]]){
    assert.equal(hits(-56+u/132,2-v/132)[0].object,paint);
  }
  assert.equal(at(5001,26)[0].object===paint,false);
});

test('the 1.5 m resurfaced ribbon replaces the road surface below the existing northbound markings',()=>{
  // Sample away from triangle diagonals. Each ray must find exactly one
  // asphalt face, with the neighbouring traffic-side pavement at the same height.
  for(let u=4354.31;u<5626;u+=7.39){
    for(const offset of [-37.7,-37.1,-31.2,-25.7,-25.1,-16.3]){
      const asphalt=at(u,offset).filter(h=>Math.abs(h.point.y-.031)<1e-5);
      assert.equal(asphalt.length,1,'single road surface at '+[u,offset]);
      const h=asphalt[0],c=new T.Color().fromBufferAttribute(h.object.geometry.attributes.color,h.face.a);
      const resurfaced=u<5562&&offset> -37.4&&offset< -25.4;
      assert.equal(c.getHexString(),resurfaced?'707e7d':'899692');
    }
  }
});

test('nineteen concrete plinths support paired open rails with real drainage gaps and an unobstructed two-way track',()=>{
  const gaps=[4399,4455,4511,4565,4621,4677,4732,4787,4842,4898,4953,5008,5063,5118,5173,5228,5283,5339,5395,5447];
  for(let i=1;i<gaps.length;i++){
    const l=gaps[i-1],r=gaps[i],mid=(l+r)/2;
    assert.ok(Math.abs(at(mid,-6.1)[0].point.y-.041)<1e-5);
    assert.ok(Math.abs(at(l+11,-6.1)[0].point.y-.0965)<.0005);
    assert.ok(Math.abs(at(r-11,-6.1)[0].point.y-.0965)<.0005);
    assert.ok(!at(l,-6.1,[rails]).length);
    assert.ok(!at(mid,-1.8,[rails]).length);
  }
  for(let u=4354;u<=5625;u+=9)for(const sign of [1,-1]){
    const {x,y,z}=howardMissionCyclePoint(u,sign);
    for(const offset of [-.023,0,.023]){
      const h=hits(x,z+offset);
      assert.ok(h.length&&Math.abs(h[0].point.y-y)<.0003,'rider clearance '+u);
    }
  }
});

test('the receiving white paint and island tops retain the existing road-lamp receiver through the static bake',()=>{
  const mat=new T.MeshStandardMaterial({vertexColors:true});
  for(const m of [paint,rails]){
    const g=bakeRigidChunk('test block',[m],mat).geometry;
    assert.ok(g.hasAttribute('roadExposure'));
    const exposure=g.attributes.roadExposure.array;
    if(m===paint)assert.ok(exposure.every(v=>v===1));
    else assert.ok(exposure.includes(1)&&exposure.includes(0));
    assert.ok(!g.hasAttribute('signLight'));
  }
  mat.dispose();
});

test('the swept passenger and ambient vehicle bodies remain inland of the concrete plinths and their white edge',()=>{
  let passenger=0,ambient=0;
  function check(cx,cz,f,s,nose,width){
    for(const fore of [-nose,nose])for(const side of [-width,width]){
      const x=cx+fore*f-side*s,z=cz+fore*s+side*f,u=(x+56)*132;
      if(u<4399||u>5447)continue;
      const edgeZ=howardMissionCyclePoint(u,-1).z-16/132;
      assert.ok((edgeZ-z)>.68/132,'vehicle projects onto white edge at '+[u,z,edgeZ]);
    }
  }
  for(let i=36700;i<40100;i+=2){
    const {eye,look}=driverPose('bridge',i/100),dx=look.x-eye.x,dz=look.z-eye.z,n=Math.hypot(dx,dz),f=dx/n,s=dz/n;
    const x=eye.x-.0228*s,z=eye.z+.0228*f;if(x< -23||x> -13)continue;
    check(x,z,f,s,.15,.064);passenger++;
  }
  for(let t=0;t<640;t+=.27)for(let i=1;i<56;i+=2){
    const car=waterfrontCar(t,i);if(!car.active||car.x< -23||car.x> -13)continue;
    check(car.x,car.z,Math.cos(car.heading),-Math.sin(car.heading),streetVehicleNose(i),.065);ambient++;
  }
  assert.ok(passenger>400&&ambient>400);
});
