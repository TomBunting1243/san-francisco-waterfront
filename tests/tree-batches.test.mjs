import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {bakeTreeBatches,createTreeDraw,updateTreeBatches} from '../app/tree-batches.ts';

const material=new THREE.MeshStandardMaterial({vertexColors:true});
function plant(x,color){
  const anchor={},bark=new THREE.Mesh(new THREE.CylinderGeometry(.025,.04,.8,6),new THREE.MeshStandardMaterial({color:'#726552'}));
  const leaf=new THREE.IcosahedronGeometry(.49,5);
  const rgb=new THREE.Color(color),tones=[];
  for(let i=0;i<leaf.getAttribute('position').count;i++)tones.push(rgb.r,rgb.g,rgb.b);
  leaf.setAttribute('color',new THREE.Float32BufferAttribute(tones,3));leaf.userData.paintVertices=true;
  const crown=new THREE.Mesh(leaf,new THREE.MeshStandardMaterial({color:0xffffff}));
  for(const m of [bark,crown])m.userData.plantAnchor=anchor;
  crown.userData.plantCrown=true;bark.position.set(x,.4,0);crown.position.set(x,.94,0);
  for(const m of [bark,crown])m.updateMatrixWorld();
  return [bark,crown];
}

test('complete plants share compact spatial batches and retain positions, painted vertex data and shadows',()=>{
  const parts=[...plant(1,'#517a52'),...plant(3,'#839c64'),...plant(20,'#518251')];
  const batches=bakeTreeBatches(parts,material);
  assert.equal(batches.length,2);
  for(const t of batches){
    assert.equal(t.mesh.geometry,t.high);assert.ok(t.mesh.castShadow&&t.mesh.receiveShadow);
    assert.ok(t.low.index.count<t.high.index.count*.70);
    assert.equal(t.high.boundingBox,t.low.boundingBox);assert.equal(t.low.getAttribute('color'),t.high.getAttribute('color'));
    assert.equal(t.low.getAttribute('position'),t.high.getAttribute('position'));
    const c=t.low.getAttribute('color'),colors=new Set();
    const actual=new THREE.Box3(),p=t.low.getAttribute('position');
    for(const j of t.low.index.array){
      colors.add(new THREE.Color().fromBufferAttribute(c,j).getHexString());
      actual.expandByPoint(new THREE.Vector3().fromBufferAttribute(p,j));
    }
    assert.ok(colors.size>=2&&colors.has(new THREE.Color().fromBufferAttribute(c,0).getHexString()));
    assert.ok(actual.min.distanceTo(t.high.boundingBox.min)<.08&&actual.max.distanceTo(t.high.boundingBox.max)<.08);
  }
  assert.equal(batches.reduce((s,t)=>s+t.high.index.count,0),parts.reduce((s,m)=>s+(m.geometry.index?.count??m.geometry.attributes.position.count),0));
});
test('projection switches detail once per threshold and restores the original close-up geometry',()=>{
  const [t]=bakeTreeBatches(plant(0,'#839c64'),material),cam=new THREE.PerspectiveCamera(45,1,.35,1800);
  cam.position.set(0,1,100);cam.lookAt(0,1,0);cam.updateProjectionMatrix();
  assert.ok(updateTreeBatches([t],cam,600));assert.equal(t.mesh.geometry,t.low);
  cam.position.z=26;assert.equal(updateTreeBatches([t],cam,600),false);
  cam.position.z=16;assert.ok(updateTreeBatches([t],cam,600));assert.equal(t.mesh.geometry,t.high);
  cam.position.z=26;assert.equal(updateTreeBatches([t],cam,600),false);
  cam.position.z=100;assert.ok(updateTreeBatches([t],cam,600));
  cam.setFocalLength(500);assert.ok(updateTreeBatches([t],cam,600));assert.equal(t.mesh.geometry,t.high);
});

test('native multi-draw keeps spatial culling, independent camera LOD and shadow submissions',()=>{
  const tiles=bakeTreeBatches([...plant(0,'#819764'),...plant(31,'#5e805f')],material);
  const draw=createTreeDraw(tiles,material);
  const camera=new THREE.PerspectiveCamera(18,1,.35,1800);
  camera.position.set(0,1,24);camera.lookAt(0,1,0);camera.updateMatrixWorld();
  updateTreeBatches(tiles,camera,90);
  const expected=tiles[0].mesh.geometry.index.count;
  draw.onBeforeRender(null,null,camera,draw.geometry,material);
  assert.equal(draw._multiDrawCount,1);assert.equal(draw._multiDrawCounts[0],expected);
  assert.equal(draw.getGeometryIdAt(tiles[0].draw.instance),tiles[0].draw.coarse);
  const sun=new THREE.OrthographicCamera(-50,50,50,-50,.1,100);
  sun.position.set(5,20,30);sun.lookAt(0,0,0);sun.updateMatrixWorld();
  draw.onBeforeShadow(null,null,camera,sun,draw.geometry,material);
  assert.equal(draw._multiDrawCount,2);
  updateTreeBatches(tiles,camera,2400);
  assert.equal(draw.getGeometryIdAt(tiles[0].draw.instance),tiles[0].draw.fine);
  assert.ok(draw.castShadow&&draw.receiveShadow);
  draw.dispose();
});

test('production renderer submits a bounded subset on the fixed desktop and phone orbits',async(t)=>{
  const {createLandscape}=await import('../app/landscape.ts');
  const {openingLens,openingYaw,openingCamera,orbitPitch}=await import('../app/camera.ts');
  const world=createLandscape(),draw=world.treeDraw;
  assert.ok(draw.isBatchedMesh&&world.treeBatches.length>30);
  const full=world.treeBatches.reduce((s,t)=>s+t.high.index.count/3,0);
  for(const [width,height] of [[1440,900],[390,844]]){
    const lens=openingLens(width,height),yaw=openingYaw(width,height),target=new THREE.Vector3(...openingCamera.target);
    const angle=orbitPitch(yaw,0,Math.atan2(lens.elevation,lens.distance)),radius=Math.hypot(lens.elevation,lens.distance);
    const camera=new THREE.PerspectiveCamera(20,width/height,.35,1800);
    camera.position.copy(target).add(new THREE.Vector3(Math.sin(yaw)*Math.cos(angle)*radius,Math.sin(angle)*radius,Math.cos(yaw)*Math.cos(angle)*radius));camera.lookAt(target);
    for(const zoom of [1,20]){
      camera.setFocalLength(lens.focalLength*zoom);
      updateTreeBatches(world.treeBatches,camera,height);
      draw.onBeforeRender(null,null,camera,draw.geometry,draw.material);
      const count=draw._multiDrawCount;
      const triangles=draw._multiDrawCounts.subarray(0,count).reduce((a,b)=>a+b,0)/3;
      t.diagnostic(`${width}×${height} at ${zoom}×: ${count}/${world.treeBatches.length} subdraws, ${triangles}/${full} full-detail tree triangles`);
      assert.ok(count>0&&count<world.treeBatches.length);
      assert.ok(triangles<full*(zoom===1?.68:.22),`${width}px ${zoom}× submitted ${triangles} of ${full}`);
    }
  }
});

test('canopy detail uses a filtered relief texture on foliage and leaves bark unmarked',async()=>{
  const {leafReliefTile}=await import('../app/canopy-pigment.ts');
  const parts=plant(2,'#71824f'),[tile]=bakeTreeBatches(parts,material);
  const mask=tile.high.getAttribute('foliageMask');
  assert.equal(mask.normalized,true);assert.equal(mask.getX(0),0);
  assert.equal(mask.getX(mask.count-1),1);assert.equal(tile.low.getAttribute('foliageMask'),mask);
  const texture=leafReliefTile();assert.equal(texture.generateMipmaps,true);
  assert.equal(texture.minFilter,THREE.LinearMipmapLinearFilter);assert.equal(texture.image.width,128);
  const red=texture.image.data.filter((_v,i)=>i%4===0);
  assert.ok(Math.max(...red)-Math.min(...red)>64);texture.dispose();
});
