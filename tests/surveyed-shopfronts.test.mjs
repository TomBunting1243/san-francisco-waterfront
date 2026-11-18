import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import map from '../public/data/sf-waterfront.json' with {type:'json'};
import fronts from '../public/data/surveyed-shopfronts.json' with {type:'json'};
import {surveyedShopfrontFactory} from '../app/surveyed-shopfronts.ts';
import {downtownBuilding} from '../app/downtown-buildings.ts';

function build(r,changed){
  const root=new T.Group(),mat=new T.MeshStandardMaterial({vertexColors:true});
  const factory=(g,color,x,y,z)=>{const m=new T.Mesh(g,mat);m.position.set(x,y,z);root.add(m);return m;};
  const b=map.buildings.find(b=>b.id===r.id);
  downtownBuilding(changed?surveyedShopfrontFactory(b,factory):factory,b,b.h,false);
  const [a,bp]=r.edge,dx=bp[0]-a[0],dz=bp[1]-a[1],len=Math.hypot(dx,dz);
  const tangent=new T.Vector3(dx/len,0,dz/len);
  const origin=new T.Vector3(a[0]+dx*r.center,0,a[1]+dz*r.center);
  const n=new T.Vector3(tangent.z,0,-tangent.x);
  const center=b.p.reduce((sum,p)=>sum.add(new T.Vector3(p[0],0,p[1])),new T.Vector3()).divideScalar(b.p.length);
  if(n.dot(origin.clone().sub(center))<0)n.negate();
  const ray=(x,y,extra=0)=>{
    const start=origin.clone().addScaledVector(tangent,x).addScaledVector(n,.2+extra);start.y=y;
    return new T.Raycaster(start,n.clone().negate(),0,.6).intersectObject(root)[0];
  };
  root.updateMatrixWorld(true);return {root,ray};
}
for(const record of fronts)test(record.address+' retains its mapped shell with a physically recessed shop door',()=>{
  const before=build(record,false),after=build(record,true);
  const detail=after.root.getObjectByName('Surveyed storefront '+record.address);
  assert.ok(detail);
  const door=after.ray(record.door,.14),window=after.ray(-record.width*.25,.14);
  assert.equal(door.object,detail);assert.equal(window.object,detail);
  assert.ok(door.distance-window.distance>.030);
  const original=before.ray(record.door,.14);assert.ok(door.distance-original.distance>.044);
  // Full height and both abutting ground-floor spans keep exactly the prior wall.
  for(const [x,h] of [[0,record.head+.035],[-record.width/2-.035,.13],[record.width/2+.012,.13]]){
    const a=before.ray(x,h),b=after.ray(x,h);assert.ok(a&&b);
    assert.ok(Math.abs(a.distance-b.distance)<.00001);assert.notEqual(b.object,detail);
    assert.ok(b.face.normal.dot(a.face.normal)>.9999);
    const interp=hit=>{
      const g=hit.object.geometry,positions=g.attributes.position,data=g.attributes.facadeGrid;
      const ids=[hit.face.a,hit.face.b,hit.face.c];
      const pts=ids.map(i=>new T.Vector3().fromBufferAttribute(positions,i));
      const w=T.Triangle.getBarycoord(hit.point,...pts,new T.Vector3()).toArray();
      return [0,1,2,3].map(k=>ids.reduce((sum,i,j)=>sum+w[j]*data.getComponent(i,k),0));
    };
    const g1=interp(a),g2=interp(b);assert.ok(g1.every((v,i)=>Math.abs(v-g2[i])<.0001));
  }
  assert.ok(door.face.normal.dot(window.face.normal)>.9999);
  assert.ok(detail.geometry.index.count/3<100);
});
test('upper-floor, shared office and already modeled restaurant addresses do not acquire retail',()=>{
  const pass=()=>{throw new Error('unexpected render');};
  for(const id of [260288450,260288452,32862406,192307107,288645263,939499092])assert.equal(surveyedShopfrontFactory({id},pass),pass);
});
