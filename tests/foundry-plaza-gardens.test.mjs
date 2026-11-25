import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {FacadePanels} from '../app/facade-panels.ts';
import {addFoundryPlazaGardens} from '../app/foundry-plaza-gardens.ts';
import {foundryCrowns} from '../app/foundry-plaza-crowns.ts';

const plate=([u,v],h)=>[-27.00800104+.0012973094*u-.0084729829*v,
  .045+h*.06,-33.37263659+.0084728164*u+.001296584*v];
function assemble(south){
  const panels=new FacadePanels();
  addFoundryPlazaGardens(panels,south,plate);
  return panels.mesh(new THREE.MeshStandardMaterial({vertexColors:true}));
}
function below(mesh,u,v,h=24){
  const hit=new THREE.Raycaster(new THREE.Vector3(...plate([u,v],h)),new THREE.Vector3(0,-1,0))
    .intersectObject(mesh)[0];
  return hit?{height:(hit.point.y-.045)/.06,normal:hit.face.normal}:null;
}
test('both plaza walkways support measured stone seats and leave open circulation on the inward sides',()=>{
  for(const [south,seats,open] of [
    [true,[[-550,352,.41],[-504,316,.42]],[[-504,324],[-445,400],[-490,386]]],
    [false,[[-550,90,.40],[-510,129,.46]],[[-507,123],[-445,96],[-480,89]]],
  ]){
    const mesh=assemble(south);
    for(const [u,v,h] of seats){
      const hit=below(mesh,u,v,1);
      assert.ok(hit&&Math.abs(hit.height-h)<.0001&&hit.normal.y>.999);
    }
    for(const [u,v] of open)assert.ok(Math.abs(below(mesh,u,v,1).height-.02)<.0001);
  }
});
test('all sixteen registered trunk centers have a grounded flare, with a clear planting center under each shared crown',()=>{
  for(const [south,xs,ys] of [[true,[-540,-518,-495],[328,349,370]],[false,[-540,-519,-497],[76,99,119]]]){
    const mesh=assemble(south);
    for(const u of xs)for(const v of ys){
      if(u===xs[1]&&v===ys[1])continue;
      const from=new THREE.Vector3(...plate([u+4,v],.15)),dest=new THREE.Vector3(...plate([u,v],.15));
      const hit=new THREE.Raycaster(from,dest.clone().sub(from).normalize(),0,from.distanceTo(dest))
        .intersectObject(mesh)[0];assert.ok(hit,[u,v]);
      assert.ok(Math.abs(below(mesh,u+2,v,.2).height-.008)<.0001);
    }
    assert.ok(Math.abs(below(mesh,xs[1],ys[1],1).height-.02)<.0001);
    assert.ok(below(mesh,xs[1],ys[1]).height>6);
    assert.equal(mesh.geometry.groups.length,0);
    assert.ok(mesh.geometry.index.count/3<5000);
    assert.ok(mesh.geometry.getAttribute('position').count<4900);
  }
});
test('the southern crown retains its irregular rim and the lowered shoulder toward Howard',()=>{
  const mesh=assemble(true);
  assert.ok(below(mesh,-515,338).height+1<below(mesh,-495,369).height);
  assert.ok(below(mesh,-477,368).height>6);
  assert.ok(Math.abs(below(mesh,-461,391).height-.02)<.0001);
  for(const data of Object.values(foundryCrowns)){
    const edgeOwners=new Map();
    for(let i=0;i<data.triangles.length;i+=3){
      const ids=data.triangles.slice(i,i+3);
      for(let j=0;j<3;j++){
        const [a,b]=[ids[j],ids[(j+1)%3]].sort((a,b)=>a-b),key=a+','+b;
        edgeOwners.set(key,(edgeOwners.get(key)??0)+1);
        assert.ok(Math.hypot(data.vertices[4*a]-data.vertices[4*b],data.vertices[4*a+1]-data.vertices[4*b+1])<=18);
      }
    }
    assert.ok([...edgeOwners.values()].every(n=>n===1||n===2));
  }
});

test('leaf tips feather the measured canopy edge using short shaded faces and interpolated pigment',()=>{
  for(const south of [false,true]){
    const f=new FacadePanels();
    addFoundryPlazaGardens(f,south,([u,v],h)=>[u,h,v]);
    let leafFaces=0,gradedFaces=0;
    for(let i=0;i<f.indices.length;i+=3){
      const verts=f.indices.slice(i,i+3).map(k=>k*3);
      // Leaf pigments are greener than red. The bark, stone and paving are not.
      if(!verts.every(k=>f.colors[k+1]>f.colors[k]*1.2))continue;
      const heights=verts.map(k=>f.positions[k+1]);
      assert.ok(Math.min(...heights)>2.85);
      assert.ok(Math.max(...heights)-Math.min(...heights)<1.6);
      if(new Set(verts.map(k=>f.colors[k])).size>1)gradedFaces++;
      leafFaces++;
    }
    assert.ok(leafFaces>2400&&gradedFaces>leafFaces*.85);
  }
});
