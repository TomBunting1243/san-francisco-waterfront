import {BufferGeometry,Color,Float32BufferAttribute} from 'three';
import type {Mesh} from 'three';
import paint from '../public/data/mission-market-bikeway.json' with {type:'json'};
import {setPackedNormals} from './packed-normals.ts';

type Surface=(geometry:BufferGeometry,color:string,x:number,y:number,z:number)=>Mesh;
const grade=.031,plate=132;
const inks={green:'#91a480',yellow:'#cbba83',white:'#e1decd'};
function ground(u:number,v:number,y:number){return [-56+u/plate,y,2-v/plate];}

// SF 2024 aerial: floating loading and open hatched aisles, not the
// concrete plinths south of Mission. Paired retroreflective bands and broad
// white bases follow SFMTA's Mission Street field photo, presentation p.7.
// https://ccsf.granicus.com/MetaViewer.php?clip_id=2105&meta_id=55037&view_id=2
export function addMissionMarketBikeway(mesh:Surface){
  const positions:number[]=[],colors:number[]=[],indices:number[]=[];
  function finish(name:string,roadPaint:boolean){
    const g=new BufferGeometry();
    g.setAttribute('position',new Float32BufferAttribute(positions,3));
    g.setAttribute('color',new Float32BufferAttribute(colors,3));g.setIndex(indices.slice());setPackedNormals(g);
    g.userData.paintVertices=true;
    if(roadPaint)g.userData.roadPaint='Waterfront crossings';
    const m=mesh(g,'#ffffff',0,0,0);m.name=name;m.userData.roadExposure=1;
    positions.length=0;colors.length=0;indices.length=0;
  }
  for(const key of ['green','yellow','white'] as const){
    const local=new Map<number,number>(),tint=new Color(inks[key]);
    for(const id of paint.faces[key]){
      let index=local.get(id);
      if(index===undefined){
        index=positions.length/3;local.set(id,index);
        const [u,v]=paint.vertices[id];positions.push(...ground(u,v,.03124));
        colors.push(tint.r,tint.g,tint.b);
      }
      indices.push(index);
    }
  }
  finish('Mission to Market bikeway and floating loading paint',true);
  // Post height and ring sizes are photographic estimates. Segmented shells
  // put both reflector bands on the actual shaft (no decals or point lights).
  const body=new Color('#c8c9bd'),reflector=new Color('#edeedc'),foot=new Color('#b8b9ad');
  const rings:[number,number,Color][]=[[0,.124,foot],[.028,.124,foot],[.074,.061,body],
    [.575,.049,body],[.633,.049,reflector],[.725,.049,body],[.785,.049,reflector],[.868,.047,body]];
  const sides=6;
  for(const [u,v] of paint.posts){
    const [x,,z]=ground(u,v,grade);
    for(let j=1;j<rings.length;j++){
      const [lo,a]=rings[j-1],[hi,b,pigment]=rings[j],start=positions.length/3;
      for(const [h,r] of [[lo,a],[hi,b]]){
        for(let k=0;k<sides;k++){
          const angle=k*2*Math.PI/sides;
          positions.push(x+.06*r*Math.cos(angle),grade+.06*h,z+.06*r*Math.sin(angle));
          colors.push(pigment.r,pigment.g,pigment.b);
        }
      }
      for(let k=0;k<sides;k++){
        const n=(k+1)%sides;
        indices.push(start+k,start+sides+k,start+n,start+n,start+sides+k,start+sides+n);
      }
      if(j===rings.length-1){
        for(let k=1;k<sides-1;k++)indices.push(start+sides,start+sides+k+1,start+sides+k);
      }
    }
  }
  finish('Mission to Market flexible bikeway posts',false);
}
