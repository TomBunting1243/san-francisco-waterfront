import * as THREE from 'three';

type PaintedMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;

/** Bake rigid buildings once. Keep indexed source faces and pack only the attributes used by the city material. */
export function bakeBlocks(meshes: PaintedMesh[], material: THREE.MeshStandardMaterial) {
  const blocks = new Map<string, PaintedMesh[]>();
  const point = new THREE.Vector3(), normal = new THREE.Vector3(), normalMatrix = new THREE.Matrix3();
  for (const mesh of meshes) {
    const geo = mesh.geometry;
    if (!geo.boundingBox) geo.computeBoundingBox();
    geo.boundingBox!.getCenter(point).applyMatrix4(mesh.matrixWorld);
    const key = Math.floor(point.x / 24) + ',' + Math.floor(point.z / 24);
    if (!blocks.has(key)) blocks.set(key, []);
    blocks.get(key)!.push(mesh);
  }
  const chunks: THREE.Mesh[] = [];
  for (const [key, parts] of blocks) {
    let vertices = 0, faces = 0;
    for (const {geometry} of parts) {
      vertices += geometry.attributes.position.count;
      faces += geometry.index?.count ?? geometry.attributes.position.count;
    }
    const positions = new Float32Array(vertices * 3);
    const normals = new Int16Array(vertices * 3);
    const colors = new Uint8Array(vertices * 3);
    const indices = vertices > 65535 ? new Uint32Array(faces) : new Uint16Array(faces);
    let vertex = 0, face = 0;
    for (const mesh of parts) {
      const geometry = mesh.geometry, pos = geometry.attributes.position, n = geometry.attributes.normal;
      const {r,g,b} = mesh.material.color;
      const red = Math.round(255*r), green = Math.round(255*g), blue = Math.round(255*b);
      normalMatrix.getNormalMatrix(mesh.matrixWorld);
      for (let i = 0; i < pos.count; i++) {
        const j = (vertex+i)*3;
        point.fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld).toArray(positions,j);
        normal.fromBufferAttribute(n,i).applyNormalMatrix(normalMatrix);
        normals[j] = Math.round(normal.x*32767); normals[j+1] = Math.round(normal.y*32767); normals[j+2] = Math.round(normal.z*32767);
        colors[j] = red; colors[j+1] = green; colors[j+2] = blue;
      }
      const count = geometry.index?.count ?? pos.count;
      for (let i = 0; i < count; i++) indices[face++] = vertex + (geometry.index?.getX(i) ?? i);
      vertex += pos.count;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.BufferAttribute(positions,3));
    geo.setAttribute('normal',new THREE.BufferAttribute(normals,3,true));
    geo.setAttribute('color',new THREE.BufferAttribute(colors,3,true));
    geo.setIndex(new THREE.BufferAttribute(indices,1));
    geo.computeBoundingBox(); geo.computeBoundingSphere();
    const chunk = new THREE.Mesh(geo,material);
    chunk.name = 'City block ' + key;
    chunk.castShadow = chunk.receiveShadow = true;
    chunks.push(chunk);
  }
  return chunks;
}
