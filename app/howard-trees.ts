import survey from '../public/data/howard-trees.json' with {type:'json'};
import {placedTreeWell} from './tree-wells.ts';
import {waterfrontTree} from './waterfront-trees.ts';

type Factory=Parameters<typeof waterfrontTree>[0];
type Tree=[number,number,number,number,number,number,number,boolean];
export const howardTrees=survey.trees as Tree[];

/** SF Public Works tree IDs, species, DBH and plot widths. The 2024 city
 * ortho and USGS 2023 lidar establish the curb line and row stature. */
export function addHowardTrees(mesh:Factory){
  const result=[];
  for(const [id,x,z,taxon,dbh,height,feet,pot] of howardTrees){
    const ground=.045,angle=Math.atan2(.150004,.988686);
    const site=placedTreeWell(mesh,id,x,ground,z,angle,[pot?'pot':'cutout',feet,feet]);
    const y=site.position.y+(pot?.80*site.scale.y:0);
    waterfrontTree(mesh,x,y,z,id,height*.06,survey.taxa[taxon],undefined,dbh*.0254*.03,true);
    result.push({id,x,y,z});
  }
  return result;
}
