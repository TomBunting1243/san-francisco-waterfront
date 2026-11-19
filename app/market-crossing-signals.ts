import * as THREE from 'three';
import type {StreetAssembly} from './street-amenities.ts';
import {marketPedestrianPhase,signalPeriod} from './waterfront-signals.ts';

// SFMTA signals 9323000 and 9323500, both recorded with pedestrian signals
// and accessible pushbuttons. Stations follow pole feet beside the striped
// crossings in the 2024 municipal 8 cm ortho. The two Harry Bridges legs
// have different widths and bearings. Each face looks back across its leg.
// SFMTA's field photographs, SF Planning 2014-001363COA, PDF p.26, show
// the dark blue standards, side-mounted square heads and dark shallow hoods.
// https://data.sfgov.org/Transportation/Traffic-Signals/ybh5-27n2
// https://commissions.sfplanning.org/hpcpackets/2014-001363COA.pdf#page=26
// City imagery layer p2024_rgb8cm from tile.sf.gov.
export const marketPedestrianHeads=[
  {x:-1.0227,z:-3.1742,y:.04099,angle:.010},
  {x:-1.0152,z:-2.3712,y:.04073,angle:Math.PI+.010},
  {x:.5833,z:-3.1742,y:.04064,angle:.057},
  {x:.6288,z:-2.3712,y:.04064,angle:Math.PI+.057},
  {x:-.6439,z:-6.1515,y:.04064,angle:.147},
  {x:-.5303,z:-5.3864,y:.04099,angle:Math.PI+.147},
] as const;
type Head=(typeof marketPedestrianHeads)[number];
const lensY=.156,lensZ=.0071;
function point(h:Head,u:number,y:number,v:number){
  const s=Math.sin(h.angle),c=Math.cos(h.angle);
  return [h.x+c*u+s*v,h.y+y,h.z-s*u+c*v] as const;
}
function sideOffset(h:Head){return h.x<-.8||h.z<-5?-.015:.015;}

export function addMarketPedestrianHousings(a:StreetAssembly){
  const blue='#3a6068',casting='#465251',dark='#262c2c';
  for(const h of marketPedestrianHeads){
    const u=sideOffset(h);
    function box(x:number,y:number,z:number,w:number,d:number,t:number,tone:string){
      const [wx,wy,wz]=point(h,x,y,z);
      const m=a.box(wx,wy,wz,w,d,t,tone);m.rotation.y=h.angle;return m;
    }
    box(0,.0027,0,.012,.0054,.012,blue);
    a.add(new THREE.CylinderGeometry(.0035,.0043,.186,9),blue,h.x,h.y+.098,h.z);
    box(u/2,lensY,0,Math.abs(u),.0038,.005,blue);
    box(u,lensY,0,.039,.034,.0125,casting);
    box(u,lensY,.0064,.035,.030,.0009,dark);
    box(u,lensY+.015,.010,.038,.0013,.010,'#353e40');
    for(const edge of [-1,1])box(u+.018*edge,lensY+.005,.009,.0012,.020,.006,dark);
    // Accessible button, on the side facing the waiting area behind the pole.
    box(0,.062,-.0043,.010,.015,.003,'#495456');
    box(0,.061,-.006,.0058,.0043,.001,'#b59a68');
  }
}

const segments=[0b1111110,0b0110000,0b1101101,0b1111001,0b0110011,0b1011011,0b1011111,0b1110000,0b1111111,0b1111011];
type DisplayPart={kind:'walk'|'hand'|'digit';digit:number;segment:number;start:number;end:number};
// Append to the existing traffic-lens draw. Inactive symbols have degenerate
// indices, so a dark hand can never overwrite an illuminated walking person.
export function appendMarketPedestrianFaces(pos:number[],indices:number[],tints:number[]){
  const ranges:DisplayPart[]=[];
  const walk=new THREE.Color('#fff6e8'),amber=new THREE.Color('#ff8729');
  for(const h of marketPedestrianHeads){
    const draw=(kind:DisplayPart['kind'],shapes:number[][],digit=-1,segment=-1)=>{
      const start=indices.length,color=kind==='walk'?walk:amber;
      for(const coords of shapes){
        const shape:THREE.Vector2[]=[],base=pos.length/3;
        for(let i=0;i<coords.length;i+=2){
          const x=coords[i],y=coords[i+1];shape.push(new THREE.Vector2(x,y));
          pos.push(...point(h,sideOffset(h)+x*.001,lensY+y*.001,lensZ));tints.push(color.r,color.g,color.b);
        }
        for(const tri of THREE.ShapeUtils.triangulateShape(shape,[]))indices.push(...tri.map(n=>base+n));
      }
      ranges.push({kind,digit,segment,start,end:indices.length});
    };
    const disk=(x:number,y:number,r:number)=>Array.from({length:10},(_,i)=>[x+r*Math.cos(i*.2*Math.PI),y+r*Math.sin(i*.2*Math.PI)]).flat();
    const rect=(x:number,y:number,w:number,height:number)=>[x,y,x+w,y,x+w,y+height,x,y+height];
    draw('walk',[disk(-1,9,2.3),[-2,6,1,6,3,1,7,-1,6,-3,1,-1,0,-4,5,-10,3,-12,-2,-6,-5,-11,-8,-10,-4,-3,-3,2,-6,0,-7,1]]);
    draw('hand',[[-10,-7,-13,1,-12,2,-9,-1,-9,7,-7.5,7.5,-7.5,1.7,-7,1.7,-7,9,-5.3,9,-5.3,2,-4.8,2,-4.8,8.2,-3.2,8.2,-3.2,1.6,-2.6,1.6,-2.6,6,-1,6,-1,-3,-3,-8,-8,-9]]);
    for(let digit=0;digit<2;digit++){
      const x=.7+digit*7.8,w=5.6,t=1.45;
      const bars=[rect(x,6,w,t),rect(x+w-t,.4,t,6),rect(x+w-t,-6.3,t,6),rect(x,-7,w,t),
        rect(x,-6.3,t,6),rect(x,.4,t,6),rect(x,-.4,w,t)];
      bars.forEach((bar,segment)=>draw('digit',[bar],digit,segment));
    }
  }
  // The displayed countdown and flash advance only when simulated time moves.
  const first=ranges[0].start,saved=Uint16Array.from(indices.slice(first));let prior=-1;
  return function update(index:THREE.BufferAttribute,elapsed:number,enabled:boolean){
    const phase=marketPedestrianPhase(elapsed),t=((elapsed%signalPeriod)+signalPeriod)%signalPeriod;
    const seconds=phase==='clearance'?Math.ceil(60-t):0,hand=phase==='stop'||phase==='clearance'&&t%1<.5;
    const key=enabled?2+seconds*4+Number(hand)*2+Number(phase==='walk'):0;
    if(key===prior)return;prior=key;
    for(const part of ranges){
      const digit=part.digit===0?Math.floor(seconds/10):seconds%10;
      const lit=enabled&&(part.kind==='walk'?phase==='walk':part.kind==='hand'?hand:
        seconds>0&&(part.digit===1||seconds>=10)&&Boolean(segments[digit]&(64>>part.segment)));
      for(let i=part.start;i<part.end;i++)index.setX(i,lit?saved[i-first]:saved[part.start-first]);
    }
    index.clearUpdateRanges();index.addUpdateRange(first,saved.length);
    index.needsUpdate=true;
  };
}
