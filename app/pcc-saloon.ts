import type {CabGeometry,CabPoint} from './ride-interior.ts';
import {pccCabDoorZ,pccFrontLeafWidth,pccExitSpacing} from './pcc-layout.ts';
import {pccTreads} from './pcc-entrance.ts';

// Car 1051's interior photographed by Elizabeth K. Joseph, September 2011:
// https://www.flickr.com/photos/pleia2/6161168575/
// This is an original drawing in metres. Individual fittings and riders are interpreted.
export const pccCabLeft=-.90,pccCabRight=1.506;
export const pccCabFront=pccCabDoorZ-2*pccFrontLeafWidth;
export function addPccSaloon(g:CabGeometry){
  const left=pccCabLeft,right=pccCabRight,front=pccCabFront,back=13.49,center=(left+right)/2;
  const floor=-1.19,upholstery='#49645a',chrome='#b5beb6',cream='#c9c6a7';
  function band(a:CabPoint[],b:CabPoint[],tint:string,light:number){
    for(let i=0;i<a.length;i++){
      const j=(i+1)%a.length;g.panel(a[i],a[j],b[j],b[i],tint,light);
    }
  }
  function oval(x:number,y:number,z:number,rx:number,rz:number,n=10):CabPoint[]{
    return Array.from({length:n},(_,i)=>[x+rx*Math.cos(i*2*Math.PI/n),y,z+rz*Math.sin(i*2*Math.PI/n)]);
  }
  function roundedPad(x:number,y:number,z:number,halfWidth:number,halfDepth:number,corner:number):CabPoint[]{
    return [[-1,-1],[1,-1],[1,1],[-1,1]].flatMap(([sx,sz])=>{
      const a:CabPoint=[x+sx*(halfWidth-corner),y,z+sz*halfDepth];
      const b:CabPoint=[x+sx*halfWidth,y,z+sz*(halfDepth-corner)];
      return sx===sz?[b,a]:[a,b];
    });
  }
  function cap(ring:CabPoint[],tint:string,light:number){
    for(let j=1;j<ring.length-1;j+=2)g.panel(ring[0],ring[j],ring[j+1],ring[Math.min(j+2,ring.length-1)],tint,light);
  }
  function rail(a:CabPoint,b:CabPoint,r:number){
    const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],length=Math.hypot(dx,dy,dz);
    const norm=Math.hypot(dx,dy);
    const u=norm?[-dy/norm,dx/norm,0]:[1,0,0];
    const v=[-dz*u[1]/length,dz*u[0]/length,(dx*u[1]-dy*u[0])/length];
    function ring(p:CabPoint):CabPoint[]{
      return Array.from({length:6},(_,i)=>{
        const co=r*Math.cos(i*Math.PI/3),si=r*Math.sin(i*Math.PI/3);
        return [p[0]+co*u[0]+si*v[0],p[1]+co*u[1]+si*v[1],p[2]+co*u[2]+si*v[2]];
      });
    }
    band(ring(a),ring(b),chrome,.56);
  }
  function globe(x:number,y:number,z:number,r:number){
    const rim=oval(x,y,z,r,r),lip=oval(x,y-.019,z,r*1.05,r*1.05);
    const neck=oval(x,y-.033,z,r*.91,r*.91),lens=oval(x,y-.067,z,r*.70,r*.70);
    band(rim,lip,'#8c9991',.65);band(lip,neck,'#d7d6be',.84);
    band(neck,lens,'#fff1ce',2.2);cap(lens,'#ffefcf',2.35);
  }
  function seat(x:number,z:number,w:number){
    const lower=roundedPad(x,-.786,z-.20,w*.49,.225,.035);
    const waist=roundedPad(x,-.746,z-.20,w*.50,.231,.047);
    const top=roundedPad(x,-.715,z-.20,w*.47,.206,.057);
    band(lower,waist,'#344b43',.50);band(waist,top,upholstery,.57);cap(top,'#607b69',.64);
    const base=roundedPad(x,-.754,z+.005,w*.475,.055,.022);
    const shoulder=roundedPad(x,-.212,z+.082,w*.475,.059,.026);
    const crest=roundedPad(x,-.174,z+.088,w*.433,.035,.022);
    band(base,shoulder,upholstery,.52);band(shoulder,crest,'#60796a',.62);cap(crest,'#586e62',.6);
    const r=w*.45;
    rail([x-r,-.28,z+.084],[x-r+.035,-.165,z+.09],.013);
    rail([x-r+.035,-.165,z+.09],[x+r-.035,-.165,z+.09],.013);
    rail([x+r-.035,-.165,z+.09],[x+r,-.28,z+.084],.013);
    g.cross(z-.18,x-.047,x+.047,floor,-.78,'#43524b',.66);
  }
  // The cab and both exits share the model's side elevation. Each tread
  // replaces the cabin floor across its own well.
  const wellCenters=[pccCabDoorZ,pccCabDoorZ+pccExitSpacing];
  const half=2*pccFrontLeafWidth,lip=right,inside=lip-.84,jamb=.035;
  const sideSpans=[[front,wellCenters[0]-half],[wellCenters[0]+half,wellCenters[1]-half],[wellCenters[1]+half,back]];
  for(const [a,b] of sideSpans)if(b>a)g.level(floor,left,right,a,b,'#53564a',.44);
  for(const z of wellCenters){
    const start=z-half,end=z+half;
    g.level(floor,left,inside,start,end,'#53564a',.44);
    // Fixed lintel and jambs meet the head and hinges of the moving leaves.
    g.side(right,.38-2.15+2.08,.554,start,end,'#c3c2a4',.66);
    for(const [a,b] of [[start-jamb,start],[end,end+jamb]]){
      if(b>front)g.side(right,floor,.554,Math.max(front,a),b,'#a9ab95',.66);
    }
    for(const side of [start,end])g.cross(side,inside,lip,.38-2.15,floor,'#72816b',.58);
    for(const [k,h] of pccTreads.entries()){
      const edge=lip-.21*k,y=h-2.15;
      g.level(y,edge-.21,edge-.029,start,end,'#767a67',.70);
      g.level(y,edge-.029,edge,start,end,'#beb496',.82);
      g.side(edge,k?pccTreads[k-1]-2.15:y-.06,y,start,end,'#515d50',.52);
    }
  }
  // Transverse ribs follow the formed roof between the clerestory and center spine.
  const arch=[[left-center,.586],[-1.15,.75],[-.95,.87],[-.55,.953],[0,.979],[.55,.953],[.95,.87],[1.15,.75],[right-center,.586]];
  for(let j=1;j<arch.length;j++){
    const [[a,y],[b,h]]=arch.slice(j-1,j+1);
    const roof=(lo:number,hi:number,inset=0,tint=cream)=>g.panel([center+a,y-inset,lo],[center+b,h-inset,lo],
      [center+b,h-inset,hi],[center+a,y-inset,hi],tint,.88);
    roof(front,back);
    // Both end panels terminate on the same arch vertices as the roof.
    const brow=(u:number,h:number):CabPoint=>{
      const crown=Math.min(1,(h-.586)/.16);
      return [center+u,.53+.17*crown,front-.22*(1-Math.abs(u)/((right-left)/2))];
    };
    g.panel([center+a,y,front],[center+b,h,front],brow(b,h),brow(a,y),'#c9c6a7');
    g.panel([center+a,y,back],[center+b,h,back],[center+b,.46,back],[center+a,.46,back],'#b6b39a',.66);
    for(let i=0;i<8;i++)roof(.77+i*1.72,.80+i*1.72,.007,'#aaa98f');
  }
  for(let i=0;i<8;i++)for(const x of [center-.73,center+.73])globe(x,.896,1.14+1.60*i,.116);
  for(const z of [3.3,7.7,11.75]){
    const upper=oval(center,.973,z,.27,.27,14),lower=oval(center,.917,z,.256,.256,14);
    band(upper,lower,'#9caa9c',.7);cap(lower,'#737f74',.67);globe(center,.910,z,.127);
  }
  const cards=['#8b643f','#53716d','#a37159','#777f61'];
  for(const [x,inward] of [[left,1],[right,-1]]){
    // Skin the wall only between jambs. Construct each upper window as a
    // single aperture with chamfered corners, including bays cut by a door.
    const spans=inward>0?[[front,back]]:sideSpans.filter(([a,b])=>a<b)
      .map(([a,b])=>[a+jamb,b===back?b:b-jamb]);
    g.side(x,.554,.604,front,back,cream,.66);
    for(const [a,b] of spans){
      g.side(x,floor,-.49,a,b,'#7b907a',.66);
      g.side(x,-.49,-.464,a,b,'#b7b29b',.66);
      g.side(x,.30,.397,a,b,'#c3c2a4',.66);
      rail([x+inward*.03,-.195,a],[x+inward*.03,-.195,b],.014);
    }
    for(let i=0;i<12;i++){
      const z=front+i*1.16;
      for(const [a,b] of spans){
        const panel=(lo:number,hi:number,y:number,top:number,tint:string)=>{
          const l=Math.max(a,z+lo),r=Math.min(b,z+hi);
          if(l<r)g.side(x,y,top,l,r,tint,.66);
        };
        panel(0,.046,-.464,.30,'#b8bba3');
        panel(0,.21,.397,.554,cream);panel(.966,1.16,.397,.554,cream);
        for(const [edge,dir] of [[.21,1],[.966,-1]]){
          for(const [lo,hi,depthA,depthB] of [[0,.015,.033,.011],[.015,.043,.011,0]]){
            const u=z+edge+dir*lo,v=z+edge+dir*hi;
            const l=Math.max(a,Math.min(u,v)),r=Math.min(b,Math.max(u,v));
            if(l>=r)continue;
            const depth=(s:number)=>depthA+(depthB-depthA)*(s-u)/(v-u);
            for(const [y,sign] of [[.397,1],[.554,-1]]){
              g.panel([x,y,l],[x,y+sign*depth(l),l],[x,y+sign*depth(r),r],[x,y,r],cream,.66);
            }
          }
        }
      }
      if(i%3!==0){
        const base=x+inward*.09,top=x+inward*.26,a=z+.15,b=z+1.03;
        g.panel([base,.72,a],[base,.72,b],[top,.82,b],[top,.82,a],cards[(i+Number(inward<0))%4],.65,{row:(i+Number(inward<0))%4,reverse:inward>0});
      }
    }
    const aisle=center+inward*(-.37);
    rail([aisle,.77,1.05],[aisle,.77,12.77],.018);
    for(let i=0;i<9;i++){
      const z=2.22+i*1.16+(inward<0&&i===0?.45:0);
      if(inward<0&&Math.abs(z-wellCenters[1])<half+.27)continue;
      seat(inward===1?-.49:1.06,z,inward===1?.73:.83);
      rail([aisle,-.171,z+.09],[aisle,.77,z+.09],.015);
    }
  }
  g.cross(back,left,right,floor,-.47,'#80947f',.66);
  for(const [a,b] of [[left,left+.065],[right-.065,right]]){
    g.cross(back,a,b,-.47,.46,'#b6b39a',.66);
  }
  g.cross(back,.27,.315,-.47,.46,'#afa98e',.66);

  // A few seated silhouettes, drawn in the same paper colors as the figures on the street.
  // The seat cushion supports the hips. Knees turn toward the front of the car (negative Z).
  for(const [x,z,coat,hair,skin,lean] of [
    [-.59,4.54,'#677f77','#483f36','#a98465',-.033],[1.17,5.70,'#89604f','#594b41','#c29972',.04],
    [-.40,9.18,'#52636d','#65564b','#c69b76',.022],[.93,11.50,'#8f7980','#484642','#a57f64',-.036],
  ] as const){
    const hips=oval(x,-.712,z-.15,.167,.110),waist=oval(x+lean*.3,-.54,z-.15,.17,.112);
    const shoulders=oval(x+lean,-.255,z-.18,.214,.115),neck=oval(x+lean,-.205,z-.18,.086,.077);
    band(hips,waist,coat,.62);band(waist,shoulders,coat,.64);band(shoulders,neck,coat,.68);
    const jaw=oval(x+lean,-.191,z-.197,.064,.071),cheek=oval(x+lean,-.10,z-.209,.091,.100);
    const fringe=oval(x+lean,-.055,z-.197,.096,.103),crown=oval(x+lean,.015,z-.188,.067,.079);
    band(jaw,cheek,skin,.71);band(cheek,fringe,skin,.76);band(fringe,crown,hair,.67);cap(crown,hair,.68);
    for(const side of [-1,1]){
      const thigh=oval(x+side*.084,-.705,z-.31,.071,.173),lap=oval(x+side*.084,-.621,z-.31,.065,.163);
      band(thigh,lap,'#555a53',.50);cap(lap,'#5a605b',.56);
      const ankle=oval(x+side*.084,-1.12,z-.45,.045,.055),knee=oval(x+side*.084,-.7,z-.427,.059,.082);
      band(ankle,knee,'#515751',.50);
      const boot=oval(x+side*.084,-1.18,z-.483,.051,.095);
      band(boot,ankle,'#454943',.48);
      const upper=oval(x+side*.16+lean,-.31,z-.18,.052,.066),elbow=oval(x+side*.18,-.492,z-.233,.051,.056);
      const wrist=oval(x+side*.10,-.543,z-.346,.042,.046),hand=oval(x+side*.09,-.555,z-.354,.037,.047);
      band(upper,elbow,coat,.64);band(elbow,wrist,coat,.60);band(wrist,hand,skin,.67);cap(hand,skin,.69);
    }
  }
}
