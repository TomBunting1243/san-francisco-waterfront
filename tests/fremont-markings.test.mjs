import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {addSurveyBlocks} from '../app/survey-blocks.ts';
import {addFremontMarkings} from '../app/fremont-markings.ts';
import survey from '../public/data/fremont-markings.json' with {type:'json'};

const markings=[];
addFremontMarkings((g,color)=>{
  const patch=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color}));markings.push(patch);return patch;
});
const down=new THREE.Vector3(0,-1,0);
const ray=new THREE.Raycaster(undefined,down,0,.08);
function colorsAt(u,v){
  ray.ray.origin.set(-27.00800104+.0012973094*u-.0084729829*v,.08,-33.37263659+.0084728164*u+.0012965840*v);
  return new Set(ray.intersectObjects(markings,false).map(hit=>hit.object.material.color.getHexString()));
}
test('two Fremont hooks, one green pocket and four broken cells appear at their independently traced positions',()=>{
  for(const [u,v] of [[154.5,377],[154.5,483],[112,332.85],[43,187]])assert.deepEqual([...colorsAt(u,v)],['dedbd0']);
  for(const u of [261,361,387,412,438])assert.deepEqual([...colorsAt(u,196)],['749580']);
  for(const u of [349,374,400,427,450])assert.equal(colorsAt(u,196).size,0);
  for(const v of [247.2,249.2])assert.deepEqual([...colorsAt(341,v)],['ddbd64']);
  for(const pt of [[341,248.2],[333,259],[333,272],[162,380],[154,400],[80,261]])assert.equal(colorsAt(...pt).size,0);
});
test('finished paint uses the existing offset road batch and has pavement directly under every triangle',()=>{
  const road=[];
  addSurveyBlocks((g,color)=>{
    g.computeBoundingBox();
    const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color}));
    if(!g.userData.roadPaint)road.push(m);
    return m;
  });
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  let total=0;
  for(const [i,batch] of survey.batches.entries()){
    const patch=markings[i];
    assert.equal(patch.geometry.userData.roadPaint,'SoMa approaches');
    assert.equal(patch.userData.roadExposure,1);
    for(let k=0;k<batch.indices.length;k+=3){
      const [ia,ib,ic]=batch.indices.slice(k,k+3);
      a.fromArray(batch.vertices[ia]);b.fromArray(batch.vertices[ib]);c.fromArray(batch.vertices[ic]);
      assert.ok((b.z-a.z)*(c.x-a.x)-(b.x-a.x)*(c.z-a.z)>0,'upwards paint normal');
      const x=(a.x+b.x+c.x)/3,y=(a.y+b.y+c.y)/3,z=(a.z+b.z+c.z)/3;
      ray.ray.origin.set(x,.08,z);
      const nearby=road.filter(({geometry:{boundingBox:p}})=>p.min.x<=x&&x<=p.max.x&&p.min.z<=z&&z<=p.max.z);
      const top=ray.intersectObjects(nearby,false)[0];
      assert.ok(top&&Math.abs((y-top.point.y)-.00024)<.000014,'4 mm above street or sloped gutter at '+[x,z,y,top?.point.y]);
      total++;
    }
  }
  assert.ok(total>200&&total<750);
});
