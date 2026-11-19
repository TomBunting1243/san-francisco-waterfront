import * as THREE from 'three';

type Anchor=[x:number,z:number];
type Attachment={fixed?:Anchor;floating?:Anchor};
type Run={start:number;restY:Float32Array;weight?:Float32Array};
const sourceMotion=new WeakMap<THREE.Object3D,Attachment>();
const bakedMotion=new WeakMap<THREE.BufferGeometry,Run[]>();
export const tideBoundsMargin=.20;

export function markTidalPart(part:THREE.Object3D,_district:string,fixed?:Anchor,floating?:Anchor){
  part.userData.tideAttachment={fixed,floating} satisfies Attachment;
}

export function collectTidalParts(scene:THREE.Object3D){
  function collect(node:THREE.Object3D,inherited?:Attachment){
    const motion:Attachment|undefined=node.userData.tideAttachment??inherited;
    if(motion&&node instanceof THREE.Mesh&&!(node instanceof THREE.InstancedMesh))sourceMotion.set(node,motion);
    for(const child of node.children)collect(child,motion);
  }
  collect(scene);
}

// Preserve the vertex order and batch boundaries of the existing city mesh.
// Only vertices attached to floating infrastructure retain a rest height.
export function registerTidalRuns(geometry:THREE.BufferGeometry,parts:readonly THREE.Mesh[]){
  if(!parts.some(part=>sourceMotion.has(part)))return;
  const positions=geometry.getAttribute('position'),runs:Run[]=[];
  let start=0;
  for(const part of parts){
    const count=part.geometry.attributes.position.count,motion=sourceMotion.get(part);
    if(motion){
      const restY=new Float32Array(count),{fixed,floating}=motion;
      let weight:Float32Array|undefined;
      if(fixed&&floating){
        const dx=floating[0]-fixed[0],dz=floating[1]-fixed[1],d=dx*dx+dz*dz;
        weight=new Float32Array(count);
        for(let i=0;i<count;i++){
          const t=((positions.getX(start+i)-fixed[0])*dx+(positions.getZ(start+i)-fixed[1])*dz)/d;
          weight[i]=THREE.MathUtils.clamp(t,0,1);
        }
      }
      for(let i=0;i<count;i++)restY[i]=positions.getY(start+i);
      runs.push({start,restY,weight});
    }
    start+=count;
  }
  bakedMotion.set(geometry,runs);geometry.userData.tideBoundsMargin=tideBoundsMargin;
  geometry.boundingBox!.min.y-=tideBoundsMargin;geometry.boundingBox!.max.y+=tideBoundsMargin;
  geometry.boundingSphere!.radius+=tideBoundsMargin;
}

export function cloneTidalGeometry(geometry:THREE.BufferGeometry){
  const runs=bakedMotion.get(geometry);
  if(!runs)return;
  const clone=geometry.clone();bakedMotion.set(clone,runs);return clone;
}

export function createTideUpdater(chunks:readonly THREE.Mesh[]){
  const batches=chunks.flatMap(mesh=>{
    const runs=bakedMotion.get(mesh.geometry);
    return runs?[{mesh,runs}]:[];
  });
  let previous=NaN;
  return (offset:number)=>{
    if(offset===previous)return;
    previous=offset;
    for(const {mesh,runs} of batches){
      const p=mesh.geometry.attributes.position as THREE.BufferAttribute;
      let first=Infinity,end=0;
      for(const {start,restY,weight} of runs){
        first=Math.min(first,start);end=Math.max(end,start+restY.length);
        for(let i=0;i<restY.length;i++)p.setY(start+i,restY[i]+offset*(weight?weight[i]:1));
      }
      p.clearUpdateRanges();p.addUpdateRange(first*3,(end-first)*3);p.needsUpdate=true;
    }
  };
}
