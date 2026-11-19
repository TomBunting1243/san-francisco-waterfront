import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {sfMap} from '../app/sf-map.ts';
import {bakeRigidChunk} from '../app/city-blocks.ts';
import {addFiftyFremont} from '../app/fifty-fremont.ts';

function model(){
  const root=new THREE.Group(),windows=[];
  const b=sfMap.buildings.find(b=>b.id===288716396);
  assert.ok(addFiftyFremont(b,root,windows));
  assert.equal(addFiftyFremont({...b,id:0},root,windows),false);
  root.updateMatrixWorld(true);
  const meshes=[];root.traverse(o=>{if(o.isMesh)meshes.push(o);});
  const block=bakeRigidChunk('50 Fremont test',meshes,new THREE.MeshStandardMaterial({vertexColors:true}));
  return {root,windows,b,block};
}
function probe(block,b,edge,t,y){
  const a=b.p[edge],c=b.p[edge+1];
  const pt=new THREE.Vector3(a[0]+(c[0]-a[0])*t,y,a[1]+(c[1]-a[1])*t);
  const n=new THREE.Vector3(c[1]-a[1],0,a[0]-c[0]).normalize();
  const ray=new THREE.Raycaster(pt.clone().addScaledVector(n,.2),n.clone().negate(),0,.9);
  const hit=ray.intersectObject(block)[0];assert.ok(hit);
  return {r:block.geometry.attributes.color.getX(hit.face.a),z:hit.point.sub(pt).dot(n)};
}
test('two observed office grids narrow above 115 m and retain the dark mechanical screen and recessed glazing after baking',()=>{
  const {block,b}=model(),pitch=(10.395-.04)/43;
  const tone=(edge,x,f)=>probe(block,b,edge,x,.04+(f+.55)*pitch).r;
  function panes(edge,f){
    let n=0,open=false;
    for(let i=0;i<120;i++){
      const dark=tone(edge,(i+.5)/120,f)<.19;
      if(dark&&!open)n++;
      open=dark;
    }
    return n;
  }
  assert.equal(panes(6,12),9);
  assert.equal(panes(33,12),6);
  // Crop to the central stone stage above the setback; full-height glass fins
  // outside it have their own color and shouldn't count as punched openings.
  for(const [edge,count,trim] of [[6,7,.11],[33,4,.16]]){
    let openings=0,opened=false;
    for(let i=0;i<90;i++){
      const dark=tone(edge,trim+(1-2*trim)*(i+.5)/90,32)<.19;
      if(dark&&!opened)openings++;
      opened=dark;
    }
    assert.equal(openings,count);
  }
  const win=probe(block,b,33,2.5/6,.04+12.55*pitch),pier=probe(block,b,33,2/6,.04+12.55*pitch);
  assert.ok(win.z+.008<pier.z&&win.r<pier.r*.5);
  assert.ok(tone(33,2.48/6,15)>win.r&&tone(33,2.48/6,15)<pier.r);
  assert.ok(block.geometry.index.count/3<9500);
});
test('the fixed waterfront viewpoint sees the upper bays and the 183 m screen steps above its shoulders',async()=>{
  const {root,windows,block}=model();
  const upper=root.getObjectByName('50 Fremont architectural roof'),ledge=root.getObjectByName('50 Fremont shoulder roof');
  const top=new THREE.Box3().setFromObject(upper),shoulder=new THREE.Box3().setFromObject(ledge);
  assert.ok(Math.abs(top.max.y-10.98)<.001&&Math.abs(shoulder.max.y-10.395)<.001);
  assert.ok(top.min.x>shoulder.min.x+.19&&top.max.z<shoulder.max.z-.18);
  const eye=new THREE.Vector3(49.180768,10.9,16.889407),target=new THREE.Vector3(0,2.4,0);
  const camera=new THREE.PerspectiveCamera(20,1440/940,.35,1800);
  camera.position.copy(eye);camera.lookAt(target);camera.setFocalLength(40);camera.updateMatrixWorld();
  const {createLandscape}=await import('../app/landscape.ts');
  const world=createLandscape();world.root.updateMatrixWorld(true);
  assert.ok(world.root.getObjectByName('50 Fremont Center'),'Custom tower is registered');
  const chunks=world.architectureChunks.map(o=>({o,box:new THREE.Box3().setFromObject(o)}));
  const ray=new THREE.Raycaster(),seen=windows.filter(w=>{
    if(w.y<7||Math.sin(w.ry)<.9)return false;
    const p=new THREE.Vector3(w.x,w.y,w.z),ndc=p.clone().project(camera);
    if(Math.abs(ndc.x)>1||Math.abs(ndc.y)>1||Math.abs(ndc.z)>1)return false;
    const d=p.clone().sub(eye);ray.set(eye,d.clone().normalize());ray.far=d.length()+.02;
    if(!(ray.intersectObject(block)[0]?.point.distanceTo(p)<.02))return false;
    const first=ray.intersectObjects(chunks.filter(c=>ray.ray.intersectsBox(c.box)).map(c=>c.o),false)[0];
    return first&&first.point.distanceTo(p)<.02;
  });
  assert.ok(seen.length>=6);
});
