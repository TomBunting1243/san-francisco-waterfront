import * as THREE from 'three';

// The fixture and its ground footprint share the same transform. Small,
// shielded lenses do not acquire the boulevard's separate floating halo.
export type FerryWalkPool={x:number;y:number;z:number;radius:number;strength:number};

export function ferryWalkLens(mesh:THREE.Mesh,name:string,radius:number,strength:number,warm=false){
  mesh.name=name;
  mesh.userData.signLight=warm?[.98,.75,.42]:[.90,.88,.76];
  mesh.userData.ferryWalkPool={radius,strength};
}

export function collectFerryWalkPools(root:THREE.Object3D){
  const out:FerryWalkPool[]=[],at=new THREE.Vector3();
  root.traverse(node=>{
    const pool=node.userData.ferryWalkPool;
    if(!pool)return;
    node.getWorldPosition(at);
    out.push({x:at.x,y:at.y,z:at.z,radius:pool.radius,strength:pool.strength});
  });
  return out;
}
