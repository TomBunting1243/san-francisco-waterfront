import * as THREE from 'three';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';

type XY=[number,number];
type Level=number|((p:XY)=>number);

// Coordinates are pixels in the straight-down JLL garden photograph. The lobby
// bridge ends register to the survey frame at v=3.41 (555) and v=1.86 (575).
function vertex([x,y]:XY,h:number):FacadePoint {
  const u=1.55+(y-282)*.00394,v=3.41-(x-78)*1.55/402;
  return [-12.192+.98923777*u+.14631692*v,h,-53.725-.14631692*u+.98923777*v];
}
const rect=(x:number,y:number,r:number,b:number):XY[]=>[[x,y],[r,y],[r,b],[x,b]];
function ellipse(x:number,y:number,a:number,b:number,n=48):XY[] {
  return Array.from({length:n},(_,i)=>[x+a*Math.cos(i*2*Math.PI/n),y+b*Math.sin(i*2*Math.PI/n)]);
}
export function addMarketCenterPlaza(root:THREE.Group) {
  const panels=new FacadePanels();
  function slab(outline:XY[],lo:number,level:Level,tint:string,edge='#887f71'){
    const points=outline.map(([x,y])=>new THREE.Vector2(x,y));
    const h=(p:XY)=>typeof level==='number'?level:level(p);
    for(const [a,b,c] of THREE.ShapeUtils.triangulateShape(points,[])){
      const p=outline[a],q=outline[b],r=outline[c];
      panels.triangle(vertex(r,h(r)),vertex(q,h(q)),vertex(p,h(p)),tint);
    }
    const ring=THREE.ShapeUtils.isClockWise(points)?outline.slice().reverse():outline;
    for(let i=0;i<ring.length;i++){
      const a=ring[i],b=ring[(i+1)%ring.length];
      panels.quad(vertex(a,lo),vertex(a,h(a)),vertex(b,h(b)),vertex(b,lo),edge);
    }
  }
  // The inland corner steps away from the tenant amenity wing on the existing plan.
  slab([[78,126],[167,126],[167,-137],[480,-137],[480,604],[78,604]],.024,.034,'#585b50');
  // Rear pools are stepped rectangles, edged in rough pale stone. Water is
  // opaque vertex colour so the garden needs no transparent pass or water shader.
  function pool(r:XY[],height:number){
    const shape=r.map(([x,y])=>new THREE.Vector2(x,y));
    // Mitred inset for these exclusively axis-aligned, clockwise screen outlines.
    const inset:XY[]=r.map(([x,y],i)=>{
      const prev=shape[(i+r.length-1)%r.length],next=shape[(i+1)%r.length];
      return [x-5*(Math.sign(y-prev.y)+Math.sign(next.y-y)),y+5*(Math.sign(x-prev.x)+Math.sign(next.x-x))];
    });
    for(let i=0;i<r.length;i++){
      const j=(i+1)%r.length,cap=height+.009;
      panels.quad(vertex(r[i],cap),vertex(inset[i],cap),vertex(inset[j],cap),vertex(r[j],cap),'#b3afa0');
      panels.quad(vertex(inset[i],cap),vertex(inset[i],height),vertex(inset[j],height),vertex(inset[j],cap),'#7d8175');
      panels.quad(vertex(r[i],.034),vertex(r[i],cap),vertex(r[j],cap),vertex(r[j],.034),'#8f8d7e');
    }
    slab(inset,.033,height,'#37555c');
  }
  pool([[303,-51],[392,-51],[392,72],[329,72],[329,129],[377,129],[377,208],[301,208],[301,146],[287,146],[287,52],[303,52]],.041);
  pool(rect(322,250,407,368),.047);
  pool([[401,245],[478,245],[478,365],[479,365],[479,447],[401,447]],.036);
  for(const [x,y,w,d] of [[433,404,12,18],[450,404,14,21],[433,369,9,7],[446,331,8,8],[457,330,6,7],[441,317,7,10],[453,295,6,8],[430,272,7,10],[352,160,5,7],[345,180,4,4]]){
    const rock=ellipse(x,y,w,d,7).map(([a,b]):XY=>[a+.4*(b-y),b]);
    slab(rock,.046,.061+(w/2200),'#bfbdb1','#89877c');
  }
  for(const [y,x] of [[302,385],[314,389],[328,383],[341,389],[351,385]]){
    slab(rect(x,y,x+15,y+4),.052,.064,'#a4b7ae');
  }
  slab([[84,151],[234,143],[288,139],[318,154],[321,200],[240,205],[178,214],[82,232]],.034,.057,'#4a7549');
  slab([[82,241],[124,219],[178,218],[205,227],[197,270],[179,300],[142,310],[83,310]],.034,.053,'#67894a');
  slab([[333,81],[397,78],[399,63],[465,79],[473,99],[473,201],[380,201],[380,124],[333,124]],.034,.053,'#4f7443');
  slab([[169,-107],[222,-107],[225,53],[210,89],[169,93]],.034,.062,'#52794c');
  slab([[248,-105],[305,-107],[305,50],[286,129],[248,127]],.034,.058,'#598552');
  slab(rect(396,-71,466,58),.034,.052,'#647f50');

  // Broad leaves in the broker's overhead photograph arch over the northern
  // beds. A folded strip gives each leaf a sunlit ridge and a shaded half at
  // oblique angles, with no cutout texture or secondary draw.
  const greens=['#537b41','#6b924a','#59834c','#759849'];
  function leafClump(x:number,y:number,radius:number,soil:number,phase:number){
    const base:XY=[x,y];
    for(let i=0;i<7;i++){
      const a=phase+i*2.39996,dx=Math.cos(a),dy=Math.sin(a);
      const length=radius*(.72+.14*(i%3)),width=length*.21;
      const mid:XY=[x+dx*length*.55,y+dy*length*.55];
      const l:XY=[mid[0]-dy*width,mid[1]+dx*width],r:XY=[mid[0]+dy*width,mid[1]-dx*width];
      const tip:XY=[x+dx*length,y+dy*length],peak=soil+.018+radius*.0008;
      const stem=vertex(base,soil+.001),ridge=vertex(mid,peak);
      const left=vertex(l,peak-.007),right=vertex(r,peak-.009),end=vertex(tip,soil+.009);
      panels.triangle(stem,left,ridge,greens[i%4]);panels.triangle(left,end,ridge,greens[i%4]);
      panels.triangle(stem,ridge,right,greens[(i+1)%4]);panels.triangle(ridge,end,right,greens[(i+1)%4]);
    }
  }
  for(const [x,y,size,top] of [
    [105,178,21,.057],[137,170,23,.057],[164,168,16,.057],[209,171,25,.057],
    [240,178,18,.057],[271,167,26,.057],[293,182,17,.057],[183,48,16,.062],
    [191,13,17,.062],[206,-72,15,.062],[265,32,19,.058],[267,84,16,.058],
    [362,103,15,.053],[440,142,17,.053],[449,177,13,.053],
  ])leafClump(x,y,size,top,x*.2);

  // Trace each edge of the five undulating groundcover beds separately.
  const xs=[80,122,177,224,270,322,375,427,477];
  const bed=(a:number[],b:number[],top:number,tint:string,count=xs.length)=>{
    const left:XY[]=xs.slice(0,count).map((x,i)=>[x,a[i]]);
    const right:XY[]=xs.slice(0,count).map((x,i)=>[x,b[i]]);
    slab([...left,...right.reverse()],.034,top,tint);
  };
  const end=[604,604,604,604,604,604,604,604,604];
  bed([358,358,358,358,360,368,370,449,449],[382,378,385,381,370,395,399,459,456],.047,'#68864d',7);
  bed([390,384,390,388,374,398,405,460,458],[424,411,400,405,399,413,420,472,466],.046,'#80a04c',7);
  bed([427,418,406,410,403,417,423,473,469],[449,441,426,433,444,444,450,478,474],.044,'#758e73',7);
  bed([453,447,431,438,450,446,450,449,449],[482,475,496,498,486,466,470,489,470],.052,'#83a14d');
  bed([482,475,496,498,486,466,470,489,470],[496,490,512,513,505,485,497,504,488],.051,'#466841');
  bed([496,490,512,513,505,485,497,504,488],[539,545,550,537,531,521,528,545,530],.048,'#85a686');
  bed([549,553,558,545,539,530,537,553,542],end,.044,'#77924d');

  const deck=.095;
  slab(rect(77.7,318,279,358),.053,deck,'#cecbbf');
  slab(rect(281,209,476.4,249),.053,deck,'#d0cdc2');
  const path=[[282,338],[299,378],[303,409],[298,435],[282,475],[276,504],[278,533],[285,561]];
  const curve=new THREE.SplineCurve(path.map(([x,y])=>new THREE.Vector2(x,y)));
  const sides=[-1,1].map(side=>Array.from({length:25},(_,i):XY=>{
    const p=curve.getPoint(i/24),d=curve.getTangent(i/24);
    return [p.x+side*d.y*25,p.y-side*d.x*25];
  }));
  const ramp=(p:XY)=>deck-.042*Math.max(0,Math.min(1,(p[1]-369)/187));
  for(let i=0;i<24;i++){
    const a=sides[0][i],b=sides[1][i],c=sides[1][i+1],d=sides[0][i+1];
    panels.quad(vertex(a,ramp(a)),vertex(d,ramp(d)),vertex(c,ramp(c)),vertex(b,ramp(b)),'#d1cdc5');
    panels.quad(vertex(a,.049),vertex(d,.049),vertex(d,ramp(d)),vertex(a,ramp(a)),'#887f71');
    panels.quad(vertex(b,ramp(b)),vertex(c,ramp(c)),vertex(c,.049),vertex(b,.049),'#887f71');
  }
  // The semicircular rose-granite apron opens directly onto the Market sidewalk.
  const arc:XY[]=Array.from({length:33},(_,i)=>[281+(i/32-.5)*218,606-54*Math.sin(i*Math.PI/32)]);
  slab(arc,.038,p=>.049+Math.min(.004,(606-p[1])*.00008),'#bba79c');
  slab(ellipse(282,282,77,76),.054,deck+.001,'#868e8b','#727b76');
  slab(ellipse(282,282,73.5,72.5),deck+.001,deck+.002,'#939b97');
  slab(ellipse(282,282,62,61),deck+.002,deck+.003,'#959d99');
  const mesh=panels.mesh(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.9}));
  mesh.name='Market Center garden and lobby bridges';
  mesh.receiveShadow=true;
  root.add(mesh);
}
