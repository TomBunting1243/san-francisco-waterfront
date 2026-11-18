import * as THREE from 'three';

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

/** Bake rigid buildings once. Keep indexed source faces and pack only the attributes used by the city material. */
export function bakeBlocks(meshes: PaintedMesh[], material: THREE.MeshStandardMaterial):THREE.Mesh[] {
  const blocks = new Map<string, Tile>();
  const point = new THREE.Vector3();
  const worldBounds=new THREE.Box3();
  for (const mesh of meshes) {
    const geo = mesh.geometry;
    if (!geo.boundingBox) geo.computeBoundingBox();
    geo.boundingBox!.getCenter(point).applyMatrix4(mesh.matrixWorld);
    const x=Math.floor(point.x/blockWidth),z=Math.floor(point.z/blockWidth),key=x+','+z;
    let tile=blocks.get(key);
    if(!tile){tile={x,z,parts:[],bounds:new THREE.Box3(),triangles:0};blocks.set(key,tile);}
    tile.parts.push(mesh);
    tile.bounds.union(worldBounds.copy(geo.boundingBox!).applyMatrix4(mesh.matrixWorld));
    tile.triangles+=(geo.index?.count??geo.attributes.position.count)/3;
  }
  return Array.from(coalesceSparseTiles(blocks),([key,parts])=>bakeRigidChunk('City block '+key,parts,material));
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
  const signLights = parts.some(mesh=>mesh.userData.signLight) ? new Uint8Array(vertices * 3) : null;
  const indices = vertices > 65535 ? new Uint32Array(faces) : new Uint16Array(faces);
  const facadeGrid=parts[0].geometry.hasAttribute('facadeGrid')?new Float32Array(vertices*4):null;
  const printUv=parts[0].geometry.hasAttribute('billboardPrint')?new Float32Array(vertices*2):null;
  const walkPanel=parts[0].geometry.hasAttribute('walkPanel')?new Float32Array(vertices*2):null;
  let vertex = 0, face = 0;
  for (const mesh of parts) {
    const geometry = mesh.geometry, pos = geometry.attributes.position, n = geometry.attributes.normal;
    if(printUv)printUv.set(geometry.getAttribute('billboardPrint').array,vertex*2);
    if(walkPanel)walkPanel.set(geometry.getAttribute('walkPanel').array,vertex*2);
    if(facadeGrid)facadeGrid.set(geometry.getAttribute('facadeGrid').array,vertex*4);
    const {r,g,b} = mesh.material.color;
    const paint = mesh.material.vertexColors || geometry.userData.paintVertices ? geometry.attributes.color : undefined;
    const light = mesh.userData.signLight as [number,number,number]|undefined;
    if (signLights && light) {
      const [r,g,b]=light.map(value=>Math.round(value*255));
      for (let j=vertex*3; j<(vertex+pos.count)*3; j+=3) {
        signLights[j]=r;signLights[j+1]=g;signLights[j+2]=b;
      }
    }
    const red = Math.round(255*r), green = Math.round(255*g), blue = Math.round(255*b);
    normalMatrix.getNormalMatrix(mesh.matrixWorld);
    for (let i = 0; i < pos.count; i++) {
      const j = (vertex+i)*3;
      point.fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld);
      positions[j] = point.x; positions[j+1] = point.y; positions[j+2] = point.z;
      normal.fromBufferAttribute(n,i).applyNormalMatrix(normalMatrix);
      normals[j] = Math.round(normal.x*32767); normals[j+1] = Math.round(normal.y*32767); normals[j+2] = Math.round(normal.z*32767);
      if (paint) {
        colors[j] = Math.round(255*r*paint.getX(i));
        colors[j+1] = Math.round(255*g*paint.getY(i));
        colors[j+2] = Math.round(255*b*paint.getZ(i));
      } else {
        colors[j] = red; colors[j+1] = green; colors[j+2] = blue;
      }
    }
    const count = geometry.index?.count ?? pos.count;
    for (let i = 0; i < count; i++) indices[face++] = vertex + (geometry.index?.getX(i) ?? i);
    vertex += pos.count;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(positions,3));
  geo.setAttribute('normal',new THREE.BufferAttribute(normals,3,true));
  geo.setAttribute('color',new THREE.BufferAttribute(colors,3,true));
  if(facadeGrid)geo.setAttribute('facadeGrid',new THREE.BufferAttribute(facadeGrid,4));
  if(printUv)geo.setAttribute('uv',new THREE.BufferAttribute(printUv,2));
  if(walkPanel)geo.setAttribute('walkPanel',new THREE.BufferAttribute(walkPanel,2));
  if(signLights)geo.setAttribute('signLight',new THREE.BufferAttribute(signLights,3,true));
  geo.setIndex(new THREE.BufferAttribute(indices,1));
  geo.computeBoundingBox(); geo.computeBoundingSphere();
  const chunk = new THREE.Mesh(geo,material);
  chunk.name = name;
  chunk.castShadow = chunk.receiveShadow = true;
  return chunk;
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
