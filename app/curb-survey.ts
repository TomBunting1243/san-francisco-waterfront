import * as THREE from 'three';
import data from '../public/data/curb-survey.json' with {type:'json'};

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
export const curbRuns=data.lines as Run[];
export const medianPaving=data.medianPaving;
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

export function replacementPavement(kind:string,index:number,original:number[][][]):number[][][][]{
  const overrides=data.overrides as Record<string,Record<string,number[][][][]>>;
  return overrides[kind]?.[index]??[original];
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
    tile.p.push(...a,...(dot<0?c:b),...(dot<0?b:c));
    for(let k=0;k<3;k++)tile.c.push(pigment.r,pigment.g,pigment.b);
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
  surface(data.medianSlab,medianGrade,'#c4b8a3');
  surface(data.westFlanks,westMarketGround,'#b58a73');
  for(const [id,t] of tiles){
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(t.p,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(t.c,3));g.userData.paintVertices=true;
    g.computeVertexNormals();mesh(g,'#ffffff',0,0,0).name='Surveyed curb faces '+id;
  }
}
