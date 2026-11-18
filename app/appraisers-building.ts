import * as THREE from 'three';
import type {Font} from 'three/addons/loaders/FontLoader.js';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';

type Point=[number,number];
type Window={x:number;y:number;z:number;ry:number;w:number;h:number};
type Tier={plan:Point[];top:number;rows:number};
const parent=32965865,upper=1411189721;
const length=4.876,depth=2.217,grade=.035,m=.06;
const angle=Math.atan2(2.259,4.321),c=Math.cos(angle),s=Math.sin(angle);
const rect=(u:number,v:number,w:number,d:number):Point[]=>[[u,v],[u+w,v],[u+w,v+d],[u,v+d]];
const court=(inset:number,front:number,wingEnd:number):Point[]=>[
  [inset,front],[length-inset,front],[length-inset,wingEnd],[4.01,wingEnd],
  [4.01,1.347],[.909,1.347],[.909,wingEnd],[inset,wingEnd]];
// Height above local grade in metres. The rear court, end wings, lower
// shoulders and recessed center roof were checked separately in the USGS DSM.
const tiers:Tier[]=[
  {plan:rect(0,0,length,depth),top:19.74,rows:3},
  {plan:court(0,0,2.217),top:48.35,rows:8},
  {plan:[[0,.25],[.29,.25],[.29,0],[length-.29,0],[length-.29,.25],...court(0,.25,1.82).slice(1)],top:55.4,rows:2},
  {plan:rect(.29,0,length-.58,1.365),top:62.08,rows:2},
  {plan:rect(.50,.32,length-1,1.034),top:65.35,rows:1},
];
const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.81});
const limestone='#cbc9be',joint='#a09f98',granite='#929a96';
const porcelain='#8e7975',metal='#56595a',glasses=['#54656c','#6c777a','#65737a','#596569'];
const inside=(plan:Point[],u:number,v:number)=>{
  let hit=false;
  plan.forEach(([a,b],i)=>{const [x,z]=plan[(i+1)%plan.length];if((b>v)!==(z>v)&&u<(x-a)*(v-b)/(z-b)+a)hit=!hit;});
  return hit;
};
export function addAppraisersBuilding(b:{id:number},root:THREE.Group,windows:Window[],font?:Font){
  if(b.id!==parent&&b.id!==upper)return false;
  if(b.id===upper)return true; // Both mapped parts share one set of horizontal levels.
  const group=new THREE.Group();group.name='United States Appraisers Building';root.add(group);
  group.position.set(26.96,grade,-33.202);group.rotation.y=-angle;
  const geo=new FacadePanels();
  function slab(x:number,z:number,w:number,d:number,lo:number,hi:number,wall:string,roof=wall){
    const plan=rect(x,z,w,d);
    for(let i=0;i<4;i++){
      const [a,b]=plan[i],[u,v]=plan[(i+1)%4];
      geo.quad([a,lo,b],[a,hi,b],[u,hi,v],[u,lo,v],wall);
    }
    geo.quad([x,hi,z],[x,hi,z+d],[x+w,hi,z+d],[x+w,hi,z],roof);
  }
  function terrace(plan:Point[],next:Point[],height:number,tint:string){
    const axis=(k:0|1)=>[...new Set([...plan,...next].map(p=>p[k]))].sort((a,b)=>a-b);
    const us=axis(0),vs=axis(1);
    for(let i=1;i<us.length;i++)for(let j=1;j<vs.length;j++){
      const a=us[i-1],b=us[i],x=vs[j-1],z=vs[j],midU=(a+b)/2,midV=(x+z)/2;
      if(inside(plan,midU,midV)&&!inside(next,midU,midV))
        geo.quad([a,height,x],[a,height,z],[b,height,z],[b,height,x],tint);
    }
  }
  const westPairs=Array.from({length:9},(_,i)=>.594+i*.46);
  const endPairs=[.585,1.107,1.629];
  const lobby=.31;
  let bottom=0;
  tiers.forEach((tier,k)=>{
    const top=tier.top*m,from=k===0?lobby:bottom;
    for(let i=0;i<tier.plan.length;i++){
      const a=tier.plan[i],b=tier.plan[(i+1)%tier.plan.length],du=b[0]-a[0],dv=b[1]-a[1],width=Math.hypot(du,dv);
      const alongU=Math.abs(du)>.001,nx=dv/width,nz=-du/width;
      const coord=alongU?0:1,start=a[coord],sign=Math.sign(b[coord]-start);
      const at=(x:number,y:number,d=0):FacadePoint=>[a[0]+du*x/width+nx*d,y,a[1]+dv*x/width+nz*d];
      const face=(l:number,r:number,y:number,h:number,d:number,color:string)=>
        geo.quad(at(l,y,d),at(l,h,d),at(r,h,d),at(r,y,d),color);
      const street=a[1]<.28&&b[1]<.28||!alongU&&(a[0]<.51||a[0]>length-.51);
      const eastScreen=alongU&&a[1]>2.2&&k===0;
      if(k===0){
        face(0,width,0,lobby,-.023,eastScreen?metal:granite);
        for(let j=0;j<Math.round(width/.3);j++){
          const x=(j+.5)*.30;
          if(x+.07>width||(i===0&&Math.abs(x-length/2)<.28))continue;
          face(x-.067,x+.067,.065,.206,-.021,'#526367');
        }
        face(0,width,lobby-.045,lobby,0,'#9fa6a0');
      }
      if(eastScreen){
        face(0,width,from,top,0,'#897d76');
        for(let row=0;row<tier.rows;row++)for(let n=0;n<34;n++){
          const l=n*width/34,r=(n+1)*width/34;
          face(l+.008,r-.008,from+(top-from)*(row+.17)/3,from+(top-from)*(row+.76)/3,.0028,glasses[(n+row)%4]);
        }
        continue;
      }
      const bays:{x:number;w:number}[]=[];
      if(street){
        const paired=alongU?westPairs:endPairs,delta=alongU?.077:.081;
        const centers=[...(alongU?[.20,length-.20]:[.178,depth-.178]),...paired.flatMap(x=>[x-delta,x+delta])];
        for(const x of centers){const t=(x-start)*sign;if(t>.073&&t<width-.073)bays.push({x:t,w:.126});}
      }else{
        const n=Math.max(1,Math.round(width/.22));
        for(let j=0;j<n;j++)bays.push({x:(j+.5)*width/n,w:Math.min(width/n*.6,.125)});
      }
      bays.sort((a,b)=>a.x-b.x);
      let cursor=0;
      for(const [j,{x,w}] of bays.entries()){
        const l=x-w/2,r=x+w/2;
        face(cursor,l,from,top,0,limestone);cursor=r;
        geo.quad(at(l,from),at(l,top),at(l,top,-.016),at(l,from,-.016),joint);
        geo.quad(at(r,from,-.016),at(r,top,-.016),at(r,top),at(r,from),joint);
        const pitch=(top-from)/tier.rows;
        for(let row=0;row<tier.rows;row++){
          const y=from+pitch*row,sill=y+pitch*.26,head=y+pitch*.89;
          face(l,r,y,sill,-.016,porcelain);face(l,r,sill,head,-.016,glasses[(i+j+row)%4]);
          face(l,r,head,y+pitch,-.016,porcelain);
          face(l,r,sill+(head-sill)*.49,sill+(head-sill)*.49+.004,-.013,metal);
          if((row*9+j*3+k+i)%13===0){
            const [u,y,v]=at(x,(sill+head)/2,-.014);
            windows.push({x:26.96+c*u-s*v,y:grade+y,z:-33.202+s*u+c*v,ry:Math.atan2(c*nx-s*nz,s*nx+c*nz),w:w*.91,h:(head-sill)*.93});
          }
        }
      }
      face(cursor,width,from,top,0,limestone);
      // Crown grilles are small perforated squares centered on the stone piers.
      if(k===3&&width>1.5){
        for(let n=1;n<=3;n++)for(let h=0;h<3;h++)for(let v=0;v<3;v++){
          const x=width*n/4+.009*(v-1);face(x-.003,x+.003,top-.052+h*.011,top-.046+h*.011,.0018,joint);
        }
      }
    }
    terrace(tier.plan,tiers[k+1]?.plan??[],top,k===0?'#afa99b':'#bbb7ab');
    bottom=top;
  });
  // The longitudinal central well sits between two taller roof houses.
  const roof=65.35*m,cap=68.72*m;
  for(const [u,w] of [[.5,.73],[3.51,.86]])slab(u,.32,w,1.034,roof,cap,'#b8b6ac','#cecabd');
  slab(1.23,.32,2.28,.105,roof,cap,limestone);slab(1.23,1.246,2.28,.108,roof,cap,limestone);
  const fan=(u:number,v:number)=>{
    const pt=(i:number,r:number,y:number):FacadePoint=>[u+r*Math.cos(i*Math.PI/5),y,v+r*Math.sin(i*Math.PI/5)];
    for(let i=0;i<10;i++){
      geo.quad(pt(i,.039,roof+.077),pt(i,.039,roof+.09),pt(i+1,.039,roof+.09),pt(i+1,.039,roof+.077),joint);
      geo.triangle([u,roof+.09,v],pt(i+1,.039,roof+.09),pt(i,.039,roof+.09),metal);
    }
  };
  slab(2.58,.48,.18,.54,roof,roof+.077,'#aaa99d');
  for(let i=0;i<5;i++)for(let j=0;j<2;j++)fan(2.626+j*.084,.535+i*.104);
  // A metal canopy runs above the warehouse screen on Custom House Place.
  slab(.02,2.217,4.83,.067,lobby-.017,lobby,'#8e9591');
  // Sansome's central bronze doors and the limestone eagle in shallow relief.
  slab(2.20,-.038,.476,.04,.005,.291,'#7a7061','#a4a398');
  for(let n=0;n<4;n++)slab(2.228+n*.105,-.042,.098,.007,.018,.196,'#616456');
  slab(2.224,-.048,.428,.009,.189,.220,'#c5b48b');
  const eagle=(p:number[][])=>{
    const line=p.map(([x,h])=>new THREE.Vector2(x,h));
    for(const [i,j,k] of THREE.ShapeUtils.triangulateShape(line,[])){
      const at=(n:number):FacadePoint=>[length/2+p[n][0],.344+p[n][1],-.019];
      geo.triangle(at(k),at(j),at(i),'#b2afa2');
    }
  };
  eagle([[-.064,.016],[-.019,-.002],[-.014,.021],[0,.035],[.018,.028],[.009,.016],[.019,-.002],[.065,.016],[.055,-.017],[.021,-.033],[.015,-.059],[-.014,-.059],[-.021,-.033],[-.054,-.017]]);
  const mesh=geo.mesh(material);mesh.name='Sansome elevations, east light court and roof houses';group.add(mesh);
  if(font){
    const g=new THREE.ShapeGeometry(font.generateShapes('UNITED STATES APPRAISERS BUILDING',.010),2);g.center();
    const letters=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:'#4d4c43'}));
    letters.rotation.y=Math.PI;letters.position.set(length/2,.204,-.049);group.add(letters);
  }
  return true;
}
