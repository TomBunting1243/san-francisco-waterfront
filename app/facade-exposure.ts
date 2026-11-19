import {Vector3, type Group} from 'three';
import {insideBuilding} from './building-character.ts';

type Volume={p:number[][];minH?:number;h:number};

/** Each floor samples the same horizontal positions. Resolve footprint overlap
 * once per column, then test the heights of just the overlapping neighbors. */
export function facadeExposure<T extends Volume>(face:Group, footprint:number[][], peers:T[],
  depths:number[], blocksAt:(peer:T,y:number)=>boolean){
  const columns=new Map<number,T[]|null>();
  const point=new Vector3();
  function column(x:number){
    const overlaps=new Set<T>();
    for(const depth of depths){
      point.set(x,0,depth).applyMatrix4(face.matrixWorld);
      if(insideBuilding(point.x,point.z,footprint))return null;
      for(const peer of peers){
        if(insideBuilding(point.x,point.z,peer.p))overlaps.add(peer);
      }
    }
    return [...overlaps];
  }
  return (x:number,y:number)=>{
    let overlaps=columns.get(x);
    if(overlaps===undefined){
      overlaps=column(x);
      columns.set(x,overlaps);
    }
    return overlaps!==null&&!overlaps.some(peer=>blocksAt(peer,y));
  };
}
