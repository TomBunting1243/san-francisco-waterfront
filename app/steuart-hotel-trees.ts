import type * as THREE from 'three';
import {setPackedNormals} from './packed-normals.ts';
import {placedTreeWell} from './tree-wells.ts';
import {waterfrontTree} from './waterfront-trees.ts';

const metres=.06,grade=.045;
type Site=readonly [id:number,u:number,v:number,dbh:number,low:number,high:number,crown:readonly number[]];
// Public Works tkzw-k3nq, 155 Steuart, sites 1 and 2. Positions from the
// municipal coordinates. Crown bounds are the 2023 scan, in metres and in
// curb axes (towards Mission, towards Howard, towards wall, towards street).
// The southern crown's inward reach is shortened 14 cm at the escape.
const sites:Site[]=[
  [191655,3248.52976,-472.33108,11,3.95,9.74,[3.23,3.19,1.31,2.97]],
  [191656,3243.33308,-535.93438,12,4.32,11.35,[2.48,3.81,2.31,3.43]],
];
const plate=(u:number,v:number)=>[-27.00800104+.0012973094*u-.0084729829*v,-33.37263659+.0084728164*u+.0012965840*v];
const cosine=.9885,sine=.1513;
type Factory=Parameters<typeof waterfrontTree>[0];
/** Fit the same evergreen scaffold and foliage together. The basal trunk
 * keeps its inventory diameter, while the street-facing crown can overhang
 * the curb independently of the shorter, wall-facing boughs. */
function fitCrown(parts:THREE.Mesh[],[,,,,low,high,radii]:Site){
  const leaf=parts.find(p=>p.userData.plantCrown)!;
  const pos=leaf.geometry.getAttribute('position');
  let minY=Infinity,maxY=0;
  const bounds=[0,0,0,0];
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
    const along=-cosine*x+sine*z,out=-sine*x-cosine*z;
    minY=Math.min(minY,y);maxY=Math.max(maxY,y);
    bounds[0]=Math.max(bounds[0],-along);bounds[1]=Math.max(bounds[1],along);
    bounds[2]=Math.max(bounds[2],-out);bounds[3]=Math.max(bounds[3],out);
  }
  const basalHeight=2*metres;
  for(const part of parts){
    const p=part.geometry.getAttribute('position');
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
      if(y<basalHeight)continue;
      const along=-cosine*x+sine*z,out=-sine*x-cosine*z;
      const a=along<0?0:1,b=out<0?2:3;
      const t=Math.min(1,(y-basalHeight)/.08);
      const s=along*(1+t*(radii[a]*metres/bounds[a]-1)),d=out*(1+t*(radii[b]*metres/bounds[b]-1));
      const h=y<=minY?basalHeight+(y-basalHeight)*(low*metres-basalHeight)/(minY-basalHeight):low*metres+(y-minY)*(high-low)*metres/(maxY-minY);
      p.setXYZ(i,-cosine*s-sine*d,h,sine*s-cosine*d);
    }
    p.needsUpdate=true;setPackedNormals(part.geometry);
  }
}
export function addSteuartHotelTrees(mesh:Factory){
  return sites.map(site=>{
    const [id,u,v,dbh,,height]=site,[x,z]=plate(u,v);
    // The inventory gives width only. The 3-foot square follows the shared
    // cutout convention; the soil is flush with the registered sidewalk.
    const well=placedTreeWell(mesh,id,x,grade,z,Math.atan2(sine,cosine),['cutout',3,3]);
    const y=well.position.y,parts:THREE.Mesh[]=[];
    // The shared broadleaf trunk narrows to 72% at its first fork (32% of
    // tree height). Register the inventory diameter at 4.5 ft above ground.
    const breastRadius=dbh*.0254*metres/2;
    const baseRadius=breastRadius/(1-.28*(4.5*.3048)/(.32*height));
    waterfrontTree((g,c,px,py,pz)=>{const p=mesh(g,c,px,py,pz);parts.push(p);return p;},
      x,y,z,id,height*metres,'Lophostemon confertus',undefined,baseRadius,true);
    fitCrown(parts,site);return {id,x,y,z};
  });
}
