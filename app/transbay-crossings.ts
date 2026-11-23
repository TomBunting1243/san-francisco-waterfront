import * as THREE from 'three';
import survey from '../public/data/transbay-crossings.json' with {type:'json'};

type Surface=(g:THREE.BufferGeometry,color:string,x:number,y:number,z:number)=>THREE.Mesh;
export const transbayCrossings=survey.sites;

/** Survey paint rests four millimetres above the underlying asphalt or gutter. */
export function addTransbayCrossings(mesh:Surface){
  for(const site of transbayCrossings){
    const points:number[]=[];
    for(const leg of site.legs)for(const mark of leg.marks)for(const triangle of mark){
      const [a,b,c]=triangle;
      const up=(b[1]-a[1])*(c[0]-a[0])-(b[0]-a[0])*(c[1]-a[1]);
      for(const [x,z,y] of up>0?[a,b,c]:[a,c,b])points.push(x,y,z);
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
    g.computeVertexNormals();
    const mark=mesh(g,'#dedbd0',0,0,0);mark.userData.roadExposure=1;mark.name='Crosswalk paint · '+site.name;
  }
}
