import * as THREE from 'three';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';
type Window={x:number;y:number;z:number;ry:number;w:number;h:number};
type Point=[number,number];
const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.74});
const granite='#b69e91',graniteLight='#c1ab9b',joint='#9b877b',jamb='#847771';
const glass=['#53636e','#596b78','#5c6974','#657180','#526372'];
const base=.055,lintel=.448,level=.245;
// Local u points north along Battery, v east along Sacramento. One unit = 16.67 m.
// USGS survey: five strips across the block rise two office floors per step
// toward the central double bay. Each strip rises again towards the central ridge.
const strips=[-.018,.362,.742,1.514,1.899,2.282],heights=[6.18,6.60,7.00,6.60,6.18];
const west=.007,east=2.567,half=(east-west)/2;
const at=(u:number,v:number,y:number):FacadePoint=>[12.371+.89*u-.455*v,y,-37.967+.455*u+.89*v];
const roofHeight=(i:number,v:number)=>heights[i]+.67*(1-Math.min(1,Math.abs(v-(west+half))/half));
function surface(f:FacadePanels,a:Point,b:Point){
  const length=Math.hypot(b[0]-a[0],b[1]-a[1]),du=(b[0]-a[0])/length,dv=(b[1]-a[1])/length;
  const p=(s:number,y:number,out=0)=>at(a[0]+du*s+dv*out,a[1]+dv*s-du*out,y);
  const panel=(l:number,r:number,lo:number,hi:number,color:string,out=0)=>f.quad(p(l,lo,out),p(l,hi,out),p(r,hi,out),p(r,lo,out),color);
  const reveal=(s:number,y0:number,y1:number,from:number,to:number,color:string)=>f.quad(p(s,y0,from),p(s,y1,from),p(s,y1,to),p(s,y0,to),color);
  const top=(l:number,r:number,y:number,back:number,front:number,color:string)=>f.quad(p(l,y,back),p(r,y,back),p(r,y,front),p(l,y,front),color);
  const origin=p(0,0),out=p(0,0,1);
  return {length,p,panel,reveal,top,ry:Math.atan2(out[0]-origin[0],out[2]-origin[2])};
}
type Surface=ReturnType<typeof surface>;
function plinth(f:FacadePanels,e:Surface,bays:number,street:'Battery'|'Sacramento'|'side'){
  const step=e.length/bays;
  for(let j=0;j<bays;j++){
    const l=j*step,r=l+step,entrance=street==='Battery'&&(j===2||j===3);
    const back=entrance?-.103:-.039,margin=street==='side'?.095:.066,openingTop=entrance?.364:.310;
    e.panel(l,l+margin,base,lintel,granite);e.panel(r-margin,r,base,lintel,granite);
    e.panel(l+margin,r-margin,openingTop,lintel,granite);
    e.panel(l+margin,r-margin,base,openingTop,entrance?'#49565d':'#626d70',back);
    e.reveal(l+margin,base,openingTop,0,back,jamb);e.reveal(r-margin,base,openingTop,back,0,graniteLight);
    e.top(l+margin,r-margin,base+.006,back,.025,'#a69d8c');
    const mid=(l+r)/2;
    e.panel(mid-.004,mid+.004,base,openingTop,'#a49b8d',back+.002);
    e.panel(l+margin,r-margin,.247,.255,'#afa394',back+.003);
    for(const line of [.176,.327])for(const [s,t] of [[l,l+margin],[r-margin,r]])e.panel(s,t,line,line+.003,joint,.001);
  }
  e.panel(0,e.length,lintel-.045,lintel-.021,'#8c7970',.024);
  e.panel(0,e.length,lintel-.020,lintel,graniteLight,.027);e.top(0,e.length,lintel,0,.027,graniteLight);
}
function officeBay(f:FacadePanels,e:Surface,l:number,r:number,yl:number,yr:number,bay:number,windows:Window[]){
  const lowerTop=Math.min(yl,yr),pitch=(r-l)/4,outer=.025;
  // Each floor plate has notches at the paired major piers. Each intervening
  // clear span divides into four lights with granular spandrels below.
  f.quad(e.p(l,lintel),e.p(l,yl),e.p(r,yr),e.p(r,lintel),'#9e8b82');
  for(let j=0;j<4;j++){
    const left=l+j*pitch+.010,right=l+(j+1)*pitch-.009,high=yl+(yr-yl)*(j+.5)/4;
    const glazedStrip=bay>0&&bay<5&&(j===1||j===2);
    if(glazedStrip)e.panel(left,right,1.14,high-.084,'#495e70',.0005);
    for(let k=0,y=lintel+.024;y+.115<high-.06;k++,y+=level){
      const h=Math.min(.181,high-.06-y),tint=glass[(bay*3+j+Math.floor(k/4))%glass.length];
      e.panel(left,right,y,y+h,tint,.001);
      if((k+bay*5+j*7)%10===0){
        const [x,wy,z]=e.p((left+right)/2,y+h*.5,.0024);
        windows.push({x,y:wy,z,ry:e.ry,w:(right-left)*.84,h:h*.81});
      }
    }
    const y1=yl+(yr-yl)*j/4,y2=yl+(yr-yl)*(j+1)/4;
    if(j>0)e.panel(left-.014,left-.006,lintel,Math.min(y1,y2),graniteLight,.005);
  }
  for(const [s,y] of [[l,yl],[r-.014,yr]]){
    e.panel(s,s+.014,lintel,y,graniteLight,outer);
    e.reveal(s,lintel,y,0,outer,jamb);e.reveal(s+.014,lintel,y,outer,0,granite);
  }
  for(let y=lintel+level*4;y<lowerTop-.2;y+=level*4)e.panel(l,r,y-.009,y,graniteLight,.006);
}
function crown(f:FacadePanels){
  const width=(east-west)/6;
  for(let i=0;i<5;i++){
    const a=strips[i],b=strips[i+1];
    for(let j=0;j<6;j++){
      const v0=west+j*width,v1=v0+width;
      const s=[v0,(v0+v1)/2,v1],h=s.map((v,k)=>roofHeight(i,v)+(k===1?.060:0));
      const stripWall=(u:number,front:boolean,lo:number)=>{
        for(let n=0;n<2;n++){
          const A=at(u,s[n],h[n]),B=at(u,s[n+1],h[n+1]),C=at(u,s[n+1],h[n+1]-lo),D=at(u,s[n],h[n]-lo);
          if(front)f.quad(A,B,C,D,granite);else f.quad(D,C,B,A,granite);
          if(lo<.35)continue;
          // Four recessed louvres per full bay behind the gable's pale frame.
          for(let k=0;k<2;k++){
            const l=(k+.11)/2,r=(k+.89)/2,du=front?.0015:-.0015;
            const pt=(t:number,dy:number)=>at(u+du,s[n]+(s[n+1]-s[n])*t,h[n]+(h[n+1]-h[n])*t+dy);
            const p=pt(l,-.070),q=pt(r,-.070),r0=pt(r,-.323),l0=pt(l,-.323);
            if(front)f.quad(p,q,r0,l0,'#657073');else f.quad(l0,r0,q,p,'#657073');
          }
        }
      };
      // These high cheek walls and folded skylight frames make the crown
      // readable from street level. The valleys remain open to the sky.
      stripWall(a,false,i>0&&heights[i]>heights[i-1]?.42:.065);
      stripWall(b,true,i<4&&heights[i]>heights[i+1]?.42:.065);
      for(let n=0;n<2;n++){
        const v=s[n],z=s[n+1],low=h[n],high=h[n+1];
        f.quad(at(a,v,low),at(a,z,high),at(b,z,high),at(b,v,low),'#bcb6a7');
        const vA=v+(z-v)*.14,vB=v+(z-v)*.83,yA=low+(high-low)*.14+.002,yB=low+(high-low)*.83+.002;
        if(n!==j%2)continue;
        const panes=Math.round((b-a)/.087);
        for(let k=0;k<panes;k++){
          const l=a+.027+k*(b-a-.054)/panes,r=a+.027+(k+1)*(b-a-.054)/panes-.006;
          f.quad(at(l,vA,yA),at(l,vB,yB),at(r,vB,yB),at(r,vA,yA),'#646c68');
        }
      }
    }
  }
  // Two round exhaust openings on the center ridge are distinct in the 8 cm photo.
  for(const u of [.932,1.30]){
    const v=1.365,y=7.696;
    for(let j=0;j<4;j++){
      const footprint:Point[]=[[u-.125,v-.13],[u+.125,v-.13],[u+.125,v+.13],[u-.125,v+.13]];
      const e=surface(f,footprint[j],footprint[(j+1)%4]);e.panel(0,e.length,7.59,y-.003,graniteLight);
    }
    f.quad(at(u-.125,v-.13,y-.003),at(u-.125,v+.13,y-.003),at(u+.125,v+.13,y-.003),at(u+.125,v-.13,y-.003),'#a9a99d');
    for(let j=0;j<16;j++){
      const a=j*Math.PI/8,b=(j+1)*Math.PI/8;
      const pt=(r:number,t:number,top:number)=>at(u+r*Math.cos(t),v+r*Math.sin(t),top);
      f.quad(pt(.085,a,y),pt(.085,b,y),pt(.115,b,y),pt(.115,a,y),'#c7c2b2');
      f.triangle(at(u,v,y-.001),pt(.085,b,y-.001),pt(.085,a,y-.001),'#5f6562');
    }
  }
}
export function addEmbarcaderoCenterWest(b:{id:number},root:THREE.Group,windows:Window[]){
  if(b.id!==32947500)return false;
  const f=new FacadePanels();
  for(const reverse of [false,true]){
    const u=reverse?strips[5]:strips[0];
    const street=surface(f,[u,reverse?west:east],[u,reverse?east:west]);
    plinth(f,street,6,reverse?'Sacramento':'side');
    for(let j=0;j<6;j++){
      const l=j*street.length/6,r=(j+1)*street.length/6;
      const yl=roofHeight(0,west+l),yr=roofHeight(0,west+r);
      officeBay(f,street,l,r,yl,yr,j,windows);
      // The perimeter parapets echo the folded screens on the two raised rows.
      const m=(l+r)/2,peak=(yl+yr)/2+.095;
      for(const [s,t,y,z] of [[l,m,yl,peak],[m,r,peak,yr]]){
        f.quad(street.p(s,y-.055,.012),street.p(s,y+.013,.012),street.p(t,z+.013,.012),street.p(t,z-.055,.012),graniteLight);
      }
    }
    const v=reverse?east:west;
    const frontage=surface(f,[reverse?strips[5]:strips[0],v],[reverse?strips[0]:strips[5],v]);
    plinth(f,frontage,6,reverse?'Battery':'side');
    for(let j=0;j<5;j++){
      const k=reverse?4-j:j;
      const l=reverse?strips[5]-strips[k+1]:strips[k]-strips[0],r=l+strips[k+1]-strips[k];
      const count=k===2?2:1;
      for(let n=0;n<count;n++)officeBay(f,frontage,l+n*(r-l)/count,l+(n+1)*(r-l)/count,heights[k],heights[k],j+n,windows);
    }
  }
  crown(f);
  const mesh=f.mesh(material);mesh.name='275 Battery Street · Embarcadero Center West';root.add(mesh);return true;
}
