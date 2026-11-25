import {ShapeUtils,Vector2} from 'three';
import type {FacadePanels,FacadePoint} from './facade-panels.ts';

type GradePoint=[u:number,v:number,height:number];
// Registered Fremont/Howard plate, seven pixels per metre. Keep the garden
// and municipal sidewalk parcels 220/221 as separate owners. Each ring traces
// only the uncovered strip between them and the recessed shopfronts. Heights
// are metres above the building datum. The inner shop end meets its sill.
const south:GradePoint[][]=[[
  [-372.7873,487.35,.023],[-371.65044,311.13774,.023],[-371.65044,306.66099,0],
  [-389.46722,306.59090,0],[-392.69748,304.56202,0],[-392.76684,306.55778,0],
  [-395.47220,306.49763,0],[-395.49367,311,0],[-394,311,.02],[-394,466,.02],
  [-553,466,.02],[-553,318.90494,.02],[-553.39915,318.90411,0],
  [-554.34236,470.06414,0],[-561.30521,470.06025,0],[-561.42394,487.35,0],
  [-552,487.35,.023],
]];
const north:GradePoint[][]=[[
  [-551.28600,9.65,0],[-551.42849,31,0],[-394,31,.02],[-394,132,.02],
  [-372.65,132,.023],[-372.65,9.65,.023],[-542,9.65,.023],
],[
  [-372.65,132,.023],[-394,132,.02],[-394,133,.02],[-552.10920,133,.02],
  [-552.17438,142.76648,0],[-372.65,143.02141,0],
]];

export function addFoundryPlazaApron(f:FacadePanels,isSouth:boolean,
  point:(uv:[number,number],height:number)=>FacadePoint){
  for(const ring of isSouth?south:north){
    const uv=ring.map(([u,v])=>new Vector2(u,v));
    const positions=ring.map(([u,v,h])=>point([u,v],h));
    for(const [a,b,c] of ShapeUtils.triangulateShape(uv,[])){
      f.triangle(positions[a],positions[c],positions[b],'#97968d');
    }
  }
}
