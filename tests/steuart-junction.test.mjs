import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import junction from '../public/data/steuart-junction.json' with {type:'json'};
import {makeSteuartJunction,addMarketRunningRails,donCheeBedHeight} from '../app/steuart-junction.ts';
import {driverPose,museumLegDuration,rideDuration} from '../app/driver-rides.ts';
import {streetcarTrack,trackCenterlines} from '../app/streets.ts';
import market from '../public/data/market-street.json' with {type:'json'};
import {buildStreetcarTrack} from '../app/streets.ts';
import {createStreetcar,bakePccBody,bakeStreetcarTrucks,setStreetcarTrucks,pccDimensions} from '../app/streetcar.ts';
const down=new T.Vector3(0,-1,0),cast=new T.Raycaster();
function hits(objects,x,y,z,far){
  cast.set(new T.Vector3(x,y,z),down);cast.far=far;
  return cast.intersectObjects(objects,false);
}
test('four electrified curves join the actual waterfront tracks; both museum boarding ramps reach their high landings',()=>{
  const mesh=makeSteuartJunction();assert.ok(mesh.geometry.index.count/3<2200);
  const candidates=[mesh],height=(x,z)=>hits(candidates,x,.29,z,.4)[0]?.point.y;
  for(const curve of junction.curves){
    const end=curve.points.at(-1);
    assert.ok(trackCenterlines.some(line=>line.some(p=>p[0]===end[0]&&p[1]===end[1])));
    for(let i=1;i<curve.points.length;i++){
      const [a,b]=curve.points[i-1],[c,d]=curve.points[i],x=(a+c)/2,z=(b+d)/2;
      const wire=hits(candidates,x,.5,z,.17)[0];
      assert.ok(wire,'contact wire between successive survey pins '+curve.way);
      const n=Math.hypot(c-a,d-b);
      for(const side of [-1,1]){
        const half=streetcarTrack.gauge/2+streetcarTrack.railHead*.4;
        const hit=height(x+(d-b)*side*half/n,z-(c-a)*side*half/n);
        assert.ok(hit>.032&&hit<.063,'running rail on both sides of center');
      }
    }
  }
  for(const [x,z] of [[-8.005,-6.019],[-7.700,-7.11],[-7.87,-5.26],[-7.75,-4.80]]){
    const support=hits(candidates,x,.075,z,.08).some(h=>Math.abs(h.point.y-donCheeBedHeight(z))<.0012);
    assert.ok(support,'concrete reservation supports the stop and the approach to the roadway');
  }
  for(const ring of junction.landings){
    const [a,,b,,d]=ring,dx=d[0]-a[0],dz=d[1]-a[1],length=Math.hypot(dx,dz);
    const x=(a[0]+b[0])/2,z=(a[1]+b[1])/2;
    for(const t of [-.62,-.31,-.02,.064]){
      const top=height(x+dx/length*t,z+dz/length*t),grade=donCheeBedHeight(z);
      const expected=grade+.06*.0254*34*Math.min(1,1+t/.631);
      assert.ok(Math.abs(top-expected)<.0002,'rising ramp and level landing under both doors');
    }
  }
});
test('the museum ride crosses the physical wye on eight tread contacts and clears both high platforms',()=>{
  const {group:tram}=createStreetcar(),trucks=bakeStreetcarTrucks(tram);tram.add(trucks);
  const scene=new T.Group(),temporary=new T.Group(),paint=new T.MeshStandardMaterial();
  function mesh(g,color,x,y,z,parent=temporary){
    const obj=new T.Mesh(g,paint);obj.position.set(x,y,z);obj.userData.ink=color;parent.add(obj);return obj;
  }
  scene.add(makeSteuartJunction());
  addMarketRunningRails(market.tracks,(a,b,y,w,h,col)=>{
    const m=mesh(new T.BoxGeometry(),col,(a[0]+b[0])/2,y,(a[1]+b[1])/2,scene);
    m.scale.set(w,h,Math.hypot(b[0]-a[0],b[1]-a[1]));m.rotation.y=Math.atan2(b[0]-a[0],b[1]-a[1]);return m;
  });
  buildStreetcarTrack((w,h,d,x,y,z,color)=>mesh(new T.BoxGeometry(w,h,d),color,x,y,z),
    ()=>new T.Mesh());
  scene.updateMatrixWorld(true);temporary.updateMatrixWorld(true);
  const patch=scene.getObjectByName('Don Chee track junction and accessible platforms');
  const corridor=new T.Box3();
  for(let t=0;t<=Math.ceil(museumLegDuration);t++){
    const p=driverPose('streetcar',Math.min(t,museumLegDuration)).body;
    corridor.expandByPoint(new T.Vector3(p.x,p.y,p.z));
  }
  corridor.expandByScalar(pccDimensions.length/2);
  const segment=new T.Box3();
  const architectureChunks=[patch,...[...scene.children,...temporary.children].filter(m=>
    ['Running rail','Market running rail'].includes(m.name)&&corridor.intersectsBox(segment.setFromObject(m)))];
  assert.ok(trucks.isInstancedMesh&&trucks.count===2);
  const local=new T.Matrix4(),world=new T.Matrix4();
  const scale=pccDimensions.length/3.629,width=pccDimensions.width/.8835;
  const halfTread=.035*width,trackOffset=(streetcarTrack.gauge+streetcarTrack.railHead)/2;
  let checks=0;
  for(let t=0;t<=museumLegDuration;t+=.20){
    const {body,eye}=driverPose('streetcar',t);
    tram.position.set(body.x,body.y,body.z);tram.rotation.y=body.heading;tram.rotation.z=body.pitch;
    setStreetcarTrucks(tram,body);tram.updateMatrixWorld(true);
    for(let i=0;i<2;i++){
      trucks.getMatrixAt(i,local);world.multiplyMatrices(trucks.matrixWorld,local);
      for(const axle of [-.22,.22])for(const side of [-1,1]){
        const at=d=>new T.Vector3(axle*scale,0,side*trackOffset+d).applyMatrix4(world);
        const contact=[-1,-.5,0,.5,1].some(f=>{
          const p=at(f*halfTread);
          return hits(architectureChunks,p.x,p.y+.004,p.z,.008).some(h=>{
            const color=h.object.userData.ink?new T.Color(h.object.userData.ink):new T.Color().fromBufferAttribute(h.object.geometry.attributes.color,h.face.a);
            return ['#a3a79e','#909991','#a9aaa0'].some(hex=>
              Math.abs(color.r-new T.Color(hex).r)<.0021&&Math.abs(color.g-new T.Color(hex).g)<.0021);
          });
        });
        assert.ok(contact,'wheel misses rail at '+[t.toFixed(2),i,axle,side,at(0).toArray()]);checks++;
      }
    }
    if(t<13){
      // Side-view rays from the body-width envelope would encounter the ramp handrails if the car clipped them.
      const c=Math.cos(body.heading),s=Math.sin(body.heading);
      for(const side of [-1,1])for(const along of [-.34,0,.34]){
        const x=body.x+along*c+side*.0762*s,z=body.z-along*s+side*.0762*c;
        const obs=hits(architectureChunks,x,eye.y,z,.056)[0];
        assert.ok(!obs,'PCC body clearance at '+[t,side,along,x,z,obs?.point.y,obs&&new T.Color().fromBufferAttribute(obs.object.geometry.attributes.color,obs.face.a).getHexString()]);
      }
    }
  }
  assert.ok(checks>1200);
  setStreetcarTrucks(tram);assert.equal(trucks.userData.atRest,true);
});


test('both PCC trucks swivel below the fixed underframe for the entire ride with their center bearings engaged',()=>{
  const {group,glazing,lamp}=createStreetcar();
  const running=new T.Box3(),bearing=new T.Box3(),point=new T.Vector3();
  for(const part of group.children.filter(p=>p.userData.truck>0)){
    part.updateMatrix();
    const physical=new T.Matrix4().makeScale(group.scale.x,group.scale.y,group.scale.z)
      .multiply(new T.Matrix4().makeTranslation(-part.userData.truck,0,0)).multiply(part.matrix);
    const bounds=part.name==='Truck center bearing'?bearing:running;
    const pos=part.geometry.attributes.position;
    for(let i=0;i<pos.count;i++)bounds.expandByPoint(point.fromBufferAttribute(pos,i).applyMatrix4(physical));
  }
  assert.ok(!running.isEmpty()&&!bearing.isEmpty());
  bakePccBody(group,glazing,lamp);
  const trucks=group.getObjectByName('PCC swivel trucks'),body=group.getObjectByName('PCC formed and painted body').geometry;
  const {position,color}=body.attributes,index=body.index.array,fixed=[];
  const ink=new T.Color('#3c433e');
  for(let i=0;i<index.length;i+=3){
    const v=index[i];
    if(![ink.r,ink.g,ink.b].every((c,k)=>Math.abs(c-color.getComponent(v,k))<=.5/255))continue;
    fixed.push(new T.Triangle(...[v,index[i+1],index[i+2]].map(j=>new T.Vector3().fromBufferAttribute(position,j))));
  }
  assert.ok(fixed.length>=12);
  const local=new T.Matrix4(),swept=new T.Box3(),pivot=new T.Box3(),up=new T.Vector3(0,1,0),ray=new T.Ray();
  function clearance(){
    for(let i=0;i<2;i++){
      trucks.getMatrixAt(i,local);
      swept.copy(running).applyMatrix4(local).expandByScalar(.004);
      assert.ok(fixed.every(face=>!swept.intersectsTriangle(face)),'wheel or truck frame reaches fixed body steel');
      pivot.copy(bearing).applyMatrix4(local);pivot.getCenter(ray.origin);ray.origin.y=0;ray.direction.copy(up);
      const heights=[];
      for(const face of fixed){
        const hit=ray.intersectTriangle(face.a,face.b,face.c,false,point);
        if(hit)heights.push(hit.y);
      }
      assert.ok(heights.length>=2&&Math.min(...heights)<pivot.max.y&&Math.max(...heights)>pivot.max.y,
        'center bearing ends inside its fixed bolster');
    }
  }
  clearance();
  const end=rideDuration('streetcar');
  for(let i=0;i<=Math.ceil(end*10);i++){
    setStreetcarTrucks(group,driverPose('streetcar',Math.min(i/10,end)).body);clearance();
  }
  setStreetcarTrucks(group);clearance();
});
