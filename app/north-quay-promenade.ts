import {northWaterfrontGrade} from './north-quay-grade.ts';
import survey from '../public/data/sightline-streets.json' with {type:'json'};

// Bay-side edge of SFMTA curb 3851628 and the two DataSF street walls.
export function pier2931Walk(x:number){
  const edge=survey.pierWalkEdge;
  if(x<edge[0][0]||x>edge[edge.length-1][0])return;
  const next=edge.findIndex((p,i)=>i>0&&p[0]>=x);
  const [a,z]=edge[next-1],[b,w]=edge[next];
  const curbZ=z+(w-z)*(x-a)/(b-a);
  const wallZ=x<83.62?-2.19-.476*(x-80.97)/(83.62-80.97):-2.77-1.59*(x-83.62)/(91.94-83.62);
  return {curbZ,wallZ,y:northWaterfrontGrade(x)+.018};
}
