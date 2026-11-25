import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {addSurveyBlocks} from '../app/survey-blocks.ts';
import {howardBealePlate} from '../app/howard-beale-through.ts';
import {driverPose} from '../app/driver-rides.ts';

const meshes=[];
addSurveyBlocks((g,color)=>{const m=new T.Mesh(g,new T.MeshBasicMaterial({color}));g.computeBoundingBox();meshes.push(m);return m;});
const ray=new T.Raycaster(new T.Vector3(),new T.Vector3(0,-1,0),0,.075);
function surfaces(x,z){
  ray.ray.origin.set(x,.08,z);
  return ray.intersectObjects(meshes.filter(({geometry:{boundingBox:b}})=>x>=b.min.x&&x<=b.max.x&&z>=b.min.z&&z<=b.max.z),false);
}
test('north Howard sidewalk meets the existing raised curb and replaces the low road surface behind it',()=>{
  for(const u of [1009,1100,1230,1420,1555]){
    for(const v of [145,152,163]){
      const hits=surfaces(...howardBealePlate(u,v));
      assert.ok(hits.some(h=>Math.abs(h.point.y-.0451)<.00002),'missing pedestrian surface '+[u,v]);
      assert.ok(hits.every(h=>Math.abs(h.point.y-.031)>.00002),'duplicate asphalt beneath footway '+[u,v]);
    }
    const curb=surfaces(...howardBealePlate(u,166))[0];
    assert.ok(curb&&Math.abs(curb.point.y-.0451)<.002);
  }
});
test('all three printed pigments have upwards faces and registered pavement beneath each triangle',()=>{
  const paint=meshes.filter(m=>m.name.startsWith('Howard, Beale to Main'));
  assert.equal(paint.length,3);
  let n=0;
  for(const {geometry:g,userData} of paint){
    assert.equal(g.userData.roadPaint,'SoMa approaches');assert.equal(userData.roadExposure,1);
    const points=g.getAttribute('position');
    for(let i=0;i<g.index.count;i+=3){
      const [a,b,c]=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(points,g.index.getX(i+j)));
      assert.ok((b.z-a.z)*(c.x-a.x)-(b.x-a.x)*(c.z-a.z)>0);
      const x=(a.x+b.x+c.x)/3,z=(a.z+b.z+c.z)/3;
      const hits=surfaces(x,z);
      const support=hits.find(h=>!h.object.geometry.userData.roadPaint);
      assert.ok(support&&Math.abs(support.point.y-.031)<.00005,'unsupported '+[x,z,support?.point.y]);
      assert.equal(hits.filter(h=>h.object.geometry.userData.roadPaint).length,1,'overlapping ink at '+[x,z]);n++;
    }
  }
  assert.ok(n>250&&n<350);
});
test('all four through-ride treads clear the opposing and left-turn pockets and remain on supported asphalt',()=>{
  let west=0,east=0;
  for(let frame=270*24;frame<=282*24;frame++){
    const {eye,look}=driverPose('bridge',frame/24);
    const d=new T.Vector2(look.x-eye.x,look.z-eye.z).normalize();
    for(const along of [-.09,.09])for(const side of [-.054,.054]){
      const x=eye.x+along*d.x-(.0228+side)*d.y,z=eye.z+along*d.y+(.0228+side)*d.x;
      const a=x+28.766041,b=z+30.979132;
      const u=245+(.001297019*a+.008473203*b)/(.06/7)**2;
      const v=245+(-.008473203*a+.001297019*b)/(.06/7)**2;
      if(u<1045||u>1530)continue;
      if(u<=1295){assert.ok(v>257&&v<286,'opposing pocket '+[u,v]);west++;}
      if(u>=1420){assert.ok(v>259&&v<286,'left-turn pocket '+[u,v]);east++;}
      const support=surfaces(x,z).find(h=>!h.object.geometry.userData.roadPaint);
      assert.ok(support&&Math.abs(support.point.y-.031)<.00005,'tread at '+[u,v,support?.point.y]);
    }
  }
  assert.ok(west>200&&east>90);
});
