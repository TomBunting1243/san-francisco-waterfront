import * as THREE from 'three';
import ink from '../public/data/howard-beale-through.json' with {type:'json'};
import {pavementCutter} from './pavement-openings.ts';
import {setPackedNormals} from './packed-normals.ts';

type Point=[number,number];
type Vertex=[number,number,number];
type Tile={quad:(a:Vertex,b:Vertex,c:Vertex,d:Vertex,color:string)=>void;roadClass:number};
type Surface=(geometry:THREE.BufferGeometry,color:string,x:number,y:number,z:number)=>THREE.Mesh;
const pigment:Record<string,string>={white:'#dedbd0',green:'#749580',yellow:'#ddbd64'};

// SF 2024 8 cm orthophoto, in the same rectified frame as Fremont.
export function howardBealePlate(u:number,v:number):Point{
  return [-27.00800104+.0012973094*u-.0084729829*v,-33.37263659+.0084728164*u+.0012965840*v];
}
// North sidewalk between the Beale and Main corner returns. Its streetward seam
// follows the existing DPW curb 3817469, including its 0.031-unit shoulder.
const walk=[howardBealePlate(1006,142.39),howardBealePlate(1560,139.52),
  [-26.420+.031*.989,-19.935-.031*.15],[-27.133+.031*.989,-24.634-.031*.15]];
const xs=walk.map(p=>p[0]),zs=walk.map(p=>p[1]);
export const cutHowardBealeWalk=pavementCutter([{outline:walk,xmin:Math.min(...xs),xmax:Math.max(...xs),zmin:Math.min(...zs),zmax:Math.max(...zs)}]);
export function addHowardBealeWalk(tile:Tile){
  const panel=(a:number,b:number,t:number):Vertex=>[THREE.MathUtils.lerp(walk[a][0],walk[b][0],t),.0451,THREE.MathUtils.lerp(walk[a][1],walk[b][1],t)];
  const exposure=tile.roadClass;tile.roadClass=1;
  for(let i=0;i<24;i++){
    const t=i/24,s=(i+1)/24;
    tile.quad(panel(0,1,t),panel(3,2,t),panel(3,2,s),panel(0,1,s),['#c3beaf','#c4bfb0','#c2bdae'][i%3]);
  }
  tile.roadClass=exposure;
}
export function addHowardBealeThroughPaint(mesh:Surface){
  for(const {ink:color,uv,indices} of ink){
    const g=new THREE.BufferGeometry();
    const vertices=uv.flatMap(([u,v])=>{const [x,z]=howardBealePlate(u,v);return [x,.03124,z]});
    g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    g.setIndex(indices);setPackedNormals(g);g.userData.roadPaint='SoMa approaches';
    const patch=mesh(g,pigment[color],0,0,0);
    patch.userData.roadExposure=1;patch.name='Howard, Beale to Main · '+color;
  }
}
