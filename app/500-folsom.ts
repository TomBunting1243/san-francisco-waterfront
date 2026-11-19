import * as THREE from 'three';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';

type Point=[number,number];
type Window={x:number;y:number;z:number;ry:number;w:number;h:number};
const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.73});
const eave='#d1cfc0',rib='#d5d3c4',shadow='#909899',clay='#b16e4f',reveal='#935e4e';
const glazing=['#527681','#547681','#617f86','#4c6e7a','#5b7982'];
const grade=.055,podium=1.57,roof=7.65;
const world=(u:number,v:number,y:number):FacadePoint=>[-40.372+.9895*u+.1445*v,y,-38.423-.1445*u+.9895*v];
const rectangle=(l:number,r:number,b:number,t:number):Point[]=>[[l,b],[r,b],[r,t],[l,t]];
function top(f:FacadePanels,ring:Point[],y:number,color:string){
  for(const [a,b,c] of THREE.ShapeUtils.triangulateShape(ring.map(p=>new THREE.Vector2(...p)),[])){
    f.triangle(world(...ring[a],y),world(...ring[c],y),world(...ring[b],y),color);
  }
}
function elevation(f:FacadePanels,a:Point,b:Point){
  const len=Math.hypot(b[0]-a[0],b[1]-a[1]),du=(b[0]-a[0])/len,dv=(b[1]-a[1])/len;
  const p=(s:number,y:number,out=0)=>world(a[0]+du*s+dv*out,a[1]+dv*s-du*out,y);
  const face=(l:number,r:number,lo:number,hi:number,tint:string,out=0)=>f.quad(p(l,lo,out),p(l,hi,out),p(r,hi,out),p(r,lo,out),tint);
  function shelf(l:number,r:number,y:number,back:number,front:number,color:string){
    f.quad(p(l,y,back),p(r,y,back),p(r,y,front),p(l,y,front),color);
  }
  function jamb(s:number,lo:number,hi:number,out1:number,out2:number,color:string){
    f.quad(p(s,lo,out1),p(s,hi,out1),p(s,hi,out2),p(s,lo,out2),color);
  }
  const n=p(0,0,1),o=p(0,0);
  return {len,p,face,shelf,jamb,angle:Math.atan2(n[0]-o[0],n[2]-o[2])};
}
function solid(f:FacadePanels,ring:Point[],lo:number,hi:number,color:string,cap=color){
  ring.forEach((a,i)=>{const e=elevation(f,a,ring[(i+1)%ring.length]);e.face(0,e.len,lo,hi,color);});
  top(f,ring,hi,cap);
}

// Local u runs from Folsom toward Clementina, v from the ramp toward First.
// The architect's photograph shows five rectilinear volumes with alternating
// setbacks and two-story balcony stacks cut into the sides of the glass.
const tiers=[
  {l:.010,r:1.73,b:-2.12,t:.11,lo:.34,hi:1.59,floors:8},
  {l:-.008,r:1.78,b:-2.105,t:.15,lo:1.59,hi:3.08,floors:8},
  {l:.028,r:1.73,b:-2.15,t:.22,lo:3.08,hi:4.59,floors:8},
  {l:-.012,r:1.78,b:-2.105,t:.15,lo:4.59,hi:6.10,floors:8},
  {l:.019,r:1.73,b:-2.14,t:.22,lo:6.10,hi:roof,floors:9},
];
function tower(f:FacadePanels,windows:Window[]){
  const base=rectangle(.045,1.68,-2.08,.11);
  solid(f,base,grade,.34,'#466570');
  const store=elevation(f,base[3],base[0]);
  for(let x=.05;x<store.len;x+=.16)store.face(x,x+.012,grade,.34,'#b0b9b3',.008);
  for(const [k,t] of tiers.entries()){
    const ring=rectangle(t.l,t.r,t.b,t.t);
    top(f,ring,t.hi,eave);
    ring.forEach((a,side)=>{
      const e=elevation(f,a,ring[(side+1)%4]),{len}=e,n=Math.round(len/.065);
      const step=len/n,h=(t.hi-t.lo)/t.floors;
      // The First-facing end is finned across its full width. The deep reveals
      // are on the long elevations and change bay at each horizontal joint.
      const slot=side%2===1?(k%2?Math.round(n*.71):1):-10;
      for(let j=0;j<n;j++){
        const x=j*step,r=x+step,cut=j>=slot&&j<slot+3;
        if(cut)continue;
        e.face(x,r,t.lo,t.hi,glazing[(j+side+k)%glazing.length]);
        e.face(x,x+.008,t.lo+.012,t.hi,rib,.028);
        e.jamb(x,t.lo+.012,t.hi,0,.028,shadow);
        e.jamb(x+.008,t.lo+.012,t.hi,.028,0,eave);
        for(let floor=0;floor<t.floors;floor++){
          if((j*7+side*5+k*13+floor*11)%13!==0)continue;
          const [X,Y,Z]=e.p(x+step*.56,t.lo+(floor+.54)*h,.0012);
          windows.push({x:X,y:Y,z:Z,ry:e.angle,w:step*.66,h:h*.57});
        }
      }
      if(slot>=0){
        const l=slot*step,r=(slot+3)*step,back=-.091;
        e.face(l,r,t.lo,t.hi,clay,back);e.jamb(l,t.lo,t.hi,0,back,reveal);e.jamb(r,t.lo,t.hi,back,0,clay);
        for(let i=0;i<t.floors;i++){
          const y=t.lo+i*h;e.face(l+.026,r-.033,y+.012,y+h*.80,'#53656a',back+.002);
          if(i%2===0){
            e.shelf(l,r,y+.013,back,.004,eave);e.face(l,r,y,y+.014,eave,.004);
            e.face(l+.004,r-.004,y+.014,y+.062,'#74898b',.001);
            e.face(l+.004,r-.004,y+.058,y+.064,'#c3c4b5',.003);
          }
        }
      }
      for(let i=1;i<t.floors;i++){
        const y=t.lo+i*h;
        if(slot<0)e.face(0,len,y,y+.008,'#829396',.001);
        else{e.face(0,slot*step,y,y+.008,'#829396',.001);e.face((slot+3)*step,len,y,y+.008,'#829396',.001);}
      }
      e.face(0,len,t.hi-.028,t.hi,eave,.031);
    });
  }
  // 2024 orthophoto: two long PV fields flank a north–south mechanical spine.
  solid(f,rectangle(.21,1.48,-1.90,.087),roof,7.925,'#a39e94','#d1cabb');
  for(const [a,b] of [[.255,.564],[1.177,1.450]])for(let i=0;i<8;i++){
    const z=-1.856+i*.235;
    solid(f,rectangle(a,b,z,z+.221),7.926,7.947,'#777d7c','#39464b');
  }
  solid(f,rectangle(.620,1.132,-1.872,-1.50),7.926,8.045,'#92958d','#bcb6a4');
  for(const x of [.749,1.004]){
    const vent:Point[]=Array.from({length:12},(_,i)=>[x+.087*Math.cos(i*Math.PI/6),-1.68+.087*Math.sin(i*Math.PI/6)]);
    solid(f,vent,8.045,8.067,'#a39e8c','#565d5a');
  }
  for(const [a,b,c,d,h] of [[.65,.85,-1.44,-1.11,8.07],[.79,.96,-1.06,-.616,8.15],[.68,1.05,-.54,-.26,8.16],[.97,1.11,-.21,-.03,8.03]]){
    solid(f,rectangle(a,b,c,d),7.926,h,'#ada99b','#cbc7b5');
  }
}

// Perimeter taken from Fougeron's typical-level plan and the city ortho.
// The ramp clips the west wing. The east wing turns behind the tower to
// Clementina, leaving the unbuilt area immediately behind its long facade.
const west:Point[]=[[.07,-3.87],[.65,-3.87],[1.02,-3.43],[1.02,-2.10],[.265,-2.10],[.265,-2.67],[.07,-2.67]];
const east:Point[]=[[.01,.12],[1.70,.12],[1.70,-.25],[2.03,-.25],[2.03,-.55],[2.575,-.55],[2.575,.70],[.01,.70]];
function podiumWing(f:FacadePanels,ring:Point[],first:boolean){
  top(f,ring,podium,'#c3bfac');
  ring.forEach((a,i)=>{
    const b=ring[(i+1)%ring.length],e=elevation(f,a,b),{len}=e;
    const isFirst=first&&i===6;
    const n=Math.max(1,Math.round(len/.17)),pitch=len/n;
    const bronze='#746761',cream='#cecbbf';
    // On First, one recessed orange court is enclosed by the broad metal frame;
    // a glazed stair joint separates it from the narrow ivory residential bay.
    const lo=.327,step=(podium-lo)/8,gap=isFirst?.092:.042;
    for(let j=0;j<n;j++){
      const l=j*pitch,r=l+pitch,s=(l+r)/2;
      const joint=isFirst&&s>.54&&s<.83;
      const court=isFirst?s>1.55&&s<2.17:(j%8===3||j%8===4);
      const edge=isFirst?(s>2.25||s<.105||s>.82&&s<.96):(j===0&&n>3);
      const finish=isFirst&&s<.82?cream:bronze;
      const setBack=joint?.045:court?gap:.014;
      e.face(l,r,lo,podium,edge?finish:joint?'#476776':court?clay:'#9b9892',-setBack);
      for(let story=0;story<8;story++){
        if(edge)continue;
        const y=lo+story*step,pane=glazing[(j+story)%glazing.length],project=!joint&&!court&&(story+j*2)%5<2;
        const out=project?.022:-setBack+.0015;
        e.face(l+.009,r-.008,y+.023,y+step-.016,pane,out);
        e.face(l+pitch*.54,l+pitch*.54+.004,y+.023,y+step-.016,'#c4c8c0',out+.001);
        if(project){
          e.jamb(l+.009,y+.020,y+step-.016,out,-setBack,cream);
          e.jamb(r-.008,y+.020,y+step-.016,-setBack,out,shadow);
        }
        if(!court||story<2||story===7)e.face(l,r,y,y+.016,joint?shadow:cream,out+.003);
        else if((j+story)%3===0){
          e.shelf(l,r,y+.02,-setBack,.025,eave);e.face(l,r,y,y+.02,cream,.025);
          e.face(l+.005,r-.005,y+.019,y+.074,'#8f9e9d',.023);
        }
      }
      if(!joint)e.face(l,r,podium-.083,podium,isFirst?finish:cream,.008);
      e.face(l,r,lo-.09,lo,isFirst?finish:bronze,.004);
    }
  });
}
function baseWing(f:FacadePanels,ring:Point[],garage:boolean){
  ring.forEach((a,i)=>{
    const e=elevation(f,a,ring[(i+1)%ring.length]),n=Math.max(1,Math.round(e.len/.195));
    for(let j=0;j<n;j++){
      const x=j*e.len/n,end=(j+1)*e.len/n;
      const door=garage&&i===6&&x>.86&&x<1.26;
      if(door){
        e.face(x,end,grade,.213,'#454949',-.14);
        e.face(x,end,.213,.326,'#babbb2',-.018);
        e.shelf(x,end,grade+.003,-.14,-.018,'#92958d');
        if((j-1)*e.len/n<=.86)e.jamb(x,grade,.213,-.018,-.14,shadow);
        if(end>=1.26)e.jamb(end,grade,.213,-.14,-.018,shadow);
      }else{
        e.face(x,end,grade,.156,'#67828a',-.019);
        e.face(x,end,.156,.326,'#809694',-.019);
        e.face(x,x+.011,grade,.326,'#c5c4b9');
        e.face(x,end,.168,.176,'#bdc3b9',-.013);
      }
    }
  });
}
function lowerBuildings(f:FacadePanels){
  podiumWing(f,west,false);podiumWing(f,east,true);
  // At ground level the end of the west lounge bridges an open passage;
  // the planted roof remains continuous over the gap to the tower lobby.
  baseWing(f,[[.07,-3.87],[.65,-3.87],[1.02,-3.43],[1.02,-2.66],[.07,-2.66]],false);
  baseWing(f,east,true);
  const passage=rectangle(.265,1.02,-2.66,-2.10);
  top(f,passage,.057,'#b2b1a3');
  const ceiling=passage.map(p=>world(...p,.234));
  f.quad(ceiling[0],ceiling[1],ceiling[2],ceiling[3],'#977052');
  for(const [u,v] of [[.29,-2.63],[.97,-2.63],[.97,-2.14]])solid(f,rectangle(u,u+.034,v,v+.035),grade,.327,creamColor);
  // Herbaceous rooftop beds and walking bands are within the mapped terrace.
  for(const [u0,u1,v0,v1] of [[.12,.48,-3.76,-3.24],[.20,.48,-3.15,-2.83],[.33,.64,-2.65,-2.39],
    [.18,1.48,.39,.61],[1.88,2.33,.25,.55],[1.94,2.29,-.13,.12]]){
    solid(f,rectangle(u0,u1,v0,v1),podium,podium+.029,'#b0aa99','#75846c');
  }
  solid(f,[[.57,-3.80],[.69,-3.79],[.966,-3.46],[.966,-3.24],[.57,-3.24]],podium,1.915,'#aeaaa0','#cecab8');
  solid(f,rectangle(1.96,2.47,-.49,-.227),podium,1.711,'#a19f91','#c6c3b3');
}
const creamColor='#c8c6bb';
export function add500Folsom(b:{id:number},root:THREE.Group,windows:Window[]){
  if(b.id!==693629259&&b.id!==438098525)return false;
  const f=new FacadePanels();
  if(b.id===693629259)tower(f,windows);else lowerBuildings(f);
  const mesh=f.mesh(material);
  mesh.name=b.id===693629259?'500 Folsom tower':'500 Folsom podiums';
  root.add(mesh);return true;
}
