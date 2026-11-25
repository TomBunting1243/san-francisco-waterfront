import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {addSurveyBlocks} from '../app/survey-blocks.ts';
import {bakeRigidChunk} from '../app/city-blocks.ts';
import {driverPose} from '../app/driver-rides.ts';
import {waterfrontCar} from '../app/waterfront-routes.ts';
import {streetVehicleNose} from '../app/street-vehicles.ts';
import data from '../public/data/mission-market-bikeway.json' with {type:'json'};

const meshes=[];
addSurveyBlocks(g=>{g.computeBoundingBox();const m=new T.Mesh(g);meshes.push(m);return m;});
const local=meshes.filter(m=>m.geometry.boundingBox.intersectsBox(new T.Box3(new T.Vector3(-14,.029,-3.11),new T.Vector3(-.9,.14,-1.63))));
const paint=local.find(m=>m.name==='Mission to Market bikeway and floating loading paint');
const posts=local.find(m=>m.name==='Mission to Market flexible bikeway posts');
const ray=new T.Raycaster(undefined,new T.Vector3(0,-1,0),0,.19);
function hits(u,v,meshes=local){
  ray.ray.origin.set(-56+u/132,.18,2-v/132);
  return ray.intersectObjects(meshes,false).filter(q=>q.face.normal.y>.3);
}
test('every clipped triangle faces up on the asphalt and preserves existing painted crossings',()=>{
  assert.ok(paint&&posts);
  const old=local.filter(m=>m!==paint&&m!==posts);
  for(const f of Object.values(data.faces)){
    for(let i=0;i<f.length;i+=3){
      const [a,b,c]=f.slice(i,i+3).map(k=>data.vertices[k]);
      const u=(a[0]+b[0]+c[0])/3,v=(a[1]+b[1]+c[1])/3;
      assert.ok((b[0]-a[0])*(c[1]-a[1])>(b[1]-a[1])*(c[0]-a[0]));
      const surface=hits(u,v,old)[0];
      assert.ok(surface&&Math.abs(surface.point.y-.031)<1e-5,'support '+[u,v,surface?.point.y]);
    }
  }
  for(const [u,v] of [[6402,547],[6428,557],[6455,566.5]])assert.equal(hits(u,v,[paint]).length,1);
  for(const [u,v] of [[6415,552],[6444,560],[6540,581],[7240,602]])assert.equal(hits(u,v,[paint]).length,0);
});
test('two-way cycle track, crossing gaps and open loading leave the six-sided posts in the striped aisle',()=>{
  assert.equal(data.posts.length,26);
  const ground=local.filter(m=>m!==posts&&m!==paint);
  for(const [u,v] of data.posts){
    assert.ok(Math.abs(hits(u+.08,v+.12,ground)[0].point.y-.031)<1e-5);
    assert.ok(Math.abs(hits(u+.08,v+.12,[posts])[0].point.y-.08308)<1e-5);
    assert.ok(hits(u,v-13,[posts]).length===0);
    assert.ok(u<6382.5||u>6561,'post blocks driveway');
    for(const [lo,hi,top,bottom] of [[6251.1,6275.7,520,546],[6796.2,6819.4,558,584],[7011.5,7049.8,561,586]]){
      assert.ok(u<lo||u>hi||v<top||v>bottom,'post blocks a pedestrian ladder');
    }
  }
  for(const [u,low,high] of [[6120,514,531],[6720,557,574],[6940,565,583]]){
    for(let v=low;v<=high;v+=1.37){
      assert.equal(hits(u,v,[posts]).length,0);
      assert.ok(Math.abs(hits(u,v,ground)[0].point.y-.031)<1e-5);
    }
  }
  const mat=new T.MeshStandardMaterial({vertexColors:true});
  for(const m of [paint,posts]){
    const g=bakeRigidChunk('test',[m],mat).geometry;
    assert.ok(g.attributes.roadExposure.array.includes(1));
    assert.ok(!g.hasAttribute('signLight'));g.dispose();
  }
  mat.dispose();
});

// Roadward envelope of actual white polygons in the exporter plate. Bin the
// edges by station so the full-motion test need not raycast the entire city.
const spans=new Map();
for(let i=0;i<data.faces.white.length;i+=3){
  const t=data.faces.white.slice(i,i+3).map(k=>data.vertices[k]);
  for(let j=0;j<3;j++){
    const a=t[j],b=t[(j+1)%3];
    for(let n=Math.floor(Math.min(a[0],b[0])/16);n<=Math.floor(Math.max(a[0],b[0])/16);n++){
      if(!spans.has(n))spans.set(n,[]);spans.get(n).push([a,b]);
    }
  }
}
function clearance(cx,cz,dx,dz,nose,w,minEdge,minPost){
  const u=(cx+56)*132,v=(2-cz)*132;
  if(u<5830||u>7265)return false;
  for(const [px,py] of data.posts){
    if(Math.abs(px-u)>40)continue;
    const a=(px-u)/132,b=(v-py)/132;
    assert.ok(Math.hypot(Math.max(0,Math.abs(a*dx+b*dz)-nose),Math.max(0,Math.abs(b*dx-a*dz)-w))/.06-.124>minPost);
  }
  // Include midpoints along both sides to catch the taper tips between axles.
  for(const f of [-1,-.5,0,.5,1])for(const s of [-w,w]){
    const U=u+(f*nose*dx-s*dz)*132,V=v-(f*nose*dz+s*dx)*132;
    if(U<5879||U>7227)continue;
    for(const [a,b] of spans.get(Math.floor(U/16))??[]){
      if((a[0]<U)===(b[0]<U))continue;
      const edge=a[1]+(b[1]-a[1])*(U-a[0])/(b[0]-a[0]);
      assert.ok((V-edge)/7.92>minEdge,'side clearance at '+[U,V,edge]);
    }
  }
  return true;
}
test('full passenger and traffic envelopes clear both receiving tapers and all physical delineators',()=>{
  let passenger=0,traffic=0;
  for(let i=38800;i<=41000;i+=4){
    const p=driverPose('bridge',i/100),x=p.look.x-p.eye.x,z=p.look.z-p.eye.z,l=Math.hypot(x,z),dx=x/l,dz=z/l;
    if(clearance(p.eye.x-.0228*dz,p.eye.z+.0228*dx,dx,dz,.15,.064,.19,.40))passenger++;
  }
  for(let t=0;t<640;t+=.43)for(let i=1;i<56;i+=2){
    const p=waterfrontCar(t,i);
    if(p.active&&clearance(p.x,p.z,Math.cos(p.heading),-Math.sin(p.heading),streetVehicleNose(i),.065,2.3,3.1))traffic++;
  }
  assert.ok(passenger>300&&traffic>1000);
});

test('the sedan and ambient bodies stay separated while the passenger passes the two floating bays',()=>{
  // Separating axes of the two oriented body rectangles; use vehicle noses
  // from the shipped profiles and a conservative allowance for mirrors.
  let nearest=Infinity,passes=0;
  for(let i=38800;i<=41000;i+=4){
    const t=i/100,p=driverPose('bridge',t),lx=p.look.x-p.eye.x,lz=p.look.z-p.eye.z,l=Math.hypot(lx,lz);
    const ax=lx/l,az=lz/l,cx=p.eye.x-.0228*az,cz=p.eye.z+.0228*ax;
    for(let k=0;k<56;k++){
      const car=waterfrontCar(t,k);
      if(!car.active||Math.abs(car.x-cx)>.6)continue;
      const bx=Math.cos(car.heading),bz=-Math.sin(car.heading),x=car.x-cx,z=car.z-cz;
      const gap=Math.max(...[[ax,az],[-az,ax],[bx,bz],[-bz,bx]].map(([dx,dz])=>
        Math.abs(x*dx+z*dz)-.15*Math.abs(ax*dx+az*dz)-.064*Math.abs(ax*dz-az*dx)
        -streetVehicleNose(k)*Math.abs(bx*dx+bz*dz)-.065*Math.abs(bx*dz-bz*dx)));
      nearest=Math.min(nearest,gap);passes++;
    }
  }
  assert.ok(passes>200&&nearest>.002,'closest body-axis gap '+nearest/.06+' m');
});
