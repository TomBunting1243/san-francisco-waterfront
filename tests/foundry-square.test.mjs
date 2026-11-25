import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {addFoundrySquare} from '../app/foundry-square.ts';
function point(u,v,h){return new T.Vector3(-27.00800104+.0012973094*u-.0084729829*v,.045+h*.06,-33.37263659+.0084728164*u+.001296584*v);}
function model(id){
  const group=new T.Group(),windows=[];assert.equal(addFoundrySquare({id},group,windows),true);
  group.updateMatrixWorld(true);return {group,mesh:group.children[0],windows};
}
const ray=(m,a,b)=>new T.Raycaster(a,b.clone().sub(a).normalize()).intersectObject(m)[0];
test('400 and 405 Howard have measured Fremont street walls, with dark recessed bays and upper setbacks',()=>{
  for(const [id,v,edge,base,upper] of [[136104348,52,32.24,32.6,-33],[136104349,510,28.98,31.6,-35]]){
    const {mesh}=model(id);
    const depths=[];
    for(let i=0;i<70;i++){
      const start=point(80,v+i/2,2),hit=ray(mesh,start,point(-100,v+i/2,2));
      assert.ok(hit&&hit.face.normal.dot(point(80,v,2).sub(point(-100,v,2)).normalize())>.95);
      depths.push(hit.distance);
    }
    const min=Math.min(...depths),max=Math.max(...depths);
    assert.ok(Math.abs(min-(80-edge)*.06/7)<.005);
    assert.ok(max-min>.017&&max-min<.024);
    const upperHit=ray(mesh,point(80,v,base+3),point(-100,v,base+3));
    assert.ok(Math.abs(upperHit.distance-(80-upper)*.06/7)<.004);
  }
});
test('the two roofs rise behind real terrace edges and 405 retains its inside court',()=>{
  for(const [id,cases] of [[136104348,[[0,60,32.6],[-160,-125,48.1],[-160,116-1,46.21]]],
    [136104349,[[0,450,31.6],[-90,415,46.1],[-90,741,41.53],[-200,590,10.5]]]]){
    const {mesh}=model(id);
    for(const [u,v,h] of cases){
      const hit=ray(mesh,point(u,v,65),point(u,v,0));
      assert.ok(hit&&hit.face.normal.y>.965&&Math.abs(hit.point.y-point(u,v,h).y)<.006,[id,u,v,h,hit?.point.y]);
    }
  }
});
test('one opaque mesh per address replaces both the low north parent and its generic upper part',()=>{
  for(const id of [136104348,136104349]){
    const {group,mesh,windows}=model(id),count=windows.length;
    assert.equal(addFoundrySquare({id:1410037751},group,windows),true);
    assert.equal(addFoundrySquare({id:192883909},group,windows),false);
    assert.equal(group.children.length,1);assert.equal(windows.length,count);assert.ok(count>=20&&count<55);
    assert.ok(mesh.geometry.index.count/3<4000);assert.equal(mesh.material.transparent,false);
    for(const p of windows){
      const n=new T.Vector3(Math.sin(p.ry),0,Math.cos(p.ry)),q=new T.Vector3(p.x,p.y,p.z);
      const hit=ray(mesh,q.clone().addScaledVector(n,.001),q.clone().addScaledVector(n,-.01));
      assert.ok(hit&&hit.distance<.003);
    }
  }
});

test('the ten inventoried evergreen figs stand in four-foot sidewalk cutouts with a central gap',async()=>{
  const {addFoundryTrees}=await import('../app/foundry-trees.ts');
  const group=new T.Group();
  const anchors=addFoundryTrees((geometry,color,x,y,z)=>{
    const mesh=new T.Mesh(geometry,new T.MeshStandardMaterial({color}));
    mesh.position.set(x,y,z);group.add(mesh);return mesh;
  });
  assert.deepEqual(anchors.map(t=>t.id),Array.from({length:10},(_,i)=>190300+i));
  const wells=group.children.filter(m=>m.userData.treeSite);
  assert.equal(wells.length,10);
  for(const t of anchors){
    const well=wells.find(w=>w.userData.treeSite===t.id);
    assert.equal(well.name,'Tree cutout');assert.ok(Math.abs(well.scale.x-.3048*4*.06)<.00001);
    assert.ok(well.position.distanceTo(new T.Vector3(t.x,t.y,t.z))<.00001);
    assert.ok(group.children.some(m=>m.userData.plantCrown&&m.position.distanceTo(well.position)<.0001));
  }
  assert.ok(Math.hypot(anchors[4].x-anchors[5].x,anchors[4].z-anchors[5].z)/.06>17.5);
});
