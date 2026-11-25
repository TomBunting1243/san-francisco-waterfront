import {placedTreeWell} from './tree-wells.ts';
import {waterfrontTree} from './waterfront-trees.ts';

// Public Works tkzw-k3nq, 250 Fremont, site order 1–10. The inventory calls
// every site a 4-foot curbside cutout. Height estimates are local 2023 lidar
// upper return percentiles above ground; DBH is the inventory measurement.
// [tree ID, scene x, scene z, DBH inches, crown height metres]
const trees=[
  [190300,-30.134442,-32.474518,9,9.5],
  [190301,-30.435415,-32.446671,10,10.6],
  [190302,-30.707268,-32.404204,9,9.9],
  [190303,-30.979121,-32.361736,10,9.5],
  [190304,-31.280249,-32.300914,10,8.7],
  [190305,-32.3496,-32.143346,10,8.9],
  [190306,-32.604844,-32.088679,10,9.4],
  [190307,-32.918267,-32.057193,11,9.8],
  [190308,-33.223805,-32.025179,9,9.6],
  [190309,-33.463988,-31.979753,10,8.6],
] as const;
export function addFoundryTrees(mesh:Parameters<typeof waterfrontTree>[0]){
  const angle=Math.atan2(.1513,.9885);
  return trees.map(([id,x,z,dbh,height])=>{
    const site=placedTreeWell(mesh,id,x,.045,z,angle,['cutout',4,4]);
    const y=site.position.y;
    waterfrontTree(mesh,x,y,z,id,height*.06,'Ficus microcarpa nitida',undefined,dbh*.0254*.03,true);
    return {id,x,y,z};
  });
}
