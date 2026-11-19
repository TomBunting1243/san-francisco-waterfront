import * as THREE from 'three';
import {createDoradoFerry} from './dorado-ferry.ts';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';
import {vessels} from './ferry-service.ts';

export const serviceFerryPaint=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.86,metalness:.02});
const cream='#e3e0cd',white='#ecebdd',glass='#344850',blue='#31578c',green='#91ae58',gray='#a09e91';
export function createServiceFerry(mesh:Parameters<typeof createDoradoFerry>[0],i:number){
  const v=vessels[i];
  if(v.family==='dorado')return createDoradoFerry(mesh,v.name);
  const group=new THREE.Group();group.name=v.name;
  const f=new FacadePanels(),small=v.family==='prop',mono=v.family==='spaulding',gg=mono||v.family==='mendocino';
  // x,z are fractions of half the published LOA/beam; y is metres above loaded waterline.
  const at=(x:number,y:number,z:number):FacadePoint=>[x*v.length*.03,y*.06,z*v.beam*.03];
  function deck(r:number[][],h:number,tint:string){
    for(const [a,b,c] of THREE.ShapeUtils.triangulateShape(r.map(([x,z])=>new THREE.Vector2(x,z)),[]))f.triangle(at(...p(r[a],h)),at(...p(r[c],h)),at(...p(r[b],h)),tint);
  }
  function p(a:number[],h:number):[number,number,number]{return [a[0],h,a[1]];}
  function prism(r:number[][],lo:number,hi:number,wall:string,roof=wall){
    r.forEach((a,i)=>{const b=r[(i+1)%r.length];f.quad(at(...p(a,lo)),at(...p(a,hi)),at(...p(b,hi)),at(...p(b,lo)),wall);});deck(r,hi,roof);
  }
  function box(l:number,r:number,t:number,b:number,lo:number,hi:number,c:string){
    prism([[l,t],[r,t],[r,b],[l,b]],lo,hi,c);
  }
  const draft=small?.7:mono?1.83:1.5,deckH=v.sill/.06;
  const stations=[[-1,.72],[-.89,.94],[-.62,1],[.33,1],[.68,.96],[.86,.72],[1,mono?.035:.20]];
  // The Spaulding's broad single bow differs from the forked two-stem catamarans.
  for(const side of mono?[0]:[-1,1]){
    const rings=stations.map(([x,w])=>{
      const mid=side*(small?.61:.63),half=side===0?w:w*(1-Math.abs(mid)),sheer=deckH-.23+Math.max(0,x-.55)*(small?.45:.95);
      return [[mid-half,sheer],[mid-half,.2],[mid-half*.64,-draft],[mid+half*.64,-draft],[mid+half,.2],[mid+half,sheer]];
    });
    for(let j=0;j<stations.length-1;j++)for(let k=0;k<6;k++){
      const a=rings[j],b=rings[j+1],n=(k+1)%6,x=stations[j][0],X=stations[j+1][0];
      const tint=k===2?'#434b4b':k===5?gray:gg?(k===0||k===4?'#e2ded0':'#414b50'):small?'#465760':k===0||k===4?blue:'#34436b';
      f.quad(at(x,a[k][1],a[k][0]),at(X,b[k][1],b[k][0]),at(X,b[n][1],b[n][0]),at(x,a[n][1],a[n][0]),tint);
    }
    for(const j of [0,stations.length-1]){
      const a=rings[j],x=stations[j][0];
      for(let k=1;k<a.length-1;k++){
        const A=at(x,a[0][1],a[0][0]),B=at(x,a[k][1],a[k][0]),C=at(x,a[k+1][1],a[k+1][0]);
        if(j===0)f.triangle(A,B,C,'#53636a');else f.triangle(A,C,B,white);
      }
    }
  }
  function cabin(l:number,r:number,width:number,lo:number,hi:number,n:number,trim:string){
    const nose=Math.min(.13,(r-l)*.18);
    const plan=[[l,-width*.86],[l+.038,-width],[r-nose,-width],[r,-width*.69],[r,width*.69],[r-nose,width],[l+.038,width],[l,width*.86]];
    prism(plan,lo,hi,white,cream);
    const bottom=lo+(hi-lo)*.22,top=hi-(hi-lo)*.14,step=(r-nose-l-.08)/n;
    for(const side of [-1,1])for(let j=0;j<n;j++){
      const x=l+.06+j*step;
      const q=[at(x,bottom,side*(width+.001)),at(x,top,side*(width+.001)),at(x+step*.91,top,side*(width+.001)),at(x+step*.91,bottom,side*(width+.001))];
      if(side>0)q.reverse();f.quad(q[0],q[1],q[2],q[3],j%4===0?'#435860':glass);
    }
    for(let j=0;j<4;j++){
      const z=-width*.66+j*width*.33;
      f.quad(at(r+.001,bottom,z),at(r+.001,top,z),at(r+.001,top,z+width*.30),at(r+.001,bottom,z+width*.30),glass);
    }
    prism(plan.map(([x,z])=>[x,z*1.016]),hi,hi+.15,trim);
  }
  const deckPlan=[[-.984,-.83],[-.88,-.972],[.56,-.972],[.82,-.80],[.90,-.48],[.90,.48],[.82,.80],[.56,.972],[-.88,.972],[-.984,.83]];
  prism(deckPlan,deckH-.18,deckH,small?'#7a8583':cream,'#aaa99f');
  if(small){
    cabin(-.60,.55,.82,deckH,deckH+1.93,7,gray);
    cabin(.035,.59,.62,deckH+2.08,deckH+3.16,4,'#c5954d');
    for(const x of [-.48,-.27])box(x,x+.12,-.51,.51,deckH+2.08,deckH+2.38,'#a8b5b2');
  }else if(mono){
    cabin(-.87,.77,.91,deckH,deckH+2.7,18,'#c99559');
    cabin(-.62,.66,.82,deckH+2.85,deckH+5.20,14,cream);
    cabin(.19,.59,.59,deckH+5.35,deckH+7.55,5,white);
    for(const z of [-.46,.46])box(-.45,-.30,z-.09,z+.09,deckH+5.35,deckH+7.1,'#ad684c');
  }else{
    const pyxis=v.family==='pyxis',mendo=v.family==='mendocino';
    cabin(-.78,.71,.92,deckH,deckH+2.64,pyxis?9:12,gg?'#9c5543':white);
    cabin(pyxis?-.67:-.55,mendo?.57:.64,.83,deckH+2.79,deckH+5.12,pyxis?7:9,cream);
    cabin(mendo?-.08:.02,mendo?.47:.54,.65,deckH+5.27,deckH+7.14,5,white);
    if(!gg)for(const s of [-1,1]){
      const z=.923*s;
      const q=[at(.2,deckH,z),at(.53,deckH+2.50,z),at(.65,deckH+2.50,z),at(.36,deckH,z)];
      if(s>0)q.reverse();f.quad(q[0],q[1],q[2],q[3],green);
    }
  }
  // At a perpendicular heading the local +X ledge center is exactly over stopZ.
  const door=v.door/(v.length*.03),width=small?.13:.068;
  for(const s of [-1,1]){
    const z0=s*.905,z1=s*(1-.006/(v.beam*.03));
    box(door-width,door+width,Math.min(z0,z1),Math.max(z0,z1),deckH-.11,deckH,'#b9baaa');
    for(const x of [-.89,-.79,.76,.84]){
      box(x-.003,x+.003,s*.79-.009,s*.79+.009,deckH,deckH+(small?.74:.93),gray);
    }
    for(const [a,b] of [[-.90,-.76],[.73,.85]])box(a,b,s*.79-.008,s*.79+.008,deckH+(small?.71:.90),deckH+(small?.75:.95),white);
  }
  const mast=deckH+(small?3.31:mono?7.70:7.29);
  box(.15,.16,-.02,.02,mast,mast+(small?.73:2.35),gray);
  box(.13,.18,-.09,.09,mast+(small?.67:2.26),mast+(small?.77:2.38),cream);
  const model=f.mesh(serviceFerryPaint);model.name=v.name+' painted hull and superstructure';group.add(model);return group;
}
