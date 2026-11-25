import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {loadingVehicle,loadingPassenger,loadingCallAllowed,loadingDoor,loadingCarIndex} from '../app/mission-loading.ts';
import {waterfrontCar} from '../app/waterfront-routes.ts';
import {streetVehicleMaterial,streetVehicleNose,streetVehicleTreadHeight} from '../app/street-vehicles.ts';
import {createWaterfrontTraffic} from '../app/waterfront-traffic.ts';
import {driverPose} from '../app/driver-rides.ts';
import {addSurveyBlocks} from '../app/survey-blocks.ts';
import data from '../public/data/mission-market-bikeway.json' with {type:'json'};
const u=x=>(x+56)*132,v=z=>(2-z)*132;
test('call uses the local market clock and rejoins the same stopped queue with continuous position and heading',()=>{
  for(const t of [0,91,109,476]){
    for(const h of [0,7.99,14.5,22])assert.equal(loadingCallAllowed(t,h*3600),false);
    assert.ok(loadingCallAllowed(t,12*3600));
  }
  for(const dt of [0,10,44]){
    assert.ok(loadingCallAllowed(84+dt,13*3600+59*60+13+dt));
    assert.equal(loadingCallAllowed(84+dt,13*3600+59*60+22+dt),false);
  }
  assert.ok(loadingCallAllowed(100,8*3600,true));
  for(const seam of [84,91,113,128,384,468,512]){
    const a=loadingVehicle(seam-.001),b=loadingVehicle(seam+.001);
    assert.ok(Math.hypot(b.x-a.x,b.z-a.z)<.0016);
    assert.ok(Math.abs(b.heading-a.heading)<.001);
  }
  for(const t of [83,84,128,130,257,384])assert.deepEqual(loadingVehicle(t),waterfrontCar(t,loadingCarIndex));
  for(const t of [91,96,109,113])assert.equal(u(loadingVehicle(t).x),6170);
  for(const t of [384,768])assert.equal(loadingPassenger(t-.001).aboard,loadingPassenger(t+.001).aboard);
});
test('one production fleet instance opens its right rear door while stopped, then resets after seeking or closing',()=>{
  const paint=new T.MeshStandardMaterial(),fleet=createWaterfrontTraffic(paint);
  assert.equal(fleet.traffic.length,12);
  const body=fleet.traffic[1],mesh=new T.Mesh(body.geometry,paint),m=new T.Matrix4();
  const delta=body.geometry.morphAttributes.position[0],base=body.geometry.attributes.position;
  let moved=0,maxExtension=0;
  for(let i=0;i<delta.count;i++)if(delta.getZ(i)!==0){
    moved++;assert.ok(base.getX(i)<0&&base.getZ(i)>0);
    maxExtension=Math.max(maxExtension,delta.getZ(i));
  }
  assert.ok(moved>50&&maxExtension*.25/.06>.7);
  for(const [t,allowed,expected] of [[109,true,1],[93,true,0],[477,true,1],[109,false,0],[109,true,1],[113,true,0]]){
    fleet.update(t,allowed);
    for(let i=0;i<body.count;i++){
      body.getMorphAt(i,mesh);
      assert.equal(mesh.morphTargetInfluences[0],i===1?expected:0);
    }
    body.getMatrixAt(1,m);
    const p=allowed?loadingVehicle(t):waterfrontCar(t,13);
    assert.ok(Math.hypot(m.elements[12]-p.x,m.elements[14]-p.z)<.00001);
  }
  for(let t=84;t<128;t+=.1)if(loadingDoor(t)>0){
    assert.equal(loadingVehicle(t-.01).x,loadingVehicle(t+.01).x);
  }
});
function gap(a,b,nose,width){
  const dx=Math.cos(a.heading),dz=-Math.sin(a.heading),bx=Math.cos(b.heading),bz=-Math.sin(b.heading);
  return Math.max(...[[dx,dz],[-dz,dx],[bx,bz],[-bz,bx]].map(([ex,ez])=>
    Math.abs((b.x-a.x)*ex+(b.z-a.z)*ez)-streetVehicleNose(13)*Math.abs(dx*ex+dz*ez)-.058*Math.abs(dx*ez-dz*ex)
    -nose*Math.abs(bx*ex+bz*ez)-width*Math.abs(bx*ez-bz*ex)))/.06;
}
test('the moving vehicle leaves the stripe and posts free, clears through cars and the passenger ride, and stays on the asphalt',()=>{
  const edge=[[5876.7,553.3],[5950,561.4],[5987,564.4],[5991,543.5],[6002,542.8],[6100,550.5],
    [6200,557.4],[6278.7,563.6],[6280.4,582.5],[6283.1,584.7],[6374,591.4],[6379.3,589.3],[6382.4,553.8]];
  const source=[];
  addSurveyBlocks(g=>{g.computeBoundingBox();const m=new T.Mesh(g);source.push(m);return m;});
  const ray=new T.Raycaster(undefined,new T.Vector3(0,-1,0)),car=streetVehicleNose(13);
  for(let it=8400;it<12800;it+=2){
    const t=it/100,p=loadingVehicle(t),dx=Math.cos(p.heading),dz=-Math.sin(p.heading);
    for(const [px,py] of data.posts){
      const a=(px-u(p.x))/132,b=(v(p.z)-py)/132;
      assert.ok(Math.hypot(Math.max(0,Math.abs(a*dx+b*dz)-car),Math.max(0,Math.abs(a*dz-b*dx)-.058))/.06-.124>.22);
    }
    for(const f of [-1,-.5,0,.5,1])for(const w of [-.058,.058]){
      const x=p.x+f*car*dx-w*dz,z=p.z+f*car*dz+w*dx;
      const U=u(x),V=v(z),j=edge.findIndex(([a])=>a>U);
      if(j>0){
        const [a,b]=edge.slice(j-1,j+1);
        assert.ok((V-a[1]-(b[1]-a[1])*(U-a[0])/(b[0]-a[0])-.65)/7.92>.15);
      }
      if(it%60===0){
        ray.ray.origin.set(x,.15,z);
        const under=source.filter(m=>{const b=m.geometry.boundingBox;return x>=b.min.x&&x<=b.max.x&&z>=b.min.z&&z<=b.max.z;});
        const surface=ray.intersectObjects(under,false)[0];
        assert.ok(Math.abs(surface.point.y-p.y-streetVehicleTreadHeight)<.0004,[t,U,V,surface.point.y,surface.object.name].join(' '));
      }
    }
    for(let k=0;k<56;k++)if(k!==13){
      const q=waterfrontCar(t,k);if(q.active&&Math.abs(q.x-p.x)<2)assert.ok(gap(p,q,streetVehicleNose(k),.065)>6.4);
    }
    for(const phase of [t,t+384]){
      const q=driverPose('bridge',phase),x=q.look.x-q.eye.x,z=q.look.z-q.eye.z,l=Math.hypot(x,z);
      assert.ok(gap(p,{x:q.eye.x-.0228*z/l,z:q.eye.z+.0228*x/l,heading:-Math.atan2(z,x)},.15,.064)>1);
    }
  }
});
test('walking uses the pedestrian ladder and striped aisle; the body passes under the open door before it hides',()=>{
  const surfaces=[],ray=new T.Raycaster(undefined,new T.Vector3(0,-1,0));
  addSurveyBlocks(g=>{g.computeBoundingBox();const m=new T.Mesh(g);surfaces.push(m);return m;});
  let ladder=0,aisle=0,crouched=0;
  for(let t=92;t<=110;t+=.025){
    const p=loadingPassenger(t),U=u(p.x),V=v(p.z),returning=loadingPassenger(384+202-t);
    assert.ok(Math.hypot(returning.x-p.x,returning.z-p.z)<1e-8);
    ray.ray.origin.set(p.x,.17,p.z);
    const local=surfaces.filter(m=>{const b=m.geometry.boundingBox;return b.min.x<=p.x&&b.max.x>=p.x&&b.min.z<=p.z&&b.max.z>=p.z;});
    const floor=ray.intersectObjects(local,false)[0];
    assert.ok(Math.abs(p.y-floor.point.y)<.00045,'foot grade '+[U,V,p.y,floor.point.y]);
    if(V>520&&V<545){assert.ok(U>6251.1&&U<6275.7);ladder++;}
    if(U>6175&&U<6240){assert.ok(V<553&&V>545);aisle++;}
    for(const [x,y] of data.posts)assert.ok(Math.hypot(U-x,V-y)/7.92-.124>.77);
    if(p.crouch>.001){assert.equal(loadingDoor(t),1);assert.equal(p.y,.031);crouched++;}
  }
  assert.ok(ladder>90&&aisle>80&&crouched>10);
  assert.ok(loadingPassenger(110).aboard&&!loadingPassenger(109.9).aboard);
});

test('the opened door sweeps into the striped aisle, clears posts and lets the passenger round its free edge',()=>{
  const fleet=createWaterfrontTraffic(new T.MeshStandardMaterial()),body=fleet.traffic[1],g=body.geometry,m=new T.Matrix4(),verts=g.attributes.position,delta=g.morphAttributes.position[0];
  let doorClear=Infinity,doorPost=Infinity,doorBike=Infinity;
  const tri=new T.Triangle(),pts=[tri.a,tri.b,tri.c],change=new T.Vector3(),target=new T.Vector3(),near=new T.Vector3();
  for(const begin of [91,475])for(let t=begin;t<=begin+21;t+=.05){
   const open=loadingDoor(t),p=loadingPassenger(t);if(open===0)continue;
   fleet.update(t,true);body.getMatrixAt(1,m);
   for(let j=0;j<verts.count;j+=3){
    if(change.fromBufferAttribute(delta,j).lengthSq()<.000001)continue;
    pts.forEach((v,k)=>v.fromBufferAttribute(verts,j+k).addScaledVector(change.fromBufferAttribute(delta,j+k),open).applyMatrix4(m));
    for(const v of pts){
     const u=(v.x+56)*132,V=(2-v.z)*132;
     doorBike=Math.min(doorBike,(V-(533+(u-6100)*.07))/7.92);
     for(const [x,y] of data.posts)doorPost=Math.min(doorPost,Math.hypot(u-x,V-y)/7.92-.124);
    }
    if(p.aboard)continue;
    target.set(p.x,p.y+.057-p.crouch,p.z);tri.closestPointToPoint(target,near);
    doorClear=Math.min(doorClear,target.distanceTo(near)/.06);
   }
  }
  assert.ok(doorBike>1.85&&doorPost>.77&&doorClear>.61);
});

test('native fleet morph texture uses the hardware instance ID after the indirect renderer patches Three',async()=>{
  await import('@three.ez/instanced-mesh');
  const chunk=T.ShaderChunk.morphinstance_vertex;
  assert.match(chunk,/ivec2\( 0, instanceIndex \)/);
  const shader={vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,uniforms:{}};
  streetVehicleMaterial().onBeforeCompile(shader,{});
  const marker='#include <morphinstance_vertex>',source=shader.vertexShader.replace(marker,chunk);
  const scoped=source.slice(source.indexOf('// InstancedMesh2 globally'),source.indexOf('#include <morphcolor_vertex>'));
  assert.match(scoped,/#if defined\(USE_INSTANCING_MORPH\) && !defined\(USE_INSTANCING_INDIRECT\)\s+#define instanceIndex gl_InstanceID\s+#endif/);
  assert.ok(scoped.indexOf('#define instanceIndex')<scoped.indexOf('texelFetch'));
  assert.ok(scoped.indexOf('#undef instanceIndex')>scoped.lastIndexOf('texelFetch'));
  assert.equal(T.ShaderChunk.morphinstance_vertex,chunk);
});
