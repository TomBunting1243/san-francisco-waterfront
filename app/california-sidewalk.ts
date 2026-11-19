import * as THREE from 'three';
import data from '../public/data/california-sidewalk.json' with {type:'json'};

type Plan=number[][][];
type Run=[number,number,number[][]];
const walk=.045,road=.031,lip=.0315+.1524*.06;
export const frostBrickTriangles=data.brick;
export const frostCrossings=data.bars;
const curb=data.face;
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const bands=data.transition;
export const registeredMarketTracks:Record<string,[number,number][]>=Object.fromEntries(
  Object.entries(data.fTracks).map(([id,path])=>[id,path.map(([x,z]):[number,number]=>[x,z])]),
);
function railBlend(z:number){
  return clamp(Math.min((z-bands[0])/(bands[1]-bands[0]),(bands[3]-z)/(bands[3]-bands[2])));
}
export function marketRailTop(z:number){return THREE.MathUtils.lerp(.060,.0331,railBlend(z));}
// Legacy track outside the terminal centered its four-millimetre strip at .060.
export function marketRailCenter(z:number){return marketRailTop(z)-.002*railBlend(z);}

export function frostPlazaSurface(x:number,z:number):number|undefined{
  let inside=false;
  const ring=data.outline;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];
    if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside?frostWalkHeight(x,z)+.00035:undefined;
}
function curbDistance(x:number,z:number){
  let d=Infinity;
  for(let i=1;i<curb.length;i++){
    const [a,b]=curb[i-1],[c,e]=curb[i],dx=c-a,dz=e-b;
    const t=clamp(((x-a)*dx+(z-b)*dz)/(dx*dx+dz*dz));
    d=Math.min(d,Math.hypot(x-a-t*dx,z-b-t*dz));
  }
  return d;
}
/** Registered Public Works ramp mouths share intersection coordinates.
 * The individual landing directions come from the orthophoto. */
export function frostWalkHeight(x:number,z:number){
  let height=THREE.MathUtils.lerp(lip,walk,clamp(curbDistance(x,z)/.095));
  for(const [a,b,w] of data.ramps as [number[],number[],number][]){
    const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
    const run=((x-a[0])*dx+(z-a[1])*dz)/length;
    const cross=Math.abs((x-a[0])*dz-(z-a[1])*dx)/length;
    if(run<-.026||run>length||cross>w+.065)continue;
    const slope=Math.max(clamp(run/length),clamp((cross-w)/.065));
    height=Math.min(height,THREE.MathUtils.lerp(road,walk,slope));
  }
  return height;
}
export function frostPavement(kind:string,index:number,fallback:Plan[]):Plan[]{
  const clipped=data.overrides as Record<string,Record<string,Plan[]>>;
  return clipped[kind]?.[index]??fallback;
}
export function frostCurbRuns(runs:Run[]){
  const cuts=data.curbs as Record<string,number[][][]>;
  return runs.flatMap((run,i):Run[]=>cuts[i]?.map(p=>[run[0],run[1],p])??[run]);
}
type Surface=(g:THREE.BufferGeometry,color:string,x:number,y:number,z:number)=>THREE.Mesh;
export const replacedMarketCrossings=new Set([550660826,667569470,667569471]);
export function addCaliforniaSidewalk(mesh:Surface,railHead:(z:number)=>number){
  type Tile={positions:number[];colors:number[]};
  const paving:Tile={positions:[],colors:[]},paint:Tile={positions:[],colors:[]};
  const pigment=new THREE.Color();
  function triangle(batch:Tile,points:number[][],color:string,vertical=false){
    const [a,b,c]=points;
    const normal=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);
    if(!vertical&&Math.abs(normal)<1e-11)return;
    pigment.set(color);
    for(const v of vertical||normal>0?[a,b,c]:[a,c,b]){
      batch.positions.push(...v);batch.colors.push(pigment.r,pigment.g,pigment.b);
    }
  }
  function top(tris:number[][][],height:(x:number,z:number)=>number,c:string,batch=paving){
    for(const t of tris)triangle(batch,t.map(([x,z])=>[x,height(x,z),z]),c);
  }
  top(data.asphalt,()=>road,'#899692');
  top(data.concrete,frostWalkHeight,'#c6c0af');
  top(data.warnings,frostWalkHeight,'#bca565');
  top(data.railBed,(_x,z)=>railHead(z)-.0021,'#a59e8c');
  for(const bars of Object.values(frostCrossings))top(bars,()=>road+.00012,'#e0dcd0',paint);
  // The old general curb runs have been clipped through both ramp openings.
  // Split the new curb at the rails: the embedded tracks run flush through the mouth.
  const railBoundary=data.railBed;
  function inTrack(x:number,z:number){
    return railBoundary.some(([a,b,c])=>{
      const sign=(p:number[],q:number[])=>(x-p[0])*(q[1]-p[1])-(z-p[1])*(q[0]-p[0]);
      const u=sign(a,b),v=sign(b,c),w=sign(c,a);
      return (u>=0&&v>=0&&w>=0)||(u<=0&&v<=0&&w<=0);
    });
  }
  for(let i=1;i<curb.length;i++){
    const [a,b]=curb[i-1],[c,d]=curb[i];
    const n=Math.max(1,Math.ceil(Math.hypot(c-a,d-b)/.024));
    for(let j=0;j<n;j++){
      const edge=(t:number)=>[THREE.MathUtils.lerp(a,c,t),THREE.MathUtils.lerp(b,d,t)];
      const p=edge(j/n),q=edge((j+1)/n),mid=edge((j+.5)/n);
      if(inTrack(...mid as [number,number]))continue;
      const lo=[p[0],road,p[1]],hi=[p[0],frostWalkHeight(p[0],p[1]),p[1]];
      const r=[q[0],road,q[1]],s=[q[0],frostWalkHeight(q[0],q[1]),q[1]];
      triangle(paving,[lo,s,r],'#a6a496',true);triangle(paving,[lo,hi,s],'#a6a496',true);
    }
  }
  for(const [batch,name] of [[paving,'Frost Plaza landings and rail approach'],[paint,'Market and Drumm crosswalk paint']] as const){
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(batch.positions,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(batch.colors,3));
    g.computeVertexNormals();g.userData.paintVertices=true;
    if(batch===paint)g.userData.roadPaint='Market and Drumm crossings';
    mesh(g,'#ffffff',0,0,0).name=name;
  }
}
