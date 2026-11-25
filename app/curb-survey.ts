import {cutCurbPalmBed} from './median-palm-sites.ts';
import * as THREE from 'three';
import howard from '../public/data/howard-trees.json' with {type:'json'};
import portal from '../public/data/folsom-portal.json' with {type:'json'};
import {frostCurbRuns,frostPavement} from './california-sidewalk.ts';
import data from '../public/data/curb-survey.json' with {type:'json'};
import fremontCorners from '../public/data/fremont-corner-curbs.json' with {type:'json'};

export const curbFaceHeight=.1524*.06;
export const gutterTop=.0315;
export const medianTop=gutterTop+curbFaceHeight;
export const harryBridgesBoundary=data.median;
function inside(x:number,z:number,ring:number[][]){
  let result=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];
    if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])result=!result;
  }
  return result;
}
type MeshFactory=(g:THREE.BufferGeometry,color:string,x:number,y:number,z:number)=>THREE.Mesh;
type Run=[number,number,number[][]];
const howardCurbs:Record<string,number[][]>=howard.curbs;
const howardPaving:Record<string,Record<string,number[][][][]>>=howard.paving;
export const howardSidewalk=howard.walk;
export const howardStreet=howard.road;
const portalCurbs:Record<string,number[][][]>=portal.curbs;
export const curbRuns=frostCurbRuns(data.lines as Run[]).flatMap((run):Run[]=>{
  const [source,median,path]=run,cut=portalCurbs[source+':'+path[0][0]+','+path[0][1]];
  if(howardCurbs[source])return [[source,median,howardCurbs[source]]];
  return cut?cut.map(points=>[source,median,points]):[run];
});
export const medianPaving=data.medianPaving;
export const medianSlab=data.medianSlab;
export const ferryRefugePaving=data.ferryRefugePaving;
// Sample the very same inclined stone facets that reach the renderer. This
// keeps feet on the two curb cuts when the surveyed paving is regenerated.
export function ferryRefugeGround(x:number,z:number){
  for(const [a,b,c] of ferryRefugePaving){
    const bx=b[0]-a[0],bz=b[2]-a[2],cx=c[0]-a[0],cz=c[2]-a[2];
    const dx=x-a[0],dz=z-a[2],area=bx*cz-bz*cx;
    if(Math.abs(area)<1e-10)continue;
    const u=(dx*cz-dz*cx)/area,v=(bx*dz-bz*dx)/area;
    if(u>=-1e-7&&v>=-1e-7&&u+v<=1.0000001)return a[1]+u*(b[1]-a[1])+v*(c[1]-a[1]);
  }
  return gutterTop;
}
export const bealeSidewalk=data.bealeWalk;
export const bealeBeds=data.bealeBeds;
export const westGradeCut=data.westCut, westParkPlans=data.westPark;
export const marketAxis=(z:number)=>-.13+(z+1.813)*.177;
export function westMarketGround(x:number,z:number){
  const run=Math.max(0,Math.min(-6.249-z,z+9.066));
  const grade=Math.min(.139,gutterTop+run/12);
  const flare=THREE.MathUtils.clamp((Math.abs(x-marketAxis(z))-.92)/.31,0,1);
  return THREE.MathUtils.lerp(grade,.139,flare);
}
export function medianGrade(x:number,z:number){
  let factor=1;
  for(const g of data.medianGates){
    const across=Math.abs(x-g[0]),inward=Math.abs(z-g[1]);
    factor=Math.min(factor,Math.max(inward/.15,(across-.098)/.058,0));
  }
  return gutterTop+factor*curbFaceHeight;
}
export function harryBridgesGround(x:number,z:number):number|undefined{
  if(!inside(x,z,harryBridgesBoundary)&&!inside(x,z,data.plantingIsland))return undefined;
  return medianGrade(x,z);
}

// Sidewalk 337 was clipped against a simplified round-corner buffer. Its
// straight chords part from the actual back of curb 3818976 near the junction.
// Use the same section vertices as addSurveyCurbs and intersect the final
// segment with the surviving hotel-side boundary.
const museumReturn=curbRuns.find(([id])=>id===3818976)![2];
const curbBack=museumReturn.map(([x,z,nx,nz])=>[x-.031*nx,z-.031*nz]);
const backA=curbBack[curbBack.length-2],backB=curbBack[curbBack.length-1];
const backDx=backB[0]-backA[0],backDz=backB[1]-backA[1],wallSlope=.340/-2.297;
const backT=(-7.844+(backA[0]+8.554)*wallSlope-backA[1])/(backDz-wallSlope*backDx);
export const museumWalkSeam=[backA[0]+backDx*backT,backA[1]+backDz*backT];
// Re-register the two curb returns across the road, walk and curb-strip
// polygons together. The map contains only changed outer-boundary stations.
const fremontStations:Record<string,Record<string,Record<string,number[][]>>>=fremontCorners.stations;
export function replacementPavement(kind:string,index:number,original:number[][][]):number[][][][]{
  const registered=howardPaving[kind]?.[index];
  if(registered)return registered;
  const overrides=data.overrides as Record<string,Record<string,number[][][][]>>;
  const adjusted=fremontStations[kind]?.[index];
  if(adjusted){
    const [first,...unchanged]=overrides[kind]?.[index]??[original];
    const [ring,...holes]=first;
    return [[ring.flatMap((point,i)=>adjusted[i]??[point]),...holes],...unchanged];
  }
  if(kind==='sidewalk'&&index===337){
    const ring=overrides.sidewalk[index][0][0];
    return [[[...ring.slice(0,6),...curbBack.slice(0,-1),museumWalkSeam]]];
  }
  return frostPavement(kind,index,overrides[kind]?.[index]??[original]);
}

type Vec=[number,number,number];
export function addSurveyCurbs(mesh:MeshFactory){
  type Tile={p:number[];c:number[]};
  const tiles=new Map<string,Tile>(),palette=new Map<string,THREE.Color>();
  function triangle(a:number[],b:number[],c:number[],color:string,nx=0,ny=1,nz=0){
    const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
    const dot=nx*(uy*vz-uz*vy)+ny*(uz*vx-ux*vz)+nz*(ux*vy-uy*vx);
    if(Math.abs(dot)<1e-10)return;
    const key=Math.floor(a[0]/16)+','+Math.floor(a[2]/16);
    let tile=tiles.get(key);if(!tile)tiles.set(key,tile={p:[],c:[]});
    let pigment=palette.get(color);if(!pigment)palette.set(color,pigment=new THREE.Color(color));
    const cut=cutCurbPalmBed(a,b,c);
    if(cut){
      for(const [p,q,r] of cut){
        tile.p.push(...p,...(dot<0?r:q),...(dot<0?q:r));
        for(let k=0;k<3;k++)tile.c.push(pigment.r,pigment.g,pigment.b);
      }
    }else{
      tile.p.push(...a,...(dot<0?c:b),...(dot<0?b:c));
      for(let k=0;k<3;k++)tile.c.push(pigment.r,pigment.g,pigment.b);
    }
  }
  const apronCuts:Record<string,{warning:boolean;points:number[][]}[]>=data.bealeAprons;
  for(const [source,median,path] of curbRuns){
    for(let i=1;i<path.length;i++){
      const start=path[i-1],end=path[i];
      const back=Math.min(start[4],end[4])<1?.157:.031;
      function profile(v:number[]):Vec[]{
        const [x,z,nx,nz,q]=v;
        const at=(offset:number,y:number):Vec=>[x+nx*offset,y,z+nz*offset];
        const top=gutterTop+q*curbFaceHeight;
        return [at(.037,.032),at(.0023,gutterTop),at(0,top),at(-.011,top),at(-back,median?medianTop:.0451)];
      }
      const a=profile(start),b=profile(end);
      for(let j=0;j<4;j++){
        if(source===3833285&&j===3){
          const outside=(data.ferryRefugeAprons as Record<string,number[][][]>)[i-1];
          if(outside){for(const [p,q,r] of outside)triangle(p,q,r,'#c4b8a3');continue;}
        }
        const cut=source===-202401&&j===3?apronCuts[i-1]:undefined;
        if(cut){
          for(const {warning,points:[p,q,r]} of cut)triangle(p,q,r,warning?'#bd9c55':'#c9c5b3');
          continue;
        }
        const face=j===1,color=['#92928a','#a39f90','#d1cbb9',median?'#c4b8a3':'#c9c5b3'][j];
        const nx=face?start[2]:0,ny=face?.02:1,nz=face?start[3]:0;
        triangle(a[j],b[j],b[j+1],color,nx,ny,nz);triangle(a[j],b[j+1],a[j+1],color,nx,ny,nz);
      }
    }
  }
  function surface(tris:number[][][],y:(x:number,z:number)=>number,color:string){
    for(const t of tris){
      const v=t.map(([x,z]):Vec=>[x,y(x,z),z]);triangle(v[0],v[1],v[2],color);
    }
  }
  surface(data.westFlanks,westMarketGround,'#b58a73');
  for(const [id,t] of tiles){
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(t.p,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(t.c,3));g.userData.paintVertices=true;
    g.computeVertexNormals();mesh(g,'#ffffff',0,0,0).name='Surveyed curb faces '+id;
  }
}
