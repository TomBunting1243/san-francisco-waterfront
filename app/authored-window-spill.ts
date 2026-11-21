import * as THREE from 'three';

// A diffuse rectangular opening in facade-local axes (+Z points outdoors).
// All lengths use the building modeller's scene units. Sampling only trims
// belonging to this opening prevents leakage to a neighboring or rear room.
export function openingIrradiance(x:number,y:number,z:number,w:number,h:number,
  px:number,py:number,pz:number,nx:number,ny:number,nz:number){
  const depth=pz-z;
  if(depth<-.001||depth>.14)return 0;
  const dx=x-px,dy=y-py;
  const edgeX=Math.max(0,Math.abs(dx)-w/2),edgeY=Math.max(0,Math.abs(dy)-h/2);
  const d2=edgeX*edgeX+edgeY*edgeY+depth*depth;
  if(d2>.0225)return 0;
  // A projecting sill sees the middle of the pane; face-on stone catches
  // a weaker diffuse return from the projecting sash and sill.
  const distance=Math.hypot(dx,dy,depth)||1;
  const facing=Math.max(0,(dx*nx+dy*ny-depth*nz)/distance);
  return (1-d2/.0225)**2*(.88*facing+.22*Math.max(0,nz));
}

export function lightOpeningTrim(frame:THREE.Object3D,receivers:THREE.Object3D[],
  x:number,y:number,z:number,w:number,h:number,level:number){
  // Frame and receiver positions can still be parented or rotated by the
  // caller. Resolve the final transform on first sample in the rigid bake.
  let inverse:THREE.Matrix4|undefined;
  const p=new THREE.Vector3(),n=new THREE.Vector3();
  const sample=(point:THREE.Vector3,normal:THREE.Vector3)=>{
    inverse??=frame.matrixWorld.clone().invert();
    p.copy(point).applyMatrix4(inverse);n.copy(normal).transformDirection(inverse);
    return level*openingIrradiance(x,y,z,w,h,p.x,p.y,p.z,n.x,n.y,n.z);
  };
  for(const receiver of receivers)if(receiver instanceof THREE.Mesh)receiver.userData.authoredWindowSpill=sample;
}
