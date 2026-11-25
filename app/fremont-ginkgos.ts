import sites from '../public/data/fremont-ginkgos.json' with {type:'json'};
import paving from '../public/data/fremont-approach-curbs.json' with {type:'json'};
import {waterfrontTree} from './waterfront-trees.ts';

// SF Public Works tkzw-k3nq, 253 Fremont sites 1–7. Each inventory center
// falls on a separate 2024 aerial crown outside the 215 Fremont street wall.
// [tree ID, x, z, DBH in inches, plot width in feet, fitted tree height in m]
// Heights use the local 2023 lidar p90 above ground. Site 1 has seven returns.
export function addFremontGinkgos(mesh:Parameters<typeof waterfrontTree>[0],month?:number){
  return sites.map(([id,x,z,dbh,,height],i)=>{
    const y=paving.ginkgoGrades[i];
    // Ginkgo scaffold tapers to 72% of basal radius at its .34-height fork.
    // On the two smallest trees the breast-height plane crosses the leader.
    const breast=4.5*.3048/height;
    const ratio=breast<=.34?1-.28*breast/.34:.70-(.70-.035)*(breast-.34)/(.98-.34);
    // The photographs show narrow young crowns. Reduce scaffold and foliage
    // together; compensate the input stem radius to preserve inventory DBH.
    const breadth=.62,radius=dbh*.0254*.03/(ratio*breadth);
    waterfrontTree((g,color,px,py,pz)=>{
      const part=mesh(g,color,px,py,pz);
      part.scale.set(breadth,1,breadth);
      return part;
    },x,y,z,id,height*.06,'Ginkgo biloba',month,radius);
    return {id,x,y,z};
  });
}
