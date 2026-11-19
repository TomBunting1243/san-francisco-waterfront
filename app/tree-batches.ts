import * as THREE from 'three';
import {bakeRigidChunk} from './city-blocks.ts';

type PaintedMesh=THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>;
type Plant={parts:PaintedMesh[];bounds:THREE.Box3};
export type TreeBatch={mesh:THREE.Mesh;high:THREE.BufferGeometry;low:THREE.BufferGeometry;height:number;draw?:{batch:THREE.BatchedMesh;instance:number;fine:number;coarse:number}};
const tileWidth=4.5;
const box=new THREE.Box3(),point=new THREE.Vector3();

// Keep vertices on the artist's original painted surface. Cluster a small crown
// in its own coordinate system so a tall, narrow crown retains its proportions.
// Opposing windings remain distinct on palms and other two-sided leaf surfaces.
function reducedCrown(high:THREE.BufferGeometry,part:PaintedMesh,start:number,indices:number[]){
  const p=high.getAttribute('position'),count=part.geometry.getAttribute('position').count;
  box.copy(part.geometry.boundingBox!).applyMatrix4(part.matrixWorld);
  const scale=box.getSize(new THREE.Vector3());
  const divisions=part.geometry.userData.planeLeaf?4:5,last=divisions-1;
  scale.set(divisions/Math.max(.00001,scale.x),divisions/Math.max(.00001,scale.y),divisions/Math.max(.00001,scale.z));
  const remap=new Uint32Array(count),cells=new Map<number,{index:number;distance:number}>();
  for(let i=0;i<count;i++){
    point.fromBufferAttribute(p,start+i).sub(box.min).multiply(scale);
    const x=Math.min(last,Math.max(0,Math.floor(point.x))),y=Math.min(last,Math.max(0,Math.floor(point.y))),z=Math.min(last,Math.max(0,Math.floor(point.z)));
    const key=x+5*y+25*z,old=cells.get(key);
    // Favor the envelope in the outer cells to keep the measured silhouette.
    const target=(k:number)=>k===0?0:k===last?divisions:k+.5;
    const distance=(point.x-target(x))**2+(point.y-target(y))**2+(point.z-target(z))**2;
    if(!old||distance<old.distance)cells.set(key,{index:start+i,distance});
    remap[i]=key;
  }
  const original=part.geometry.index,n=original?.count??count,seen=new Set<number>();
  for(let i=0;i<n;i+=3){
    const a=remap[original?original.getX(i):i],b=remap[original?original.getX(i+1):i+1],c=remap[original?original.getX(i+2):i+2];
    if(a===b||b===c||c===a)continue;
    const key=a<=b&&a<=c?a+125*(b+125*c):b<=c?b+125*(c+125*a):c+125*(a+125*b);
    if(seen.has(key))continue;
    seen.add(key);indices.push(cells.get(a)!.index,cells.get(b)!.index,cells.get(c)!.index);
  }
}

export function bakeTreeBatches(meshes:PaintedMesh[],material:THREE.MeshStandardMaterial){
  const plants=new Map<object,Plant>();
  for(const mesh of meshes){
    const anchor=mesh.userData.plantAnchor;
    if(!anchor)continue;
    let plant=plants.get(anchor);
    if(!plant)plants.set(anchor,plant={parts:[],bounds:new THREE.Box3()});
    if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
    plant.bounds.union(box.copy(mesh.geometry.boundingBox!).applyMatrix4(mesh.matrixWorld));plant.parts.push(mesh);
  }
  const tiles=new Map<string,Plant[]>();
  for(const plant of plants.values()){
    plant.bounds.getCenter(point);
    const key=Math.floor(point.x/tileWidth)+','+Math.floor(point.z/tileWidth),tile=tiles.get(key);
    if(tile)tile.push(plant);else tiles.set(key,[plant]);
  }
  const batches:TreeBatch[]=[];
  for(const [key,trees] of tiles){
    const parts=trees.flatMap(tree=>tree.parts),mesh=bakeRigidChunk('Waterfront trees '+key,parts,material);
    const high=mesh.geometry,low=new THREE.BufferGeometry(),indices:number[]=[];
    const foliage=new Uint8Array(high.getAttribute('position').count);
    high.setAttribute('foliageMask',new THREE.BufferAttribute(foliage,1,true));
    for(const [name,attr] of Object.entries(high.attributes))low.setAttribute(name,attr);
    let start=0;
    for(const part of parts){
      const g=part.geometry,n=g.getAttribute('position').count,index=g.index;
      const isCrown=part.userData.plantCrown||g.userData.plantCrown;
      if(isCrown)foliage.fill(part.userData.waterfrontPlant==='palm'?128:g.userData.planeLeaf?224:255,start,start+n);
      if(isCrown&&(index?.count??n)>300)reducedCrown(high,part,start,indices);
      else for(let i=0;i<(index?.count??n);i++)indices.push(start+(index?index.getX(i):i));
      start+=n;
    }
    low.setIndex(indices);low.boundingBox=high.boundingBox;low.boundingSphere=high.boundingSphere;
    batches.push({mesh,high,low:indices.length<high.index!.count?low:high,height:Math.max(...trees.map(t=>t.bounds.max.y-t.bounds.min.y))});
  }
  return batches;
}

// The renderer culls these instances for both the main camera and the sun.
// A supported multi-draw extension submits all surviving tiles in one call.
export function createTreeDraw(tiles:TreeBatch[],material:THREE.Material){
  if(!tiles.length)return undefined;
  const compact=tiles.map(t=>{
    if(t.low===t.high)return t.high;
    const index=t.low.index!,used=new Map<number,number>(),indices=new Uint32Array(index.count);
    for(let i=0;i<index.count;i++){
      const old=index.getX(i);let fresh=used.get(old);
      if(fresh===undefined){fresh=used.size;used.set(old,fresh);}
      indices[i]=fresh;
    }
    const geometry=new THREE.BufferGeometry();
    for(const [name,source] of Object.entries(t.high.attributes)){
      const attr=source as THREE.BufferAttribute,dim=attr.itemSize;
      const array=attr.array.slice(0,used.size*dim);
      for(const [old,fresh] of used)for(let k=0;k<dim;k++)array[fresh*dim+k]=attr.array[old*dim+k];
      geometry.setAttribute(name,new THREE.BufferAttribute(array,dim,attr.normalized));
    }
    geometry.setIndex(new THREE.BufferAttribute(indices,1));
    geometry.boundingBox=t.high.boundingBox;geometry.boundingSphere=t.high.boundingSphere;
    return geometry;
  });
  const geometries=tiles.flatMap((t,i)=>compact[i]===t.high?[t.high]:[t.high,compact[i]]);
  const batch=new THREE.BatchedMesh(tiles.length,geometries.reduce((sum,g)=>sum+g.getAttribute('position').count,0),
    geometries.reduce((sum,g)=>sum+g.index!.count,0),material);
  batch.name='Waterfront trees';batch.castShadow=batch.receiveShadow=true;batch.sortObjects=false;
  for(const [i,t] of tiles.entries()){
    const fine=batch.addGeometry(t.high),coarse=compact[i]===t.high?fine:batch.addGeometry(compact[i]);
    t.draw={batch,instance:batch.addInstance(fine),fine,coarse};t.mesh.geometry=t.high;
  }
  batch.computeBoundingBox();batch.computeBoundingSphere();
  return batch;
}

export function updateTreeBatches(batches:TreeBatch[],camera:THREE.PerspectiveCamera,height:number){
  camera.updateMatrixWorld();
  const e=camera.matrixWorldInverse.elements,pixelsPerUnit=height*.5*camera.projectionMatrix.elements[5];
  let changed=false;
  for(const tile of batches){
    const sphere=tile.high.boundingSphere!,c=sphere.center;
    const depth=-(e[2]*c.x+e[6]*c.y+e[10]*c.z+e[14])-sphere.radius;
    const pixels=pixelsPerUnit*tile.height/Math.max(camera.near,depth);
    const wanted=pixels>(tile.mesh.geometry===tile.low?46:37)?tile.high:tile.low;
    if(tile.mesh.geometry!==wanted){
      tile.mesh.geometry=wanted;
      if(tile.draw)tile.draw.batch.setGeometryIdAt(tile.draw.instance,wanted===tile.high?tile.draw.fine:tile.draw.coarse);
      changed=true;
    }
  }
  return changed;
}
