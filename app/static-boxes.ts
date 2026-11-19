import {BoxGeometry, type BufferGeometry, type Mesh, type Object3D} from 'three';

/** Static architecture is baked after world transforms are applied. One unit
 * cube supplies the positions, indices, normals and UVs for the entire builder. */
export function staticBoxes<P extends Object3D>(mesh:(geometry:BufferGeometry,color:string,x:number,y:number,z:number,parent:P)=>Mesh,root:P){
  const cube=new BoxGeometry();
  return (w:number,h:number,d:number,x:number,y:number,z:number,color:string,parent:P=root)=>{
    const object=mesh(cube,color,x,y,z,parent);
    // Match the Float32 dimensions of a separately constructed BoxGeometry.
    object.scale.set(Math.fround(w),Math.fround(h),Math.fround(d));
    return object;
  };
}
