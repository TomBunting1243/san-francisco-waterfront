import * as THREE from 'three';
import survey from '../public/data/frost-trees.json' with {type:'json'};
import {waterfrontTree} from './waterfront-trees.ts';

const envelopes:Record<string,{boundsM:number[]}>=survey;
type Factory=Parameters<typeof waterfrontTree>[0];

/** Fit the existing seasonal tree and connected branches to its 2023–24 survey envelope.
 * Heights are the 5th/98th percentiles above local ground. Shared crowns on the
 * Market approach are split at the nearest inventoried trunk. */
export function addSurveyedFrostTree(mesh:Factory,x:number,y:number,z:number,id:number,species:string,radius?:number,month?:number){
  const record=envelopes[id];
  if(!record)return false;
  const [left,right,back,front,low,high]=record.boundsM.map(m=>m*.06);
  const parts:THREE.Mesh[]=[];
  waterfrontTree((g,c,px,py,pz)=>{
    const part=mesh(g,c,px,py,pz);parts.push(part);return part;
  },x,y,z,id,high,species,month,radius);
  const crown=parts.find(part=>part.userData.plantCrown);
  const reference=(crown??parts[0]).geometry;
  reference.computeBoundingBox();
  const box=reference.boundingBox!,size=box.getSize(new THREE.Vector3());
  const sx=(right-left)/size.x,sz=(front-back)/size.z;
  const tx=left-box.min.x*sx,tz=back-box.min.z*sz;
  // In winter the deciduous model supplies only a bare scaffold. Use its full
  // span, keep the trunk planted and leave all its seasonal twig geometry intact.
  const bottom=crown?box.min.y:0,targetLow=crown?low:0;
  const sy=(high-targetLow)/(box.max.y-bottom),ty=targetLow-bottom*sy;
  for(const part of parts){
    const g=part.geometry;
    if(part===crown){
      const transform=new THREE.Matrix4().makeScale(sx,sy,sz).setPosition(tx,ty,tz);
      g.applyMatrix4(transform);
    }else{
      const pos=g.attributes.position;
      for(let i=0;i<pos.count;i++){
        const h=pos.getY(i),blend=THREE.MathUtils.smoothstep(h,0,bottom||high*.35);
        pos.setXYZ(i,THREE.MathUtils.lerp(pos.getX(i),pos.getX(i)*sx+tx,blend),
          bottom>0&&h<bottom?h*targetLow/bottom:h*sy+ty,
          THREE.MathUtils.lerp(pos.getZ(i),pos.getZ(i)*sz+tz,blend));
      }
      g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
    }
    part.userData.frostTree=id;
  }
  return true;
}
