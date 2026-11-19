import * as THREE from 'three';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';

type Point=[number,number];
type Pane={x:number;y:number;z:number;ry:number;w:number;h:number};
const angle=-Math.atan2(.368,2.485),c=Math.cos(angle),s=Math.sin(angle);
const grade=.045,scale=.06;
const at=([u,v]:Point,h:number):FacadePoint=>[-12.423+scale*(u*c-v*s),grade+scale*h,-40.350+scale*(u*s+v*c)];
const rect=(u:number,v:number,w:number,d:number):Point[]=>[[u,v],[u+w,v],[u+w,v+d],[u,v+d]];
const full:Point[]=[[0,0],[83.78,0],[83.78,24.91],[37.78,24.91],[37.78,31.7],[18.06,31.7],[18.06,35.84],[0,35.84]];
// The two halves of the 21st floor are offset across First Street's depth.
// Dimensions follow the local 1.5 m USGS roof grid and the leasing plan.
const shaft:Point[]=[[0,3.4],[20.5,3.4],[20.5,0],[41.9,0],[41.9,26],[23.7,26],[23.7,30],[18,30],[18,34.5],[0,34.5]];
const upper:Point[]=[[.6,6.8],[20.5,6.8],[20.5,3.0],[41.5,3.0],[41.5,26.4],[22.2,26.4],[22.2,32.2],[.6,32.2]];
const granite=['#cbb6ad','#c6b2aa','#d5c0b6'],glass=['#586673','#58616c','#515d69','#64717b'];
const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.75});

/** 455 Market (Market/First). Parent is the shared lower building, child the
 * stepped rear tower. Dispatch both before fallback and imported LiDAR caps. */
export function add455Market(b:{id:number},root:THREE.Group,windows:Pane[]){
  const base=b.id===159280395;
  if(!base&&b.id!==1410934053)return false;
  const f=new FacadePanels();
  function cap(ring:Point[],h:number,color:string){
    for(const [a,b,c] of THREE.ShapeUtils.triangulateShape(ring.map(([u,v])=>new THREE.Vector2(u,v)),[]))
      f.triangle(at(ring[a],h),at(ring[c],h),at(ring[b],h),color);
  }
  function wall(a:Point,b:Point,low:number,high:number,col:string){
    f.quad(at(a,low),at(a,high),at(b,high),at(b,low),col);
  }
  function unit(ring:Point[],low:number,high:number,side:string,roof:string){
    ring.forEach((a,i)=>wall(a,ring[(i+1)%ring.length],low,high,side));cap(ring,high,roof);
  }
  // Ground floor and mezzanine share square granite piers. The arcade on the
  // Market end has a two-height open entrance at the northeast (plaza) end.
  function facade(ring:Point[],low:number,high:number,rows:number,lobby=false,crown=false){
    ring.forEach((a,i)=>{
      const b=ring[(i+1)%ring.length],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
      const spot=(t:number,d:number):Point=>[a[0]+dx*t+dz*d/len,a[1]+dz*t-dx*d/len];
      const strip=(l:number,r:number,lo:number,hi:number,d:number,color:string)=>wall(spot(l,d),spot(r,d),lo,hi,color);
      const bays=Math.max(1,Math.round(len/4.6));
      for(let k=0;k<bays;k++){
        const left=k/bays,right=(k+1)/bays,t=(k+.5)/bays;
        const gap=Math.min(.48/len,(right-left)*.15),l=left+gap,r=right-gap;
        const port=lobby&&a[0]>83&&b[0]>83&&t>.81;
        const stone=granite[(k+i)%3];
        strip(left,l,low,high,.015,stone);strip(r,right,low,high,.015,stone);
        if(lobby){
          const depth=port?-4.4:-.65;
          for(const [edge,reverse] of [[l,0],[r,1]]){
            const front=spot(edge,.015),back=spot(edge,depth);
            wall(reverse?back:front,reverse?front:back,low,high,'#aa958b');
          }
          f.quad(at(spot(l,0),high),at(spot(r,0),high),at(spot(r,depth),high),at(spot(l,depth),high),'#b9a99b');
          strip(l,r,low,high,depth,port?'#6e6960':'#627174');
          strip(t-.027/len,t+.027/len,low,high,depth+.02,'#9a9a94');
          strip(l,r,low+2.55,low+2.67,depth+.02,'#989c98');
          if(!port)strip(l,r,low+3.35,low+4.11,depth+.04,'#bfaaa0');
          continue;
        }
        const interval=(high-low)/rows;
        for(let j=0;j<rows;j++){
          const lo=low+j*interval,hi=lo+interval;
          const sill=lo+interval*.22,head=hi-interval*.22;
          const pigment=glass[(j*3+k+i)%glass.length];
          strip(l,r,lo,sill,-.01,stone);strip(l,r,head,hi,-.01,stone);
          // Slightly projecting front and angled side lights catch different sky tones.
          const bevel=Math.min(.45/len,(r-l)*.18),projection=.25;
          wall(spot(l,-.01),spot(l+bevel,projection),sill,head,glass[(k+i+2)%4]);
          wall(spot(l+bevel,projection),spot(r-bevel,projection),sill,head,pigment);
          wall(spot(r-bevel,projection),spot(r,-.01),sill,head,glass[(j+i+3)%4]);
          const sloped=crown&&j===rows-1,top=sloped?head+.26:head;
          f.quad(at(spot(l,-.01),top),at(spot(l+bevel,projection),head),at(spot(r-bevel,projection),head),at(spot(r,-.01),top),sloped?'#73828d':'#abaaa4');
          if((j*11+k*7+i*3)%13===0){
            const [x,y,z]=at(spot(t,projection+.012),(sill+head)/2);
            const p=at(a,0),q=at(b,0);
            windows.push({x,y,z,ry:Math.atan2(q[2]-p[2],p[0]-q[0]),w:(r-l-2*bevel)*len*scale*.86,h:(head-sill)*scale*.88});
          }
        }
      }
    });
  }
  if(base){
    facade(full,0,7.95,0,true);
    facade(full,7.95,26.15,5);
    cap(full,26.15,'#b8b4a9');
    const wing=rect(41.9,.82,40.99,23.18);
    facade(wing,26.15,29.85,1,false,true);cap(wing,29.85,'#b6b1a8');
    const attic=rect(41.9,2.55,38.85,19.75);
    facade(attic,29.85,33.55,1,false,true);cap(attic,33.55,'#aaa8a1');
    // Screened plant, with a lower exposed roof between the street parapet and core.
    unit(rect(53,6.1,26.8,14.5),33.55,36.55,'#bdada3','#bbbcb5');
    for(const v of [2.55,21.75])unit(rect(42,v,38.7,.55),33.55,36.82,'#cfbcb0','#c7b8af');
    unit(rect(80.16,3.1,.59,18.65),33.55,36.82,'#c7b2a9','#cebbb3');
  }else{
    facade(shaft,26.15,62.3,9);
    cap(shaft,62.3,'#ada99e');
    facade(upper,62.3,91.05,7,false,true);
    // Deep granite crown/cooling louvers rise through the final office datum.
    upper.forEach((a,i)=>{
      const b=upper[(i+1)%upper.length],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
      wall(a,b,91.05,96.88,'#cdb9af');
      const bays=Math.max(1,Math.round(len/4.6));
      const p=(t:number,d:number):Point=>[a[0]+dx*t+dz*d/len,a[1]+dz*t-dx*d/len];
      for(let j=0;j<bays;j++){
        wall(p((j+.14)/bays,.024),p((j+.86)/bays,.024),91.67,96.53,'#a6988f');
        for(let rib=0;rib<4;rib++){
          const l=(j+.17+rib*.17)/bays;wall(p(l,.038),p(l+.055/bays,.038),91.74,96.49,'#cbbdb1');
        }
      }
    });
    cap(upper,96.36,'#b9b8b0');
    for(const [u,v,w,d,h] of [[13.4,17,5.1,7.7,99.05],[18.5,13.8,12.0,5.9,98.9],[22.8,4.9,15.9,2.15,100.45]]){
      unit(rect(u,v,w,d),96.36,h,'#aca9a1','#c4c4bb');
    }
  }
  const mesh=f.mesh(material);mesh.name=base?'455 Market Street low wing and retail arcade':'455 Market Street stepped rear office tower';
  root.add(mesh);return true;
}
