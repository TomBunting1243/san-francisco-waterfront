import * as THREE from 'three';
import type {Font} from 'three/addons/loaders/FontLoader.js';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';

type Plan=[number,number];
type Building={id:number;p:number[][]};
type NightWindow={x:number;y:number;z:number;ry:number;w:number;h:number};
const tower=260318167,podium=1474572306,scale=.06;
const ivory='#d8cabe',sand='#c8b7a9',rose='#ae8276',brick='#9a655d',plum='#867875';
const roof='#b7b4a9',metal='#a7a7a0',glass=['#81939a','#798c94','#91a0a2','#75868d','#9ba6a3'];
const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.82});
const interpolate=(a:Plan,b:Plan,t:number):Plan=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];

// u runs along Beale toward Harrison; +v faces Beale. USGS 2023 1.5 m DSM:
// Beale grade ~4.6 m, lower roof ~44 m, upper roof ~80 m, bulkhead ~86 m.
// The flat scene street is the Beale datum. Numbers below are ABOVE this datum.
// https://s3-us-west-2.amazonaws.com/usgs-lidar-public/CA_SanFrancisco_1_B23/ept.json
// Clark Pacific's A, B, STAR2 and STAR3 photos show the rear pool, entry hood,
// five-color GFRC system, punched paired windows and recessed balcony stacks.
// https://www.clarkpacific.com/project/bridgeview-towers/
// https://www.emeraldfund.com/ground-up-residential
// https://sfplanning.s3.amazonaws.com/sfmea/2003.0029E_FEIR.pdf
const angle=Math.atan2(-.1583,.9874),c=Math.cos(angle),s=Math.sin(angle);
function local([x,z]:number[]):Plan{return [((x+54.2)*c+(z+23.25)*s)/scale,(-(x+54.2)*s+(z+23.25)*c)/scale];}
function world([u,v]:Plan,y:number):FacadePoint{return [-54.2+scale*(c*u-s*v),.04+scale*y,-23.25+scale*(s*u+c*v)];}
function strip(p:Plan[],cut:number,larger:boolean) {
  const result:Plan[]=[];
  for(let i=0;i<p.length;i++){
    const a=p[i],b=p[(i+1)%p.length],ina=larger?a[0]>=cut:a[0]<=cut,inb=larger?b[0]>=cut:b[0]<=cut;
    if(ina)result.push(a);
    if(ina!==inb)result.push(interpolate(a,b,(cut-a[0])/(b[0]-a[0])));
  }
  return result;
}
function rectangle(x:number,z:number,w:number,d:number):Plan[]{return [[x,z],[x+w,z],[x+w,z+d],[x,z+d]];}

export function addBridgeview(b:Building,root:THREE.Group,windows:NightWindow[],font?:Font){
  if(b.id!==tower && b.id!==podium)return false;
  const panels=new FacadePanels();
  const ring=b.p.slice(0,-1).map(local);
  if(THREE.ShapeUtils.isClockWise(ring.map(([x,z])=>new THREE.Vector2(x,z))))ring.reverse();
  function lid(p:Plan[],h:number,tint:string,down=false) {
    const tris=THREE.ShapeUtils.triangulateShape(p.map(([x,z])=>new THREE.Vector2(x,z)),[]);
    for(const [a,b,c] of tris)panels.triangle(world(p[a],h),world(p[down?b:c],h),world(p[down?c:b],h),tint);
  }
  function face(a:Plan,b:Plan,lo:number,hi:number,tint:string) {
    panels.quad(world(a,lo),world(a,hi),world(b,hi),world(b,lo),tint);
  }
  function block(p:Plan[],lo:number,hi:number,tint:string,cap=tint) {
    p.forEach((a,i)=>face(a,p[(i+1)%p.length],lo,hi,tint));lid(p,hi,cap);
  }
  function facade(a:Plan,b:Plan,base:number,top:number,levelCount:number,isLow:boolean,street=false) {
    const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
    if(length<.05 || top<=base)return;
    const vector:Plan=[dx/length,dz/length],out:Plan=[vector[1],-vector[0]];
    const pos=(t:number,depth=0):Plan=>[a[0]+vector[0]*t+out[0]*depth,a[1]+vector[1]*t+out[1]*depth];
    const rect=(left:number,right:number,lo:number,hi:number,depth:number,tint:string)=>face(pos(left,depth),pos(right,depth),lo,hi,tint);
    const front=out[1]>.95,back=out[1]<-.95;
    const slots=isLow?[[-19.8,-16.9],[-6.7,-3.8]]:[[10.4,14.1]];
    // Continuous dark slots are recessed balconies with a back wall, side
    // returns, overhead slabs and a metal railing on the open Beale face.
    const cuts=[0,length];
    if(!street && (front||back) && Math.abs(vector[0])>.9){
      for(const pair of slots)for(const u of pair){const t=(u-a[0])/vector[0];if(t>.05&&t<length-.05)cuts.push(t);}
    }
    cuts.sort((a,b)=>a-b);
    const story=(top-base)/levelCount;
    for(let k=1;k<cuts.length;k++){
      const l=cuts[k-1],r=cuts[k],mid=pos((l+r)/2)[0];
      const recessed=!street && (front||back) && slots.some(([lo,hi])=>mid>=lo && mid<=hi);
      const pierColor=street?plum:isLow?(front||back?brick:rose):sand;
      if(recessed){
        rect(l,r,base,top,-1.65,'#647273');
        face(pos(l,0),pos(l,-1.65),base,top,pierColor);
        face(pos(r,-1.65),pos(r,0),base,top,pierColor);
        for(let f=0;f<levelCount;f++){
          const y=base+f*story;
          const slab=[pos(l,0),pos(r,0),pos(r,-1.65),pos(l,-1.65)];
          lid(slab,y+.17,metal);lid(slab,y,'#777671',true);
          rect(l,r,y,y+.17,0,ivory);rect(l,r,y+.17,y+.88,-.08,'#86969a');rect(l,r,y+.88,y+.97,-.08,metal);
          rect(l+.18,r-.18,y+.24,y+story-.29,-1.63,glass[(k+f)%5]);
        }
        continue;
      }
      const count=Math.max(1,Math.round((r-l)/(street?4.4:3.65))),pitch=(r-l)/count;
      if(street){
        rect(l,r,base,top,0,pierColor);
      }else{
        rect(l,r,base,top,0,pierColor);
        if(isLow)rect(l,r,top-2*story,top,.02,ivory);
        else rect(l,r,top-story,top,.02,ivory);
        for(const y of [base,base+story*3,top-2*story,top-.28])if(y<top)rect(l,r,y,Math.min(y+.12,top),.065,ivory);
      }
      if(pitch<1.35)continue;
      for(let bay=0;bay<count;bay++){
        const left=l+pitch*bay+.22*pitch,right=l+pitch*(bay+1)-.16*pitch;
        for(let f=0;f<levelCount;f++){
          const y=base+f*story,low=y+story*(street?.08:.23),high=y+story*(street?.88:.81);
          const offset=.035;
          rect(left,right,low,high,offset,glass[(bay+Math.floor(f/3)+k)%5]);
          rect(left,right,low-.075,low,offset+.016,ivory);
          const center=(left+right)/2;
          rect(center-.045,center+.045,low,high,offset+.006,metal);
          if(street||f%2===1)rect(left,right,high-.42,high-.36,offset+.006,metal);
          if((bay+f*3+k)%9===0){
            const [x,h,z]=world(pos(center,(offset+.033)),(low+high)/2);
            const wp=world(pos(left),0),wq=world(pos(right),0);
            windows.push({x,y:h,z,ry:Math.atan2(wq[2]-wp[2],wp[0]-wq[0]),w:(right-left)*scale*.87,h:(high-low)*scale*.89});
          }
        }
      }
    }
  }
  if(b.id===podium){
    const top=9.0;
    for(let i=0;i<ring.length;i++){
      const a=ring[i],b=ring[(i+1)%ring.length];facade(a,b,0,top,2,false,true);
    }
    lid(ring,top,'#b5ada1');
    // NAIP 2022 imagery locates the narrow aqua pool on the rear corner
    // terrace, backing the shorter building. Beale fronts the opposite side.
    lid(rectangle(-47.7,-12.7,16.6,3.7),top+.03,'#ddd3bd');
    lid(rectangle(-47.2,-12.3,15.5,2.85),top+.06,'#7faaa7');
    // Paired glazing in the retail bays behind the row of tapered pale awnings.
    for(const u of [-24,-18.6,-13.2,-7.8,-2.4,3,20.9]){
      const left=u-1.45,right=u+1.45;
      panels.quad(world([left,15.16],2.5),world([left,14.16],5.85),world([right,14.16],5.85),world([right,15.16],2.5),'#d9d4c4');
      face([right,15.16],[left,15.16],2.38,2.5,metal);
    }
    // Glazed lobby doors, bronze jambs, projecting glass marquee and its fascia.
    const entry=13.8;
    face([entry+2.6,14.15],[entry-2.6,14.15],0,8.1,sand);
    face([entry+2.1,14.19],[entry-2.1,14.19],.06,5.7,'#677d81');
    for(const x of [entry-1.95,entry,entry+1.95])face([x+.07,14.22],[x-.07,14.22],.06,5.7,metal);
    face([entry+2.1,14.22],[entry-2.1,14.22],3.2,3.34,metal);
    block(rectangle(entry-3,14.0,6,1.9),4.22,4.34,'#586766','#969f9b');
    for(let i=0;i<6;i++)block(rectangle(entry-2.85+i*1.14,14.0,.09,1.93),4.34,4.40,'#626660');
    if(font){
      // The completion photo shows individual pale letters suspended below the hood.
      const sign=new THREE.ShapeGeometry(font.generateShapes('BRIDGEVIEW',.60),3);
      sign.computeBoundingBox();
      const width=sign.boundingBox!.max.x-sign.boundingBox!.min.x;
      const pos=sign.getAttribute('position'),index=sign.index;
      function letterPoint(i:number){
        const u=entry+(pos.getX(i)-sign.boundingBox!.min.x-width*.5)*Math.min(1,5.55/width);
        return world([u,15.93],3.57+pos.getY(i));
      }
      if(index)for(let i=0;i<index.count;i+=3)
        panels.triangle(letterPoint(index.getX(i)),letterPoint(index.getX(i+1)),letterPoint(index.getX(i+2)),'#d9cdb6');
      sign.dispose();
    }

  }else{
    // The OSM upper part contains both towers in one undifferentiated outline.
    // Breaks at u~1 and ~25 follow the LiDAR return rather than the parcel edge.
    const low=strip(ring,.7,false),high=strip(strip(ring,.7,true),25.1,false),nose=strip(ring,25.1,true);
    const wings=[{p:low,h:39.6,n:11,low:true},{p:high,h:75.2,n:22,low:false},{p:nose,h:69.0,n:20,low:false}];
    for(const wing of wings){
      for(let i=0;i<wing.p.length;i++){
        const a=wing.p[i],b=wing.p[(i+1)%wing.p.length];
        const joint=Math.abs(a[0]-b[0])<.001;
        let base=9;
        if(joint && Math.abs(a[0]-.7)<.01)base=39.6;
        if(joint && Math.abs(a[0]-25.1)<.01)base=69;
        if(wing.h>base)facade(a,b,base,wing.h,Math.max(1,Math.round(wing.n*(wing.h-base)/(wing.h-9))),wing.low);
      }
      lid(wing.p,wing.h,roof);
    }
    // Shallow octagonal upper pavilion on the low wing's southern end.
    const oct:Plan[]=[[-36,-3.8],[-33.5,-5.8],[-25,-5.8],[-22.8,-3.7],[-22.8,6.5],[-25.3,9.7],[-32,9.7],[-36,6]];
    oct.forEach((a,i)=>facade(a,oct[(i+1)%oct.length],39.6,43.2,1,false));lid(oct,43.2,roof);
    block(rectangle(-13,-5.8,11,7),39.6,44.1,'#b3aca1');
    // Northern chamfered roof and raised central fan room behind its parapet.
    block(strip(strip(nose,26,true),38.2,false).map(([x,z])=>[x,1+(z-1)*.68]),69,74.9,ivory,roof);
    block(rectangle(3.3,-9.5,17.2,20.5),75.2,77.55,ivory,roof);
    const crown=rectangle(6,-8.9,11.6,19.1);
    crown.forEach((a,i)=>facade(a,crown[(i+1)%4],77.55,81.4,1,false));lid(crown,81.4,'#b4b0a8');
  }
  const mesh=panels.mesh(material);mesh.geometry.userData.paintVertices=true;
  mesh.name=b.id===tower?'Bridgeview residential wings 260318167':'Bridgeview Beale podium 1474572306';
  root.add(mesh);return true;
}
