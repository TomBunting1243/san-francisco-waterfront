import * as THREE from 'three';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';

type Plan=[number,number];
type Building={id:number;p:number[][]};
type Window={x:number;y:number;z:number;ry:number;w:number;h:number};
const scale=.06,angle=Math.atan2(-.1583,.9874),c=Math.cos(angle),s=Math.sin(angle);
const pearl='#cecec5',pale='#d8d8ce',stone='#aaa99f',frame='#b7bdb7',slab='#c4c7be',roof='#b8b9ad';
const lights=['#85969a','#98a7a5','#8a999d','#a3ada7','#7e8e93'];
const paint=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.82});
function world([u,v]:Plan,y:number):FacadePoint{
  return [-47.5+scale*(c*u-s*v),.04+scale*y,-24.6+scale*(s*u+c*v)];
}
function local([x,z]:number[]):Plan{return [((x+47.5)*c+(z+24.6)*s)/scale,(-(x+47.5)*s+(z+24.6)*c)/scale];}
const lerp=(a:Plan,b:Plan,t:number):Plan=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
const rect=(x:number,z:number,w:number,d:number):Plan[]=>[[x,z],[x+w,z],[x+w,z+d],[x,z+d]];

// Historic subdivision of block 3747 lot 91, now 3747094. The single OSM way
// includes both 20-story wings and the lower connecting podium.
// https://sfbos.org/ftp/uploadedfiles/bdsupvrs/motions01/m01-0063.pdf
// UDR drone photos 03/07: paired stepped floor plates, punched side piers,
// balcony returns, triangular roof screens and curved glazed Beale entry.
// https://www.udr.com/san-francisco-bay-area-apartments/san-francisco/388-beale/photos-and-tours/
// 2023 DSM at 1.5 m + 2022 NAIP: front center of each podium bay is on Beale
// at +v. Clipped terrace outlines below are in metres above the 5.4 m street datum.
// https://s3-us-west-2.amazonaws.com/usgs-lidar-public/CA_SanFrancisco_1_B23/ept.json
export function add388Beale(b:Building,root:THREE.Group,windows:Window[]){
  if(b.id!==288645692)return false;
  const f=new FacadePanels();
  function ccw(ring:Plan[]){return THREE.ShapeUtils.isClockWise(ring.map(p=>new THREE.Vector2(...p)))?ring.slice().reverse():ring;}
  function surface(p:Plan[],height:(p:Plan)=>number,tint:string,down=false){
    const faces=THREE.ShapeUtils.triangulateShape(p.map(p=>new THREE.Vector2(...p)),[]);
    for(const [a,b,c] of faces){
      const vertex=(i:number)=>world(p[i],height(p[i]));
      f.triangle(vertex(a),vertex(down?b:c),vertex(down?c:b),tint);
    }
  }
  function lid(p:Plan[],h:number,tint:string,down=false){surface(p,()=>h,tint,down);}
  function wall(a:Plan,b:Plan,lo:number,hi:number,tint:string){
    f.quad(world(a,lo),world(a,hi),world(b,hi),world(b,lo),tint);
  }
  function block(p:Plan[],lo:number,hi:number,color:string,top=color){
    const ring=ccw(p);ring.forEach((a,i)=>wall(a,ring[(i+1)%ring.length],lo,hi,color));lid(ring,hi,top);
  }
  function facade(a:Plan,b:Plan,lo:number,hi:number,stories:number,style:'punched'|'ribbon'|'balcony'|'street'){
    const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
    if(len<.05)return;
    const pos=(t:number,out=0):Plan=>[a[0]+(dx*t+dz*out)/len,a[1]+(dz*t-dx*out)/len];
    const panel=(l:number,r:number,base:number,head:number,out:number,color:string)=>wall(pos(l,out),pos(r,out),base,head,color);
    const story=(hi-lo)/stories;
    if(style==='balcony'){
      panel(0,len,lo,hi,-1.15,'#7e8b8c');
      wall(pos(0),pos(0,-1.15),lo,hi,pearl);wall(pos(len,-1.15),pos(len),lo,hi,pearl);
      for(let j=0;j<stories;j++){
        const y=lo+story*j,balcony=[pos(0,.63),pos(len,.63),pos(len,-1.15),pos(0,-1.15)];
        lid(balcony,y+.18,slab);lid(balcony,y,'#92998f',true);
        panel(0,len,y,y+.18,.63,pale);
        for(const t of [0,len])wall(pos(t,-.03),pos(t,.63),y,y+.18,pale);
        panel(.13,len-.13,y+.2,y+story-.35,-1.12,lights[j%5]);
        panel(0,len,y+1.08,y+1.15,.60,frame);
        for(let t=.04;t<len;t+=1.32)panel(t,Math.min(t+.05,len),y+.18,y+1.10,.60,frame);
      }
      return;
    }
    const street=style==='street',ribbon=style==='ribbon';
    const bays=Math.max(1,Math.round(len/(street?4.7:ribbon?2.15:4.35))),pitch=len/bays;
    panel(0,len,lo,hi,0,street?stone:pearl);
    if(pitch<1.02)return;
    for(let bay=0;bay<bays;bay++){
      const l=(bay+(ribbon?.03:street?.10:.12))*pitch,r=(bay+1-(ribbon?.04:street?.10:.14))*pitch;
      for(let j=0;j<stories;j++){
        const floor=lo+j*story,base=floor+story*(street?.08:ribbon?.10:.24),head=floor+story*(street?.87:.84);
        panel(l,r,base,head,.028,lights[(bay*3+Math.floor(j/2))%5]);
        if(!ribbon){const split=l+(r-l)*.54;panel(split-.042,split+.042,base,head,.045,frame);}
        if(ribbon||street)panel(l,r,head-.43,head-.37,.045,frame);
        if((bay+3*j+Math.round(len))%11===0){
          const [x,y,z]=world(pos((l+r)/2,.068),(base+head)/2),w0=world(a,0),w1=world(b,0);
          windows.push({x,y,z,ry:Math.atan2(w1[2]-w0[2],w0[0]-w1[0]),w:(r-l)*scale*.87,h:(head-base)*scale*.88});
        }
      }
    }
    for(let j=1;j<stories;j+=ribbon?1:4){const y=lo+j*story;panel(0,len,y,y+.10,.049,slab);}
  }

  // Stand the frontage on its actual ground envelope. The orthophoto and UDR
  // oblique show planted open space between the buildings above the low plinth.
  const plinth=ccw(b.p.slice(0,-1).map(local));
  for(let i=0;i<plinth.length;i++)facade(plinth[i],plinth[(i+1)%plinth.length],0,12.65,3,'street');
  lid(plinth,12.65,'#adaea1');
  // The entrance bows forward on both sides of a central, pitched glass bay.
  const arc:Plan[]=[[-18.6,13.1],[-14,15.1],[-9,16.9],[-4.8,17.9],[.8,17.9],[5.1,17.1],[10.7,15.2],[14,13.1]];
  const entry=ccw([...arc,[11.5,8.0],[-15.5,8.0]]);
  for(let i=0;i<entry.length;i++)facade(entry[i],entry[(i+1)%entry.length],12.65,15.8,1,'punched');
  lid(entry,15.8,roof);
  const portal:Plan[]=[[-6.4,18.15],[2.6,18.15],[2.6,10.3],[-6.4,10.3]];
  const ridge=(p:Plan)=>17.2+1.65*(1-Math.abs(p[0]+1.9)/4.5);
  for(const p of [rect(-6.4,10.3,4.5,7.85),rect(-1.9,10.3,4.5,7.85)])surface(p,ridge,'#c3c2b5');
  for(const [x,y] of [[-6.4,-1.9],[-1.9,2.6]]){
    const a:Plan=[y,18.15],b:Plan=[x,18.15];
    f.quad(world(a,0),world(a,ridge(a)),world(b,ridge(b)),world(b,0),'#798984');
    for(let h=3.1;h<17;h+=3)wall([a[0],18.18],[b[0],18.18],h,h+.13,frame);
  }
  for(const x of [-6.4,2.6])block(rect(x-.20,10.3,.4,8.04),0,17.2,pale);
  for(const x of [-4.85,-1.90,1.05])wall([x+.065,18.22],[x-.065,18.22],0,ridge([x,0]),frame);
  for(let i=1;i<portal.length;i++){
    const a=portal[i],b=portal[(i+1)%portal.length];
    f.quad(world(b,12.65),world(b,ridge(b)),world(a,ridge(a)),world(a,12.65),pearl);
  }

  // Roof and lower terrace outlines traced against the DSM. The two related
  // footprints face each other; each has a sawtooth river-facing shoulder and
  // a stepped diagonal rear. Distances are from the court centerline.
  const broad:Plan[]=[[6.5,-9.9],[7,-13.7],[11.4,-13.7],[11.4,-15.6],[21.7,-15.6],
    [21.7,-13.1],[25.0,-13.1],[25,-10.1],[28.1,-10.1],[28.1,-7.25],[31.2,-7.25],[31.2,-4.2],
    [34.3,-4.2],[34.3,-1.3],[37.7,-1.3],[37.7,1.9],[42.6,1.9],[42.6,18.3],[18.25,18.3],
    [18.25,15.4],[14.75,15.4],[14.75,12.35],[11.1,12.35],[11.1,9.1],[6.5,9.1]];
  const upper:Plan[]=[[6.75,-8.6],[10.9,-8.6],[10.9,-11.8],[14.45,-11.8],[14.45,-15.4],
    [21.4,-15.4],...broad.slice(5,16),[42.4,1.9],[42.4,12.9],[37.3,12.9],[37.3,15.2],[35.4,15.2],[35.4,18.45],
    [21.8,18.45],[21.8,15.3],[18.0,15.3],[18.0,12.2],[13.6,12.2],[13.6,8.65],[10.5,8.65],[10.5,6.1],[6.75,6.1]];
  const pent:Plan[]=[[12.6,-9.0],[23.9,-9.0],[23.9,-5.9],[27.7,-5.9],[27.7,-2.8],
    [30.5,-2.8],[30.5,1.0],[35.9,1.0],[35.9,13.4],[27.0,13.4],[27,10.7],[23,10.7],[23,7.2],
    [19.4,7.2],[19.4,3.8],[16.4,3.8],[16.4,.5],[12.6,.5]];
  for(const side of [-1,1]){
    const place=([w,v]:Plan):Plan=>[-2.6+side*w,v+(side===1?.36:0)];
    function tier(points:Plan[],base:number,top:number,stories:number){
      const p=points.map(place);
      for(let i=0;i<p.length;i++){
        const j=(i+1)%p.length,mid=lerp(points[i],points[j],.5),length=Math.hypot(points[i][0]-points[j][0],points[i][1]-points[j][1]);
        const alongBeale=Math.abs(points[i][0]-points[j][0])>Math.abs(points[i][1]-points[j][1]);
        const inset=length<6 && length>2.5 && (alongBeale?mid[0]<20&&mid[1]>0:mid[1]<0);
        const style=inset?'balcony':mid[0]<15.8||mid[1]<-9||length<8?'ribbon':'punched';
        facade(side===1?p[i]:p[j],side===1?p[j]:p[i],base,top,stories,style);
      }
      lid(p,top,roof);
    }
    tier(broad,12.65,47.6,12);
    tier(upper,47.6,59.6,4);
    tier(pent,59.6,62.3,1);
    // The owner aerial shows *sloping screens above* the flat penthouse decks.
    // A sloping top across the full tower would hide the walkable roof terraces.
    function enclosure(points:Plan[],base:number,low:number,high:number){
      const p=ccw(points.map(place));
      const values=points.map(([w,v])=>w+v),min=Math.min(...values),max=Math.max(...values);
      const cap=([x,z]:Plan)=>low+(high-low)*(((x+2.6)/side+z-(side===1?.36:0))-min)/(max-min);
      p.forEach((a,i)=>{const b=p[(i+1)%p.length];f.quad(world(a,base),world(a,cap(a)),world(b,cap(b)),world(b,base),pale);});
      surface(p,cap,'#c7c6bb');
    }
    enclosure([[12.9,-8.4],[23.4,-8.4],[23.7,-4.8],[18,-.1],[13.1,-2.8]],62.3,62.6,65);
    enclosure([[25.4,5.5],[29,1.2],[35.6,3],[35.6,13.1],[28.4,12.8]],62.3,62.7,65.1);
    enclosure(rect(18.4,-3.55,10.7,10.35),62.3,65,67.15);
    const stack=rect(21.3,1.0,1.65,1.45).map(place);
    block(stack,65.35,73.45,'#c5c5bc');
  }

  // 2022 orthophoto and UDR's frontal oblique show a sheltered green court.
  // The planted crown heights are estimated; the clear slot continues above them.
  for(const [x,z,r,h] of [[-3.1,-7,2.5,5.2],[.2,-4,2,5],[-4.6,-1,2,5.4],[-1.6,2,2.1,4.6],[.25,5.5,1.85,4.2]]){
    block(rect(x-.14,z-.14,.28,.28),12.65,12.65+h*.85,'#807768');
    const edges:Plan[]=Array.from({length:7},(_,i)=>[x+Math.cos(i*2*Math.PI/7)*r,z+Math.sin(i*2*Math.PI/7)*r]);
    for(let i=0;i<edges.length;i++){
      const j=(i+1)%edges.length;
      f.triangle(world(edges[i],12.65+h*.71),world([x,z],12.65+h),world(edges[j],12.65+h*.71),i%2?'#818b73':'#778574');
    }
  }
  const mesh=f.mesh(paint);mesh.geometry.userData.paintVertices=true;mesh.name='388 Beale · Avalon Towers by the Bay 288645692';
  root.add(mesh);return true;
}
