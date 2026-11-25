import {BufferGeometry,Color,Float32BufferAttribute,ShapeUtils,Vector2} from 'three';
import type {Mesh} from 'three';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';
import {setPackedNormals} from './packed-normals.ts';

type Surface=(g:BufferGeometry,color:string,x:number,y:number,z:number)=>Mesh;
type Plan=[number,number];
const grade=.031,paintGrade=.03124;
// SF 2024 8 cm rectification. Stations are plate pixels, not linear metres.
// v traces the traffic-side white edge; one pixel is 1/132 world units.
const edge=[[4354,395.3],[4398,400.4],[4449,406],[4580,422],[4700,436.8],[4900,461],
  [5050,479.4],[5200,497.4],[5270,506],[5340,513.8],[5410,520.2],[5475,526],[5510,529],[5560,533],[5627,538]];
const edgeV=(u:number)=>{
  let i=1;
  while(i<edge.length-1&&edge[i][0]<u)i++;
  const [a,v]=edge[i-1],[b,w]=edge[i];
  return v+(w-v)*(u-a)/(b-a);
};
const vertex=(u:number,offset:number,y:number):FacadePoint=>[-56+u/132,y,2-(edgeV(u)+offset)/132];
export const howardMissionCycleLimits=[4354,5625] as const;
export function howardMissionCyclePoint(u:number,direction:1|-1){
  const [x,y,z]=vertex(u,direction===1?-31:-16,grade);
  return {x,y,z};
}

// The bay-side resurfacing is visible as a 12-pixel dark ribbon under the
// northbound stencils in the aerial and the SFMTA installation photograph.
// Its entire perimeter is interior to survey street polygon 91, piece 0.
const asphaltStations=[4354,...edge.map(p=>p[0]).filter(u=>u>4354&&u<5562),5562];
export const howardMissionAsphalt=[
  ...asphaltStations.map(u=>vertex(u,-37.4,grade)),
  ...asphaltStations.slice().reverse().map(u=>vertex(u,-25.4,grade)),
].map(([x,,z])=>[x,z]);

// The photographed blue-green frames are paired on each low plinth. The
// rail was added after SFMTA's November 2020 construction photograph.
// https://commons.wikimedia.org/wiki/File:Embarcadero_between_Mission_and_Howard,_San_Francisco_2023-07-18.jpg
// https://www.sfmta.com/blog/milestones-waterfront
const joints=[4399,4455,4511,4565,4621,4677,4732,4787,4842,4898,
  4953,5008,5063,5118,5173,5228,5283,5339,5395,5447];
const centerD=-6.1;
function addRail(p:FacadePanels,left:number,right:number){
  const base=.041,head=.095,bend=.005,radius=.00175;
  // Work in the tangent plane; a continuous bent tube has no coplanar caps
  // underneath the turned shoulders. The secondary horizontal dies into it.
  const a=vertex(left,centerD,base),b=vertex(right,centerD,base);
  const length=Math.hypot(b[0]-a[0],b[2]-a[2]),tx=(b[0]-a[0])/length,tz=(b[2]-a[2])/length;
  function tube(path:Plan[],color:string){
    let tint=p.palette.get(color);
    if(!tint)p.palette.set(color,tint=new Color(color));
    let previous=-1;
    for(let j=0;j<path.length;j++){
      const [s,y]=path[j],before=path[Math.max(0,j-1)],after=path[Math.min(path.length-1,j+1)];
      const slope=Math.atan2(after[1]-before[1],after[0]-before[0]);
      const ring=p.positions.length/3;
      for(let k=0;k<5;k++){
        const angle=(k+.5)*2*Math.PI/5,v=radius*Math.cos(angle),d=radius*Math.sin(angle),along=s-v*Math.sin(slope);
        p.positions.push(a[0]+along*tx-d*tz,y+v*Math.cos(slope),a[2]+along*tz+d*tx);
        p.colors.push(tint.r,tint.g,tint.b);
      }
      if(previous>=0)for(let k=0;k<5;k++){
        const l=(k+1)%5;p.indices.push(previous+k,previous+l,ring+l,previous+k,ring+l,ring+k);
      }
      previous=ring;
    }
  }
  tube([[0,base],[0,head-bend],[bend,head],
    [length-bend,head],[length,head-bend],[length,base]],'#31565b');
  tube([[0,head-.018],[length,head-.018]],'#3d6266');
}

function plinth(p:FacadePanels,l:number,r:number){
  const w=3.25,c=.92;
  const ring:Plan[]=[[l+c,centerD-w],[r-c,centerD-w],[r,centerD-w+c],[r,centerD+w-c],
    [r-c,centerD+w],[l+c,centerD+w],[l,centerD+w-c],[l,centerD-w+c]];
  const top=ring.map(([u,d])=>vertex(u,d,.041)),bottom=ring.map(([u,d])=>vertex(u,d,grade));
  for(let i=1;i+1<top.length;i++)p.triangle(top[0],top[i],top[i+1],'#c5c2b7');
  for(let i=0;i<ring.length;i++){
    const j=(i+1)%ring.length;
    p.quad(bottom[i],bottom[j],top[j],top[i],i%4===0?'#aaa99e':'#b5b2a7');
  }
  const mid=(l+r)/2;
  addRail(p,l+2.3,mid-1.25);addRail(p,mid+1.25,r-2.3);
}

export function addHowardMissionBikeway(mesh:Surface){
  const physical=new FacadePanels(),paint=new FacadePanels(),white='#e2dfce';
  for(let i=1;i<joints.length;i++)plinth(physical,joints[i-1]+2.3,joints[i]-2.3);
  function strip(l:number,r:number,low:number,high:number,tint=white){
    const stations=[l,...edge.filter(([u])=>u>l&&u<r).map(([u])=>u),r];
    for(let i=1;i<stations.length;i++){
      const a=stations[i-1],b=stations[i];
      paint.quad(vertex(a,low,paintGrade),vertex(b,low,paintGrade),vertex(b,high,paintGrade),vertex(a,high,paintGrade),tint);
    }
  }
  strip(4355,5624,-.68,.68);
  // The thin bay-side paint starts at Howard, resumes after the last steel
  // frame, and runs to the green box before Mission's south ladder.
  strip(4355,4398,-10.4,-9.25);strip(5446,5561,-10.4,-9.25);
  strip(5450,5557,-5.4,-4);
  // Reflective wear on the two white buffer lines remains in the street-light
  // receiver. Dark marks in the Mission approach do not establish post heights.
  const divider=[[4355,4362],[4408,4426],[4469,4487],[4533,4551],[4592,4611],[4656,4675],[4720,4739],
    [4786,4805],[4850,4869],[4917,4936],[4980,4998],[5046,5064],[5112,5133],[5179,5199],[5244,5262],
    [5307,5327],[5372,5391],[5436,5455],[5501,5523],[5548,5558],[5582,5595]];
  for(const [l,r] of divider)strip(l,r,25.4,26.75);
  // Mission approach marking cut around the actual opposing arrows and
  // stop stripe. All adjoining pigments share a plane and do not overlap.
  type Ring=Plan[];
  function fill(outer:Ring,ink:string,holes:Ring[]=[]){
    const rings=[outer,...holes].map(r=>r.map(([u,d])=>new Vector2(u,d)));
    const points=rings.flat();
    for(const tri of ShapeUtils.triangulateShape(rings[0],rings.slice(1))){
      const [a,b,c]=tri.map(k=>points[k]);
      const p=[a,b,c].map(q=>vertex(q.x,q.y,paintGrade));
      if((b.x-a.x)*(c.y-a.y)<(b.y-a.y)*(c.x-a.x))p.reverse();
      paint.triangle(p[0],p[1],p[2],ink);
    }
  }
  fill([[5558,-5.2],[5559.7,-5.1],[5555.1,-.68],[5553.3,-.68]],white);
  strip(5562,5626,-9.5,-8.35);
  strip(5601.2,5602.5,-3.65,-.68);
  const green='#93a282',pale='#d8d9c1';
  const footprint:Ring=[[5563,-36.6],[5617.2,-36.6],[5615.9,-23],[5628.1,-23],[5626.2,-9.5],[5561.5,-9.5]];
  const arrow=(u:number,d:number,dir:number):Ring=>
    [[-4.6,-.6],[.6,-.6],[.6,-2],[4.7,0],[.6,2],[.6,.6],[-4.6,.6]].map(([x,y])=>[u+dir*x,d+dir*y]);
  const arrows=[arrow(5602.7,-30,1),arrow(5572.8,-16,-1)];
  // The two worn bicycle stencils have paired wheels in the aerial. The
  // stems and frame join into one positive mark; the wheel voids stay green.
  const bike:Ring=[[-6,-4.3],[-4.5,-5.1],[-2.6,-4.6],[-1.8,-2.9],[-2.1,-1.5],[-3.1,-.7],
    [-.2,-.15],[1,-1],[2.3,-.8],[2.4,.2],[4.2,.2],[5.2,-.5],[6.3,-.15],[6.3,1],[3.8,1.6],
    [.4,1.4],[-1.7,1.4],[-1.4,3.2],[-2.7,4.7],[-4.5,5],[-6.5,4.2],[-7.1,2.9],[-6.6,1.3],
    [-5.5,.5],[-4.5,.3],[-4.1,-.9],[-5.8,-1.4],[-6.8,-2.7]];
  const stencils=[[5573,-30,1],[5601,-16,-1]].map(([u,d,s])=>{
    const at=(r:Ring):Ring=>r.map(([x,y])=>[u+x*s,d+y*s]);
    const wheels=[-3.1,2.8].map(k=>at([[-5.6,k],[-4.9,k-1.0],[-3.7,k-.95],[-3,k],[-3.8,k+.9],[-5,k+.9]]));
    return {body:at(bike),wheels};
  });
  fill(footprint,green,[...arrows,...stencils.map(q=>q.body)]);
  for(const a of arrows)fill(a,pale);
  for(const {body,wheels} of stencils){fill(body,pale,wheels);for(const w of wheels)fill(w,green);}
  fill([[5617.2,-36.6],[5619,-36.6],[5617.7,-23],[5615.9,-23]],white);
  function emit(batch:FacadePanels,name:string,isPaint:boolean){
    const g=new BufferGeometry().setAttribute('position',new Float32BufferAttribute(batch.positions,3));
    g.setAttribute('color',new Float32BufferAttribute(batch.colors,3));g.setIndex(batch.indices);setPackedNormals(g);
    g.userData.paintVertices=true;
    if(isPaint)g.userData.roadPaint='Waterfront crossings';
    const part=mesh(g,'#ffffff',0,0,0);part.name=name;part.userData.roadExposure=1;
  }
  emit(physical,'Howard–Mission concrete islands and railings',false);
  emit(paint,'Howard–Mission receiving lanes',true);
}
