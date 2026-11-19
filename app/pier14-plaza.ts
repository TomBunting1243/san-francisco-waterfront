import * as THREE from 'three';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';
import {harborDatum} from './water-surface.ts';

type Point=[number,number];
const deck=harborDatum.pierDeck,scale=.06;
const paint=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.87,side:THREE.DoubleSide});
const curb=(x:number)=>-1.48-.095*(x+16);
const shore=(x:number)=>-.0099-.121*(x+15.7178);
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
// Public sidewalk finish at the street, flat sculpture apron, then the
// short independent approach to the higher ferry landing next to Gate G.
export function pier14Ground(x:number,z:number){
  const street=clamp((z-curb(x))/.22);
  const rise=clamp((z+.96)/(.715))*clamp((.55-Math.abs(x+14.223))/.38);
  return .045+(deck-.045)*street+(harborDatum.ferryApron-deck)*rise;
}
const bankSections=[
  [-16.023,shore(-16.023)],[-15.718,-.0099],[-14.78,shore(-14.78)],
  [-14.39,shore(-14.39)],[-14.351,-.245],[-14.101,-.245],[-14.063,shore(-14.063)],
  [-13.659,-.2613],[-13.518,-.324],[-13.26,-.355],
];
const gradePoint=([x,z]:Point):FacadePoint=>[x,pier14Ground(x,z),z];
export const pier14Seats:Point[]=[
  // Six backless stones across the street side of the art court and two
  // staggered seats in front, as seen in the curator's October 2025 photos.
  ...Array.from({length:6},(_,i):Point=>[-15.60+.181*i,-1.076-.018*i]),
  [-15.77,-1.294],[-14.84,-1.386],
];
export function createPier14Plaza(){
  const f=new FacadePanels();
  function paved(a:Point,b:Point,c:Point,d:Point,tone:string){
    f.quad(gradePoint(a),gradePoint(b),gradePoint(c),gradePoint(d),tone);
  }
  // Each strip follows the measured water edge and keeps the existing
  // service recess south of x=-16.023 open. Divider strips are flush.
  function strip(l:number,r:number,nearL:number,nearR:number,farL:number,farR:number,main:boolean){
    const cuts=main?[0,.14,.19,.33,.55,.77,1]:[0,1];
    const lerp=(a:number,b:number,j:number)=>a+(b-a)*j;
    const cols=Math.ceil((r-l)/.14),colors=['#b9ae9e','#bdb2a2','#b9b0a1','#c1b5a4'];
    for(let c=0;c<cols;c++){
      const left=c/cols,right=(c+1)/cols;
      const p=(t:number,v:number):Point=>[lerp(l,r,t),lerp(lerp(nearL,nearR,t),lerp(farL,farR,t),v)];
      for(let j=1;j<cuts.length;j++){
        const tone=main&&j===2?'#d0c8b5':colors[(c*7+j*3)%4];
        paved(p(left,cuts[j-1]),p(left,cuts[j]),p(right,cuts[j]),p(right,cuts[j-1]),tone);
      }
    }
  }
  for(let i=1;i<bankSections.length;i++){
    const [l,lz]=bankSections[i-1],[r,rz]=bankSections[i];
    strip(l,r,curb(l),curb(r),lz,rz,true);
  }
  // The short access neck to Pier 14 spans a recess. Its bayward edge joins
  // the existing pier deck. The adjacent shoreline sidewalk hugs the seawall.
  strip(-16.772,-16.023,-.2289,-.3362,.116,shore(-16.023),false);
  strip(-17.45,-16.023,curb(-17.45),curb(-16.023),-.781,-.9999,true);
  // Keep the exposed paving perimeter physically connected to the clipped
  // coastal terrain below it. There is no second deck over the water.
  function fascia(a:Point,b:Point){
    f.quad(gradePoint(a),gradePoint(b),[b[0],-.041,b[1]],[a[0],-.041,a[1]],'#a39c90');
  }
  for(let i=1;i<bankSections.length;i++){
    const a=bankSections[i-1] as Point,b=bankSections[i] as Point;
    if(a[0]<-14.351||a[0]>=-14.101)fascia(a,b);
  }
  fascia([-16.023,-.9999],[-16.023,-.3362]);
  fascia([-16.772,-.2289],[-16.023,-.3362]);
  fascia([-16.772,.116],[-16.023,shore(-16.023)]);
  // The slender green waterfront fence stops for both access ways.
  for(const [left,right] of [[-16.73,-14.39],[-14.063,-13.665]]){
    const count=Math.ceil((right-left)/.115);
    for(let i=0;i<count;i++){
      const xa=left+(right-left)*i/count,xb=left+(right-left)*(i+1)/count;
      const pt=(x:number,h:number):FacadePoint=>[x,pier14Ground(x,shore(x)-.012)+h,shore(x)-.012];
      for(const h of [.014,.061])f.quad(pt(xa,h),pt(xa,h+.0025),pt(xb,h+.0025),pt(xb,h),'#6f8784');
      const post=(x:number,w:number,h:number)=>f.quad(pt(x-w,0),pt(x-w,h),pt(x+w,h),pt(x+w,0),'#6b817e');
      post(xa,.0017,.065);
      for(let j=1;j<7;j++)post(xa+(xb-xa)*j/7,.0007,.061);
      if(i===count-1)post(xb,.0017,.065);
    }
  }
  const makePoint=(x:number,y:number,z:number):FacadePoint=>[x,y,z];
  for(const [index,[x,z]] of pier14Seats.entries()){
    const c=.995,s=-.100,len=.055,depth=.026;
    const xy=(u:number,v:number):Point=>[x+c*u-s*v,z+s*u+c*v];
    const ring=[xy(-len,-depth),xy(len,-depth),xy(len,depth),xy(-len,depth)];
    const cap=pier14Ground(x,z)+.465*scale;
    const top=ring.map(([px,pz])=>makePoint(px,cap,pz));
    for(let i=0;i<4;i++){
      const j=(i+1)%4;f.quad(gradePoint(ring[i]),top[i],top[j],gradePoint(ring[j]),i%2?'#acaa99':'#c1bdac');
    }
    f.quad(top[0],top[3],top[2],top[1],index%2?'#d0cbb8':'#cbc8b7');
    // Two discreet anti-skate studs are visible on the front edge of the stone.
    for(const u of [-.027,.027]){
      const a=xy(u-.0016,-depth),b=xy(u+.0016,-depth),c=xy(u+.0016,-depth+.004),d=xy(u-.0016,-depth+.004);
      const h=(p:Point):FacadePoint=>[p[0],cap+.00055,p[1]];
      f.quad(h(a),h(d),h(c),h(b),'#807d72');
    }
  }
  const mesh=f.mesh(paint);mesh.name='Pier 14 Mission Street art plaza and concrete seats';return mesh;
}

// The 2024 city aerial resolves eight PAIRS beside the south rail plus five
// separate pedestals around the circular head. The shell can swivel freely.
export const pier14Chairs:Array<[number,number,number]>=[];
for(const [j,z] of [3.965,4.525,5.07,5.625,8.37,8.915,9.47,10.02].entries()){
  const x=-17.423+.0045*z;
  pier14Chairs.push([x,z,.15+j*.47],[x,z+.11,2.75-j*.34]);
}
pier14Chairs.push([-17.164,11.795,1.05],[-17.205,11.975,.55],[-17.335,12.025,-.1],
  [-17.477,11.953,-.70],[-17.512,11.805,-1.35]);
export function createPier14Chairs(){
  const f=new FacadePanels();
  for(const [x,z,yaw] of pier14Chairs){
    const cs=Math.cos(yaw),sn=Math.sin(yaw);
    const p=(u:number,h:number,v:number):FacadePoint=>[x+scale*(cs*u-sn*v),deck+scale*h,z+scale*(sn*u+cs*v)];
    const at=(a:number,r:number,h:number)=>p(r*Math.cos(a),h,r*Math.sin(a));
    const sides=12;
    for(let k=0;k<sides;k++){
      const a=2*Math.PI*k/sides,b=2*Math.PI*(k+1)/sides;
      for(const [r0,h0,r1,h1,tone] of [[.224,0,.224,.030,'#747e80'],[.224,.03,.078,.03,'#9fa8a7'],
        [.078,.030,.195,.415,'#959e9e'],[.295,.415,.295,.445,'#7c8789']] as const){
        f.quad(at(a,r0,h0),at(a,r1,h1),at(b,r1,h1),at(b,r0,h0),tone);
      }
      f.triangle(p(0,.445,0),at(b,.295,.445),at(a,.295,.445),'#b4bcbc');
    }
    for(let k=0;k<8;k++){
      const a=Math.PI*k/8,b=Math.PI*(k+1)/8;
      const height=(a:number)=>.448+.348*Math.sin(a);
      f.quad(at(a,.288,.444),at(a,.313,height(a)),at(b,.313,height(b)),at(b,.288,.444),'#a8b2b3');
      // The production city bake uses a front-sided material; retain the inside of the bucket.
      f.quad(at(b,.277,.444),at(b,.299,height(b)),at(a,.299,height(a)),at(a,.277,.444),'#bac2c1');
      f.quad(at(a,.299,height(a)),at(b,.299,height(b)),at(b,.313,height(b)),at(a,.313,height(a)),'#cad0cd');
    }
  }
  const mesh=f.mesh(paint);mesh.name='Pier 14 swivel chairs on the breakwater';return mesh;
}
