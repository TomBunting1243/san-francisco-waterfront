import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {mappedBuildings} from '../app/sf-map.ts';
import {addOneMarketTower} from '../app/one-market-towers.ts';
import {bakeBlocks} from '../app/city-blocks.ts';

function build(){
  const root=new THREE.Group(),windows=[];
  const matched=mappedBuildings.filter(b=>addOneMarketTower(b,root,windows));
  root.updateMatrixWorld(true);return {root,windows,matched};
}
test('the two One Market shafts meet the built podium and terminate at their individual survey heights',()=>{
  const {root,matched}=build();
  assert.deepEqual(matched.map(b=>b.id).sort(),[132238423,132238431]);
  for(const [i,b] of matched.entries()){
    const g=root.children[i],bb=new THREE.Box3().setFromObject(g);
    assert.ok(Math.abs(bb.min.y-1.642)<1e-4);
    assert.ok(Math.abs(bb.max.y-b.h)<1e-5);
    const [x,z]=b.p[0],center=bb.getCenter(new THREE.Vector3());
    const ray=new THREE.Raycaster(new THREE.Vector3(center.x*.15+x*.85,15,center.z*.15+z*.85),new THREE.Vector3(0,-1,0));
    assert.equal(ray.intersectObject(g)[0].object.name,'Inset roof membrane');
    assert.equal(g.getObjectsByProperty('name','Parallel roof equipment bank').length,b.id===132238423?2:0);
    assert.equal(g.getObjectsByProperty('name','Single rectangular penthouse').length,b.id===132238431?1:0);
  }
});
test('four oriented curtain walls retain separated glazed bays, physical returns and their baked pigments',()=>{
  const {root,windows}=build();
  assert.ok(windows.length>200&&windows.length<400);
  const meshes=[];root.traverse(o=>{if(o.isMesh)meshes.push(o);});
  const bands=root.children[0].getObjectByName('Projecting pale piers, slab bands and shaded returns');
  const normals=bands.geometry.getAttribute('normal');
  const out=new Set();
  for(let i=0;i<normals.count;i++)if(Math.abs(normals.getY(i))<.05)out.add(Math.round(Math.atan2(normals.getX(i),normals.getZ(i))/.1));
  assert.ok(out.size>=4);
  const chunks=bakeBlocks(meshes,new THREE.MeshStandardMaterial({vertexColors:true}));
  let triangles=0;const colors=new Set();
  for(const c of chunks){triangles+=c.geometry.index.count/3;const rgb=c.geometry.attributes.color;for(let i=0;i<rgb.count;i++)colors.add([rgb.getX(i),rgb.getY(i),rgb.getZ(i)].join(','));}
  assert.ok(colors.size>=12&&triangles<14000);
  const pane=windows[0],normal=new THREE.Vector3(Math.sin(pane.ry),0,Math.cos(pane.ry));
  const start=new THREE.Vector3(pane.x,pane.y,pane.z).addScaledVector(normal,.1);
  const hit=new THREE.Raycaster(start,normal.negate()).intersectObject(root)[0];
  assert.equal(hit.object.name,'Inset office glazing and fine mullions');
});
