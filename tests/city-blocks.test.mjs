import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {bakeBlockGroups,bakeBlocks,bakeRigidChunk,freezeBakedArchitecture,retireBakedMeshes} from '../app/city-blocks.ts';

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

test('packed rigid batches preserve Three transforms, pigment and precise bounds across mixed vertex layouts',()=>{
  const geometry=new THREE.BoxGeometry(1.37,.49,2.23),interleaved=new THREE.BufferGeometry();
  const data=new THREE.InterleavedBuffer(new Float32Array([.4,.9,.1,1,0,0, -.3,.6,.7,0,1,0, -.9,.06,.4,0,0,1]),6);
  interleaved.setAttribute('position',new THREE.InterleavedBufferAttribute(data,3,0));
  interleaved.setAttribute('normal',new THREE.InterleavedBufferAttribute(data,3,3));
  const packed=geometry.clone(),bytes=new Uint8Array(3*packed.attributes.position.count);
  const normals=new Int16Array(bytes.length);
  for(let i=0;i<bytes.length;i++){bytes[i]=(i*97+13)%256;normals[i]=Math.round(32767*Math.sin(i+.72));}
  normals[0]=-32768;
  packed.setAttribute('normal',new THREE.Int16BufferAttribute(normals,3,true));
  packed.setAttribute('color',new THREE.Uint8BufferAttribute(bytes,3,true));
  const paint=new THREE.MeshStandardMaterial({color:0xa1cc6e,vertexColors:true});
  const sources=[geometry,interleaved,packed].map((g,i)=>{
    const m=new THREE.Mesh(g,paint);m.scale.set(3,.24,1.7);m.position.set(i-.43,2,-.77);
    m.rotation.set(.37,i*.44,-.22);m.updateMatrixWorld(true);return m;
  });
  const batch=bakeRigidChunk('Comparison',sources,paint).geometry;
  const positions=[],directions=[],pigments=[],indices=[];
  for(const m of sources){
    const {position,normal,color}=m.geometry.attributes,n=new THREE.Matrix3().getNormalMatrix(m.matrixWorld);
    const offset=positions.length/3;
    for(let i=0;i<position.count;i++){
      positions.push(...new THREE.Vector3().fromBufferAttribute(position,i).applyMatrix4(m.matrixWorld).toArray());
      directions.push(...new THREE.Vector3().fromBufferAttribute(normal,i).applyNormalMatrix(n).toArray().map(v=>Math.round(v*32767)));
      for(const [k,component] of paint.color.toArray().entries())pigments.push(Math.round(255*component*(color?color.getComponent(i,k):1)));
    }
    for(let i=0;i<(m.geometry.index?.count??position.count);i++)indices.push(offset+(m.geometry.index?.getX(i)??i));
  }
  assert.deepEqual(batch.index.array,Uint16Array.from(indices));
  assert.deepEqual(batch.attributes.position.array,Float32Array.from(positions));
  assert.deepEqual(batch.attributes.normal.array,Int16Array.from(directions));
  assert.deepEqual(batch.attributes.color.array,Uint8Array.from(pigments));
  const box=batch.boundingBox.clone(),sphere=batch.boundingSphere.clone();
  batch.computeBoundingBox();batch.computeBoundingSphere();
  assert.ok(batch.boundingBox.equals(box));assert.ok(batch.boundingSphere.equals(sphere));
});

test('tile assignment includes displaced morph bounds and lighting samples retain full precision before packing',()=>{
  const geometry=new THREE.BoxGeometry(.73,.31,.56);
  const displaced=geometry.attributes.position.clone();
  for(let i=0;i<displaced.count;i++)displaced.setY(i,displaced.getY(i)+2);
  geometry.morphAttributes.position=[displaced];
  const expected=geometry.clone();expected.computeBoundingBox();
  const material=new THREE.MeshStandardMaterial({color:'#99b7c1'});
  const part=new THREE.Mesh(geometry,material);
  part.position.set(3.141592653589793,.538729876543,-2.718281828459045);
  part.rotation.y=.789159;part.updateMatrixWorld();
  const samples=[];
  part.userData.uplight=(p,n)=>{samples.push([p.toArray(),n.toArray()]);return .5;};
  const [block]=bakeBlocks([part],material);
  assert.ok(geometry.boundingBox.equals(expected.boundingBox));
  const direction=new THREE.Matrix3().getNormalMatrix(part.matrixWorld);
  for(let i=0;i<geometry.attributes.position.count;i++){
    const p=new THREE.Vector3().fromBufferAttribute(geometry.attributes.position,i).applyMatrix4(part.matrixWorld);
    const n=new THREE.Vector3().fromBufferAttribute(geometry.attributes.normal,i).applyNormalMatrix(direction);
    assert.deepEqual(samples[i],[p.toArray(),n.toArray()]);
  }
  assert.ok(block.geometry.getAttribute('signLight').array.some(value=>value>0));
});


test('deadline pauses keep synchronous district order, material, buffers and bounds',()=>{
  const material=new THREE.MeshStandardMaterial({color:'#b7906f'}),geometry=new THREE.BoxGeometry();
  const parts=[1,25,-5,100,172].map(x=>{
    const mesh=new THREE.Mesh(geometry,material);
    mesh.position.x=x;mesh.updateMatrixWorld();return mesh;
  });
  const expected=bakeBlocks(parts,material);
  assert.ok(expected.length>=3&&expected.some(m=>m.name.includes('district')));
  for(const interval of [1,2,Infinity]){
    let calls=0,pauses=0;
    const steps=bakeBlockGroups(parts,material,()=>++calls%interval===0);
    assert.equal(calls,0);
    let next=steps.next();
    while(!next.done){
      assert.equal(next.value,undefined);assert.equal(calls,++pauses*interval);next=steps.next();
    }
    assert.equal(calls,expected.length);assert.equal(pauses,Math.floor(calls/interval));
    const actual=next.value;
    assert.deepEqual(actual.map(m=>m.name),expected.map(m=>m.name));
    for(let i=0;i<actual.length;i++){
      const a=actual[i].geometry,e=expected[i].geometry;
      assert.equal(actual[i].material,material);
      assert.deepEqual(a.index.array,e.index.array);
      for(const key of Object.keys(e.attributes))assert.deepEqual(a.attributes[key].array,e.attributes[key].array);
      assert.ok(a.boundingBox.equals(e.boundingBox)&&a.boundingSphere.equals(e.boundingSphere));
    }
  }
  assert.deepEqual(bakeBlockGroups([],material,()=>assert.fail('empty bake checked deadline')).next(),{value:[],done:true});
});

test('batch retirement preserves sibling arrays, nested attachments and native observer order',()=>{
  for(const observed of [false,true]){
    const root=new THREE.Group(),left=new THREE.Group(),right=new THREE.Group();
    const outer=new THREE.Mesh(),inner=new THREE.Mesh(),last=new THREE.Mesh();
    const socket=new THREE.Group();outer.add(inner,socket);root.add(left,outer,right,last);
    const original=root.children,events=[];
    if(observed){
      root.addEventListener('childremoved',e=>events.push([e.child,root.children.slice()]));
      inner.geometry.addEventListener('dispose',()=>events.push(['disposed',outer.children.slice()]));
    }
    retireBakedMeshes([outer,inner,last]);
    assert.equal(root.children,original);assert.deepEqual(root.children,[left,right]);
    assert.equal(outer.parent,null);assert.equal(inner.parent,null);assert.equal(last.parent,null);
    assert.deepEqual(outer.children,[socket]);assert.equal(socket.parent,outer);
    if(observed)assert.deepEqual(events,[[outer,[left,right,last]],['disposed',[socket]],[last,[left,right]]]);
  }
});
