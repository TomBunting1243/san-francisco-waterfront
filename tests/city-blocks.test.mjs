import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {bakeBlocks,freezeBakedArchitecture} from '../app/city-blocks.ts';

test('baking preserves native material vertex paint while unpainted materials keep their own tint',()=>{
  const panel=new THREE.PlaneGeometry(1,1);
  const shades=[.12,.31,.55, .14,.29,.52, .62,.64,.54, .68,.66,.56];
  panel.setAttribute('color',new THREE.Float32BufferAttribute(shades,3));
  const clear=new THREE.MeshStandardMaterial({vertexColors:true,color:new THREE.Color(.7,.8,.9)});
  const solid=new THREE.MeshStandardMaterial({color:'#d3c8a9'});
  for(const material of [clear,solid]){
    const [batch]=bakeBlocks([new THREE.Mesh(panel,material)],clear);
    const attr=batch.geometry.getAttribute('color'),tint=material.color.toArray();
    for(let v=0;v<4;v++){
      const rgb=[attr.getX(v),attr.getY(v),attr.getZ(v)];
      for(let c=0;c<3;c++)assert.ok(Math.abs(rgb[c]-tint[c]*(material.vertexColors?shades[v*3+c]:1))<=1/255);
    }
  }
});

test('static districts combine nearby sparse geometry while dense buildings and long terrain stay separate',()=>{
  const paint=new THREE.MeshStandardMaterial({color:'#a38977'});
  const box=new THREE.BoxGeometry(1,1,1);
  const dense=new THREE.SphereGeometry(.46,84,44);
  const ground=new THREE.BoxGeometry(174,.4,6);
  const parts=[
    [box,1,0,2],[box,25,0,2],[dense,1,0,26],
    [ground,-20,-.35,51],[box,-47,0,52],
    [box,-21,0,25],[box,-45,0,25],
  ].map(([geo,x,y,z])=>{
    const mesh=new THREE.Mesh(geo,paint);
    mesh.position.set(x,y,z);mesh.updateMatrixWorld(true);return mesh;
  });
  const baked=bakeBlocks(parts,new THREE.MeshStandardMaterial({vertexColors:true}));
  const batches=new Map(baked.map(b=>[b.name,b.geometry]));
  assert.deepEqual([...batches.keys()].sort(),[
    'City block -1,2','City block -2,2','City block 0,1','City block district -1,0','City block district 0,0',
  ]);
  for(const name of ['City block district -1,0','City block district 0,0']){
    assert.equal(batches.get(name).index.count,72);
  }
  assert.equal(batches.get('City block 0,1').index.count,dense.index.count);
  const original=parts.reduce((total,mesh)=>total+mesh.geometry.index.count,0);
  const packed=baked.reduce((total,mesh)=>total+mesh.geometry.index.count,0);
  assert.equal(packed,original);
  const color=batches.get('City block district 0,0').getAttribute('color');
  assert.ok(Math.abs(color.getX(0)-paint.color.r)<1/255);
});

test('billboard light packs beside daylight pigment only in batches that contain a lamp',()=>{
  const geometry=new THREE.BoxGeometry(1,1,1);
  const paint=new THREE.MeshStandardMaterial({color:'#977b61'});
  const parts=[2,3,101].map(x=>{
    const mesh=new THREE.Mesh(geometry,paint);
    mesh.position.set(x,1,0);
    mesh.updateMatrixWorld(true);
    return mesh;
  });
  const [baseline,unmarked]=bakeBlocks(parts,paint);
  parts[1].userData.signLight=[.9,.5,.25];
  const [lit,neighbor]=bakeBlocks(parts,paint);
  assert.equal(lit.geometry.index.count,baseline.geometry.index.count);
  for(const attr of ['position','normal','color'])assert.deepEqual(
    lit.geometry.getAttribute(attr).array,baseline.geometry.getAttribute(attr).array);
  const attribute=lit.geometry.getAttribute('signLight');
  assert.ok(attribute.normalized);
  const vertices=geometry.getAttribute('position').count;
  assert.equal(attribute.count,vertices*2);
  assert.ok(attribute.array.slice(0,vertices*3).every(channel=>channel===0));
  assert.deepEqual(Array.from(attribute.array.slice(vertices*3,vertices*3+3)),[230,128,64]);
  assert.equal(neighbor.name,unmarked.name);
  assert.ok(!neighbor.geometry.hasAttribute('signLight'));
});

test('baked references skip per-frame matrix work while attached scenery, live roots and coordinate queries stay valid',()=>{
  const outer=new THREE.Group(),root=new THREE.Group(),arch=new THREE.Group(),empty=new THREE.Group(),marker=new THREE.Group();
  outer.add(root);root.add(arch);arch.add(empty);empty.add(marker);
  marker.name='Authoring reference';marker.position.set(2,3,4);empty.position.set(1,0,0);arch.position.x=4;
  const chunk=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());
  chunk.position.z=5;arch.add(chunk);
  const animated=new THREE.Group(),joint=new THREE.Group(),light=new THREE.PointLight();
  arch.add(animated,light);animated.add(joint);joint.name='Moving socket';
  const nameBefore=root.getObjectByName(marker.name),ray=new THREE.Raycaster(new THREE.Vector3(4,0,9),new THREE.Vector3(0,0,-1));
  root.updateMatrixWorld(true);const before=ray.intersectObject(chunk)[0].distance;
  freezeBakedArchitecture(root,[chunk],new Set([animated]));
  assert.equal(root.getObjectByName(marker.name),nameBefore);assert.equal(marker.parent,empty);
  assert.equal(light.visible,true);assert.equal(animated.visible,true);assert.equal(joint.visible,true);
  assert.equal(arch.visible,true);assert.equal(empty.visible,false);
  let compose=0;
  const update=marker.updateMatrix;
  marker.updateMatrix=function(){compose++;return update.call(this);};
  for(let i=0;i<12;i++)outer.updateMatrixWorld(true);
  assert.equal(compose,0);
  assert.equal(ray.intersectObject(chunk)[0].distance,before);
  const copy=chunk.clone();const vignette=new THREE.Group();vignette.position.z=-2;vignette.add(copy);vignette.updateMatrixWorld(true);
  assert.equal(copy.matrixWorld.elements[14],3);
  outer.position.x=2;animated.position.z=3;joint.position.y=1.5;outer.updateMatrixWorld();
  assert.equal(compose,1);assert.deepEqual(marker.matrixWorld.elements.slice(12,15),[9,3,4]);
  assert.deepEqual(joint.matrixWorld.elements.slice(12,15),[6,1.5,3]);
  marker.position.y+=1;
  assert.deepEqual(marker.localToWorld(new THREE.Vector3()).toArray(),[9,4,4]);
  assert.deepEqual(marker.worldToLocal(new THREE.Vector3(9,4,4)).toArray(),[0,0,0]);
  ray.ray.origin.x+=2;assert.equal(ray.intersectObject(chunk)[0].distance,before);
  empty.visible=true;marker.position.x++;outer.updateMatrixWorld(true);
  assert.deepEqual(marker.matrixWorld.elements.slice(12,15),[10,4,4]);
});
