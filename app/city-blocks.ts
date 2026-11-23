import * as THREE from 'three';
import {registerTidalRuns} from './tidal-berths.ts';

type PaintedMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
type Tile={x:number;z:number;parts:PaintedMesh[];bounds:THREE.Box3;triangles:number};
const blockWidth=24;
// A wider batch may bring a neighbor into view. Bound that extra work to a small
// fraction of a downtown tile, and never attach world-spanning land to a district.
const sparseTriangleLimit=6400;

function coalesceSparseTiles(tiles:Map<string,Tile>){
  const districts=new Map<string,Tile[]>();
  const size=new THREE.Vector3();
  for(const tile of tiles.values()){
    if(tile.triangles>sparseTriangleLimit)continue;
    tile.bounds.getSize(size);
    if(size.x>blockWidth+4||size.z>blockWidth+4)continue;
    const key=Math.floor(tile.x/2)+','+Math.floor(tile.z/2);
    const peers=districts.get(key)??[];
    peers.push(tile);districts.set(key,peers);
  }
  const combined=new Map<string,PaintedMesh[]>();
  for(const [key,peers] of districts){
    if(peers.length<2||peers.reduce((total,t)=>total+t.triangles,0)>sparseTriangleLimit)continue;
    const bounds=new THREE.Box3();
    for(const tile of peers)bounds.union(tile.bounds);
    bounds.getSize(size);
    if(size.x>blockWidth*2+4||size.z>blockWidth*2+4||size.y>14)continue;
    for(const tile of peers)tiles.delete(tile.x+','+tile.z);
    combined.set('district '+key,peers.flatMap(tile=>tile.parts));
  }
  for(const [key,tile] of tiles)combined.set(key,tile.parts);
  return combined;
}

function groupBlockParts(meshes:PaintedMesh[]){
  const blocks = new Map<string, Tile>();
  const point = new THREE.Vector3();
  const worldBounds=new THREE.Box3();
  for (const mesh of meshes) {
    const geo = mesh.geometry;
    const bounds=sourceBounds(geo);
    bounds.getCenter(point).applyMatrix4(mesh.matrixWorld);
    const x=Math.floor(point.x/blockWidth),z=Math.floor(point.z/blockWidth),key=x+','+z;
    let tile=blocks.get(key);
    if(!tile){tile={x,z,parts:[],bounds:new THREE.Box3(),triangles:0};blocks.set(key,tile);}
    tile.parts.push(mesh);
    tile.bounds.union(worldBounds.copy(bounds).applyMatrix4(mesh.matrixWorld));
    tile.triangles+=(geo.index?.count??geo.attributes.position.count)/3;
  }
  return coalesceSparseTiles(blocks);
}

/** Bake rigid buildings once, preserving indexed source faces in district order. */
export function bakeBlocks(meshes:PaintedMesh[],material:THREE.MeshStandardMaterial):THREE.Mesh[]{
  return Array.from(groupBlockParts(meshes),([key,parts])=>bakeRigidChunk('City block '+key,parts,material));
}

/** A district is complete before pausing, so intermediate frames never see
 * partial geometry. All chunks are returned together in the synchronous order. */
export function* bakeBlockGroups(meshes:PaintedMesh[],material:THREE.MeshStandardMaterial,shouldYield:()=>boolean):Generator<void,THREE.Mesh[]>{
  const chunks:THREE.Mesh[]=[];
  for(const [key,parts] of groupBlockParts(meshes)){
    chunks.push(bakeRigidChunk('City block '+key,parts,material));
    if(shouldYield())yield;
  }
  return chunks;
}

function packedBounds(xyz:Float32Array){
  let minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity;
  for(let i=0;i<xyz.length;i+=3){
    const x=xyz[i],y=xyz[i+1],z=xyz[i+2];
    minX=Math.min(minX,x);minY=Math.min(minY,y);minZ=Math.min(minZ,z);
    maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);maxZ=Math.max(maxZ,z);
  }
  return new THREE.Box3(new THREE.Vector3(minX,minY,minZ),new THREE.Vector3(maxX,maxY,maxZ));
}

export function sourceBounds(geometry:THREE.BufferGeometry){
  if(!geometry.boundingBox){
    const pos=geometry.attributes.position;
    if(pos instanceof THREE.BufferAttribute&&pos.itemSize===3&&!pos.normalized&&pos.array instanceof Float32Array&&!geometry.morphAttributes.position)
      geometry.boundingBox=packedBounds(pos.array);
    else geometry.computeBoundingBox();
  }
  return geometry.boundingBox!;
}

function boundPackedGeometry(geometry:THREE.BufferGeometry,xyz:Float32Array){
  const bounds=packedBounds(xyz),sphere=new THREE.Sphere();
  const center=bounds.getCenter(sphere.center);let distanceSquared=0;
  for(let i=0;i<xyz.length;i+=3){
    const x=xyz[i]-center.x,y=xyz[i+1]-center.y,z=xyz[i+2]-center.z;
    distanceSquared=Math.max(distanceSquared,x*x+y*y+z*z);
  }
  sphere.radius=Math.sqrt(distanceSquared);geometry.boundingBox=bounds;geometry.boundingSphere=sphere;
}

export function bakeRigidChunk(name:string,parts:PaintedMesh[],material:THREE.MeshStandardMaterial){
  const point=new THREE.Vector3(),normal=new THREE.Vector3(),normalMatrix=new THREE.Matrix3();
  let vertices = 0, faces = 0;
  for (const {geometry} of parts) {
    vertices += geometry.attributes.position.count;
    faces += geometry.index?.count ?? geometry.attributes.position.count;
  }
  const positions = new Float32Array(vertices * 3);
  const normals = new Int16Array(vertices * 3);
  const colors = new Uint8Array(vertices * 3);
  const signLights = parts.some(mesh=>mesh.userData.signLight||mesh.userData.uplight||mesh.userData.authoredWindowSpill||mesh.geometry.hasAttribute('signLight')) ? new Uint8Array(vertices * 3) : null;
  // Only freeway stations need 16 bits; district and bridge masks use one byte.
  const roadExposure=parts.some(m=>m.geometry.getAttribute('roadExposure')?.array instanceof Uint16Array)
    ?new Uint16Array(vertices)
    :parts.some(m=>m.userData.roadExposure||m.geometry.hasAttribute('roadExposure'))?new Uint8Array(vertices):null;
  const indices = vertices > 65535 ? new Uint32Array(faces) : new Uint16Array(faces);
  const facadeGrid=parts[0].geometry.hasAttribute('facadeGrid')?new Float32Array(vertices*4):null;
  const printAttribute=parts[0].geometry.hasAttribute('kioskPrint')?'kioskPrint':'billboardPrint';
  const printUv=parts[0].geometry.hasAttribute(printAttribute)?new Float32Array(vertices*2):null;
  const walkPanel=parts[0].geometry.hasAttribute('walkPanel')?new Float32Array(vertices*2):null;
  let vertex = 0, face = 0;
  for (const mesh of parts) {
    const geometry = mesh.geometry, pos = geometry.attributes.position, n = geometry.attributes.normal;
    if(printUv)printUv.set(geometry.getAttribute(printAttribute).array,vertex*2);
    if(walkPanel)walkPanel.set(geometry.getAttribute('walkPanel').array,vertex*2);
    if(facadeGrid)facadeGrid.set(geometry.getAttribute('facadeGrid').array,vertex*4);
    const {r,g,b} = mesh.material.color;
    const paint = mesh.material.vertexColors || geometry.userData.paintVertices ? geometry.attributes.color : undefined;
    const light = mesh.userData.signLight as [number,number,number]|undefined;
    const uplightTint=mesh.userData.uplightTint as readonly [number,number]|undefined;
    const greenLight=uplightTint?.[0]??.82,blueLight=uplightTint?.[1]??.59;
    const uplight=mesh.userData.uplight as ((p:THREE.Vector3,n:THREE.Vector3)=>number)|undefined;
    // Streetlamp glass emits across the physical lens, including head-on close views.
    const glass=geometry.getAttribute('signLight');
    if(signLights&&glass)signLights.set(glass.array,vertex*3);
    if (signLights && light) {
      const [r,g,b]=light.map(value=>Math.round(value*255));
      for (let j=vertex*3; j<(vertex+pos.count)*3; j+=3) {
        signLights[j]=r;signLights[j+1]=g;signLights[j+2]=b;
      }
    }
    const red = Math.round(255*r), green = Math.round(255*g), blue = Math.round(255*b);
    normalMatrix.getNormalMatrix(mesh.matrixWorld);
    const xyz=pos instanceof THREE.BufferAttribute&&pos.itemSize===3&&!pos.normalized&&pos.array instanceof Float32Array?pos.array:null;
    const directions=n instanceof THREE.BufferAttribute&&n.itemSize===3&&!n.normalized&&n.array instanceof Float32Array?n.array:null;
    const e=mesh.matrixWorld.elements,m=normalMatrix.elements,base=vertex*3,end=(vertex+pos.count)*3;
    // Split positions, normals and pigment into homogeneous loops. Much of
    // downtown already uses world axes and needs just its origin added.
    if(xyz&&e[3]===0&&e[7]===0&&e[11]===0&&e[15]===1){
      const translated=e[0]===1&&e[1]===0&&e[2]===0&&e[4]===0&&e[5]===1&&e[6]===0&&e[8]===0&&e[9]===0&&e[10]===1;
      if(translated){
        for(let j=base,k=0;j<end;j+=3,k+=3){
          positions[j]=xyz[k]+e[12];positions[j+1]=xyz[k+1]+e[13];positions[j+2]=xyz[k+2]+e[14];
        }
      }else{
        for(let j=base,k=0;j<end;j+=3,k+=3){
          const x=xyz[k],y=xyz[k+1],z=xyz[k+2];
          positions[j]=e[0]*x+e[4]*y+e[8]*z+e[12];
          positions[j+1]=e[1]*x+e[5]*y+e[9]*z+e[13];
          positions[j+2]=e[2]*x+e[6]*y+e[10]*z+e[14];
        }
      }
    }else for(let i=0;i<pos.count;i++)point.fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld).toArray(positions,base+3*i);

    if(directions){
      // Planar faces repeat their normal at each corner. Reuse its transformed
      // and quantized components until the source direction actually changes.
      let previousX=NaN,previousY=NaN,previousZ=NaN,nx=0,ny=0,nz=0;
      for(let j=base,k=0;j<end;j+=3,k+=3){
        const x=directions[k],y=directions[k+1],z=directions[k+2];
        if(x!==previousX||y!==previousY||z!==previousZ){
          normal.set(m[0]*x+m[3]*y+m[6]*z,m[1]*x+m[4]*y+m[7]*z,m[2]*x+m[5]*y+m[8]*z).normalize();
          nx=Math.round(normal.x*32767);ny=Math.round(normal.y*32767);nz=Math.round(normal.z*32767);
          previousX=x;previousY=y;previousZ=z;
        }
        normals[j]=nx;normals[j+1]=ny;normals[j+2]=nz;
      }
    }else for(let i=0;i<pos.count;i++){
      normal.fromBufferAttribute(n,i).applyNormalMatrix(normalMatrix);
      const j=base+i*3;normals[j]=Math.round(normal.x*32767);normals[j+1]=Math.round(normal.y*32767);normals[j+2]=Math.round(normal.z*32767);
    }
    if(!paint){
      for(let j=base;j<end;j+=3){colors[j]=red;colors[j+1]=green;colors[j+2]=blue;}
    }else if(paint instanceof THREE.BufferAttribute&&paint.itemSize===3&&!paint.normalized&&paint.array instanceof Float32Array){
      const channels=paint.array;
      for(let j=base,k=0;j<end;j+=3,k+=3){
        colors[j]=Math.round(255*r*channels[k]);colors[j+1]=Math.round(255*g*channels[k+1]);colors[j+2]=Math.round(255*b*channels[k+2]);
      }
    }else for(let i=0;i<pos.count;i++){
      const j=base+3*i;colors[j]=Math.round(255*r*paint.getX(i));colors[j+1]=Math.round(255*g*paint.getY(i));colors[j+2]=Math.round(255*b*paint.getZ(i));
    }
    if(signLights&&uplight&&!light)for(let i=0;i<pos.count;i++){
      point.fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld);
      normal.fromBufferAttribute(n,i).applyNormalMatrix(normalMatrix);
      const j=base+i*3,irradiance=uplight(point,normal);
      signLights[j]=Math.min(255,colors[j]*irradiance);
      signLights[j+1]=Math.min(255,colors[j+1]*irradiance*greenLight);
      signLights[j+2]=Math.min(255,colors[j+2]*irradiance*blueLight);
    }
    const windowSpill=mesh.userData.authoredWindowSpill as typeof uplight;
    if(signLights&&windowSpill&&!light)for(let i=0;i<pos.count;i++){
      const j=base+i*3;
      point.fromArray(positions,j);normal.fromArray(normals,j).multiplyScalar(1/32767);
      const spill=windowSpill(point,normal);
      signLights[j]=Math.min(255,signLights[j]+Math.round(Math.sqrt(colors[j]*255)*spill));
      signLights[j+1]=Math.min(255,signLights[j+1]+Math.round(Math.sqrt(colors[j+1]*255)*spill*.65));
      signLights[j+2]=Math.min(255,signLights[j+2]+Math.round(Math.sqrt(colors[j+2]*255)*spill*.36));
    }
    if(roadExposure){
      const source=geometry.getAttribute('roadExposure');
      if(source)roadExposure.set(source.array,vertex);
      else if(mesh.userData.roadExposure)for(let i=0;i<pos.count;i++){
        // Quantized world normals identify the wearing face even on graded boxes.
        if(normals[base+3*i+1]>24000)roadExposure[vertex+i]=mesh.userData.roadExposure;
      }
    }
    const sourceIndices=geometry.index?.array;
    if(sourceIndices){
      for(let i=0;i<sourceIndices.length;i++)indices[face++]=vertex+sourceIndices[i];
    }else{
      for(let i=0;i<pos.count;i++)indices[face++]=vertex+i;
    }
    vertex += pos.count;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(positions,3));
  geo.setAttribute('normal',new THREE.BufferAttribute(normals,3,true));
  geo.setAttribute('color',new THREE.BufferAttribute(colors,3,true));
  if(facadeGrid)geo.setAttribute('facadeGrid',new THREE.BufferAttribute(facadeGrid,4));
  if(printUv)geo.setAttribute('uv',new THREE.BufferAttribute(printUv,2));
  if(roadExposure)geo.setAttribute('roadExposure',new THREE.BufferAttribute(roadExposure,1));
  if(walkPanel)geo.setAttribute('walkPanel',new THREE.BufferAttribute(walkPanel,2));
  if(signLights)geo.setAttribute('signLight',new THREE.BufferAttribute(signLights,3,true));
  geo.setIndex(new THREE.BufferAttribute(indices,1));
  boundPackedGeometry(geo,positions);
  registerTidalRuns(geo,parts);
  const chunk = new THREE.Mesh(geo,material);
  chunk.name = name;
  chunk.castShadow = chunk.receiveShadow = true;
  return chunk;
}

/** Retire the construction meshes after their final bake. Compact each sibling
 * array once, preserving the order and identity of the surviving objects. */
export function retireBakedMeshes(parts:readonly THREE.Mesh[]){
  // Three's EventDispatcher creates _listeners on first subscription. When
  // observed, use native removals so callbacks see each intermediate hierarchy.
  if(parts.some(p=>'_listeners' in p||'_listeners' in p.geometry||(p.parent&&'_listeners' in p.parent))){
    for(const part of parts){part.removeFromParent();part.geometry.dispose();}
    return;
  }
  const parents=new Set<THREE.Object3D>();
  for(const part of parts){
    if(part.parent){parents.add(part.parent);part.parent=null;}
    part.geometry.dispose();
  }
  for(const parent of parents){
    const children=parent.children;let kept=0;
    for(const child of children)if(child.parent===parent)children[kept++]=child;
    children.length=kept;
  }
}

/** Finished block meshes have fixed local transforms. The emptied authoring
 * groups keep their names, hierarchy and coordinate spaces for lookup. */
export function freezeBakedArchitecture(root:THREE.Object3D,chunks:THREE.Mesh[],moving:ReadonlySet<THREE.Object3D>){
  root.updateMatrixWorld(true);
  for(const chunk of chunks)chunk.matrixAutoUpdate=false;

  // Only ordinary groups or bare transform nodes containing more of the same
  // can be skipped. A light, bone, LOD, camera, drawable or animation root
  // makes its ancestor chain live regardless of its current visibility.
  const empty=new Set<THREE.Object3D>();
  function findEmpty(node:THREE.Object3D){
    if(moving.has(node))return;
    for(const child of node.children)findEmpty(child);
    if(node!==root&&(node.constructor===THREE.Group||node.constructor===THREE.Object3D)
      &&node.children.every(child=>empty.has(child)))empty.add(node);
  }
  findEmpty(root);
  for(const branch of empty){
    if(!branch.parent||empty.has(branch.parent))continue;
    branch.visible=false;
    const parentWorld=branch.parent.matrixWorld.clone();
    // Three passes force=true down the entire graph even when the scene's
    // recomposed transform is unchanged. Refresh the baked reference branch
    // only when it actually inherits a different world transform. Explicit
    // localToWorld/getWorldPosition still update their ancestry normally.
    branch.updateMatrixWorld=function(){
      const parent=this.parent;
      if(!this.visible&&parent&&parentWorld.equals(parent.matrixWorld))return;
      if(parent)parentWorld.copy(parent.matrixWorld);
      THREE.Object3D.prototype.updateMatrixWorld.call(this,true);
    };
  }
}
