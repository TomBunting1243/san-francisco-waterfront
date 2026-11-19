import * as THREE from 'three';

// Area-weighted triangle normals. Accumulating into Float32 at every face
// preserves the rounding of Three's BufferAttribute writes.
export function indexedNormals(xyz:Float32Array,index:ArrayLike<number>){
  const normals=new Float32Array(xyz.length);
  for(let i=0;i<index.length;i+=3){
    const a=index[i]*3,b=index[i+1]*3,c=index[i+2]*3;
    const cx=xyz[c]-xyz[b],cy=xyz[c+1]-xyz[b+1],cz=xyz[c+2]-xyz[b+2];
    const ax=xyz[a]-xyz[b],ay=xyz[a+1]-xyz[b+1],az=xyz[a+2]-xyz[b+2];
    const nx=cy*az-cz*ay,ny=cz*ax-cx*az,nz=cx*ay-cy*ax;
    normals[a]+=nx;normals[a+1]+=ny;normals[a+2]+=nz;
    normals[b]+=nx;normals[b+1]+=ny;normals[b+2]+=nz;
    normals[c]+=nx;normals[c+1]+=ny;normals[c+2]+=nz;
  }
  for(let i=0;i<normals.length;i+=3){
    const x=normals[i],y=normals[i+1],z=normals[i+2];
    const inv=1/(Math.sqrt(x*x+y*y+z*z)||1);
    normals[i]=x*inv;normals[i+1]=y*inv;normals[i+2]=z*inv;
  }
  return normals;
}

// In triangle soup all three corners have the same normal. Three stores
// the raw cross product as Float32 before normalizing it.
function flatNormals(xyz:Float32Array){
  const normals=new Float32Array(xyz.length);
  for(let a=0;a<xyz.length;a+=9){
    const b=a+3,c=a+6;
    const cx=xyz[c]-xyz[b],cy=xyz[c+1]-xyz[b+1],cz=xyz[c+2]-xyz[b+2];
    const ax=xyz[a]-xyz[b],ay=xyz[a+1]-xyz[b+1],az=xyz[a+2]-xyz[b+2];
    const x=Math.fround(cy*az-cz*ay),y=Math.fround(cz*ax-cx*az),z=Math.fround(cx*ay-cy*ax);
    const inv=1/(Math.sqrt(x*x+y*y+z*z)||1);
    normals[a]=normals[b]=normals[c]=x*inv;
    normals[a+1]=normals[b+1]=normals[c+1]=y*inv;
    normals[a+2]=normals[b+2]=normals[c+2]=z*inv;
  }
  return normals;
}

// Used only on freshly generated geometry with packed Float32 xyz triangles.
export function setPackedNormals(geometry:THREE.BufferGeometry){
  const xyz=geometry.getAttribute('position').array as Float32Array;
  const normals=geometry.index?indexedNormals(xyz,geometry.index.array):flatNormals(xyz);
  const attribute=new THREE.BufferAttribute(normals,3);
  attribute.needsUpdate=true;
  geometry.setAttribute('normal',attribute);
}
