import * as THREE from 'three';
import {createDoradoFerry} from './dorado-ferry.ts';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';
import {vessels} from './ferry-service.ts';

export const serviceFerryPaint=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.86,metalness:.02});
const cream='#e3e0cd',white='#ecebdd',glass='#344850',blue='#31578c',green='#91ae58',gray='#a09e91';
type DoorState={body:THREE.Mesh;first:number;closedX:Float32Array;open:boolean};
const boardingDoors=new WeakMap<THREE.Group,DoorState>();
// The leaf slides aft into its pocket. Only its packed positions need uploading.
export function updatePyxisBoardingDoor(group:THREE.Group,brow:number){
  const state=boardingDoors.get(group),open=brow>=1;
  if(!state||state.open===open)return;
  state.open=open;
  const {body,first,closedX}=state;
  const positions=body.geometry.getAttribute('position') as THREE.BufferAttribute;
  for(let i=0;i<closedX.length;i++)positions.setX(first+i,closedX[i]-(open?.118:0));
  positions.clearUpdateRanges();positions.addUpdateRange(first*3,closedX.length*3);positions.needsUpdate=true;
}

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
  const pyxis=v.family==='pyxis';
  const stations=pyxis?[[-1,.77],[-.89,.96],[-.62,1],[.33,1],[.63,.97],[.81,.80],[.93,.44],[1,.045]]:[[-1,.72],[-.89,.94],[-.62,1],[.33,1],[.68,.96],[.86,.72],[1,mono?.035:.20]];
  // The Spaulding's broad single bow differs from the forked two-stem catamarans.
  for(const side of mono?[0]:[-1,1]){
    const rings=stations.map(([x,w])=>{
      const mid=side*(small?.61:.63),half=side===0?w:w*(1-Math.abs(mid)),sheer=deckH-.23+Math.max(0,x-.55)*(small?.45:.95);
      if(pyxis){
        // Narrow underwater stems flare to the sheer. A distinct blue
        // waterline strip lies in the side plating, beneath the navy topsides.
        return [[mid-half,sheer],[mid-half*.91,.36],[mid-half*.78,-.20],
          [mid-half*.55,-draft],[mid+half*.55,-draft],[mid+half*.78,-.20],
          [mid+half*.91,.36],[mid+half,sheer]];
      }
      return [[mid-half,sheer],[mid-half,.2],[mid-half*.64,-draft],[mid+half*.64,-draft],[mid+half,.2],[mid+half,sheer]];
    });
    for(let j=0;j<stations.length-1;j++)for(let k=0;k<rings[j].length;k++){
      const a=rings[j],b=rings[j+1],n=(k+1)%a.length,x=stations[j][0],X=stations[j+1][0];
      const tint=pyxis?(k===7?gray:k===0||k===6?'#233961':k===1||k===5?'#315593':'#324653'):k===2?'#434b4b':k===5?gray:gg?(k===0||k===4?'#e2ded0':'#414b50'):small?'#465760':k===0||k===4?blue:'#34436b';
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
  const door=v.door/(v.length*.03),halfDoor=.056/(v.length*.03);
  const jambA=door-halfDoor,jambB=door+halfDoor;
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
  // Dakota Creek's Pyxis launch photograph shows a long sloping forehouse,
  // two passenger ribbons and a compact pilothouse with forward-raked glass.
  function pyxisHouse(){
    type Point=[number,number]; // longitudinal station, height above boarding deck in metres
    function clip(points:Point[],distance:(pt:Point)=>number){
      const out:Point[]=[];
      for(let i=0;i<points.length;i++){
        const a=points[i],b=points[(i+1)%points.length],da=distance(a),db=distance(b);
        if(da>=0)out.push(a);
        if((da<0)!==(db<0)){
          const t=da/(da-db);
          out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);
        }
      }
      return out;
    }
    const navy='#233860',stripe='#6f9d46',alloy='#e4e7e3',rail='#b0bec0';
    function sideSkin(points:Point[],z:number,paint:string){
      if(z>0)points.reverse();
      for(let i=1;i+1<points.length;i++){
        const pt=(p:Point)=>at(p[0],deckH+p[1],z);
        f.triangle(pt(points[0]),pt(points[i]),pt(points[i+1]),paint);
      }
    }
    function tier(aft:number,width:number,bowSide:number,bowTopSide:number,bow:number,bowTop:number,
      low:number,high:number,sill:number,head:number,windows:number[],entry=false){
      const plan=(sideEnd:number,end:number)=>[[aft,-width*.88],[aft+.032,-width],[sideEnd,-width],
        [end-.032,-width*.69],[end,-width*.32],[end,width*.32],[end-.032,width*.69],[sideEnd,width],[aft+.032,width],[aft,width*.88]];
      const bottom=plan(bowSide,bow),top=plan(bowTopSide,bowTop);
      for(let i=0;i<bottom.length;i++){
        const j=(i+1)%bottom.length;
        if(i===1||i===7)continue;
        const coord=(index:number,y:number)=>{
          const t=(y-low)/(high-low);
          return at(bottom[index][0]+(top[index][0]-bottom[index][0])*t,deckH+y,
            bottom[index][1]+(top[index][1]-bottom[index][1])*t);
        };
        // Flat front, beveled corners and side returns share the exact pane edges.
        for(const [lo,hi] of [[low,sill],[sill,head],[head,high]]){
          const glazed=lo===sill&&i>=2&&i<=6&&(low>4||entry);
          const divisions=glazed&&i===4?3:1;
          for(let n=0;n<divisions;n++){
            const left=n/divisions,right=(n+1)/divisions;
            const line=(height:number,t:number):FacadePoint=>{
              const a=coord(i,height),b=coord(j,height);
              return [a[0]+(b[0]-a[0])*t,height*.06+v.sill,a[2]+(b[2]-a[2])*t];
            };
            const face=(a:number,b:number,tint:string)=>f.quad(line(lo,a),line(hi,a),line(hi,b),line(lo,b),tint);
            if(glazed){face(left,left+.032/divisions,alloy);face(left+.032/divisions,right,low>4?'#243941':'#3d535a');}
            else face(left,right,alloy);
          }
        }
      }
      deck(top,deckH+high,'#d6dbd7');
      for(const sign of [-1,1]){
        const boundaries=[aft+.032,...windows,Math.max(bowSide,bowTopSide)];
        if(entry&&sign<0)boundaries.push(jambA,jambB);
        boundaries.sort((a,b)=>a-b);
        const fore=(y:number)=>bowSide+(bowTopSide-bowSide)*(y-low)/(high-low);
        for(let i=1;i<boundaries.length;i++){
          const a=boundaries[i-1],b=boundaries[i],mid=(a+b)/2;
          const opening=entry&&sign<0&&mid>jambA&&mid<jambB;
          const bands=opening?[[2.18,high]]:[[low,sill],[sill,head],[head,high]];
          for(const [lo,hi] of bands){
            const poly=clip([[a,lo],[a,hi],[b,hi],[b,lo]],([x,y])=>fore(y)-x);
            const pane=lo===sill&&windows.some((start,k)=>k%2===0&&mid>=start&&mid<windows[k+1]);
            if(pane){sideSkin(poly,sign*width,low>4?'#223941':'#364e55');continue;}
            if(!entry||opening){sideSkin(poly,sign*width,alloy);continue;}
            // Each station interval is partitioned into the actual colored
            // aluminum skin: the sweep never floats beyond the tapered cabin.
            const sweep=([x,y]:Point)=>y-(-.92+3.55*x);
            sideSkin(clip(poly,p=>-sweep(p)),sign*width,navy);
            sideSkin(clip(clip(poly,sweep),p=>.32-sweep(p)),sign*width,stripe);
            sideSkin(clip(poly,p=>sweep(p)-.32),sign*width,alloy);
          }
        }
      }
    }
    tier(-.947,.92,.70,.51,.86,.72,0,2.62,.74,2.01,
      [-.91,-.77,-.75,-.59,-.56,-.33,-.32,-.08,-.07,.10,.23,.40,.41,.64],true);
    tier(-.67,.83,.46,.31,.714,.419,2.62,4.91,3.20,4.48,
      [-.64,-.49,-.48,-.31,-.30,-.13,-.12,.065,.075,.25,.26,.44]);
    tier(-.015,.63,.285,.313,.399,.433,4.91,6.37,5.12,6.15,
      [.012,.091,.101,.192,.20,.33]);
    const head=deckH+2.18,back=-.92+.150/(v.beam*.03);
    for(const [x,t,z] of [[jambA,-.92,back],[jambB,back,-.92]]){
      f.quad(at(x,deckH,t),at(x,head,t),at(x,head,z),at(x,deckH,z),'#8c9896');
    }
    f.quad(at(jambA,head,-.92),at(jambB,head,-.92),at(jambB,head,back),at(jambA,head,back),'#a5aea6');
    f.quad(at(jambA,deckH,back),at(jambA,head,back),at(jambB,head,back),at(jambB,deckH,back),'#515e5c');
    for(const side of [-1,1]){
      for(const [a,b,y,z] of [[-.91,-.665,2.62,.86],[-.62,-.04,4.91,.73]]){
        for(let j=0;j<=5;j++){
          const x=a+(b-a)*j/5;
          box(x-.002,x+.002,side*z-.006,side*z+.006,deckH+y,deckH+y+.91,rail);
        }
        for(const h of [.42,.88])box(a,b,side*z-.007,side*z+.007,deckH+y+h,deckH+y+h+.045,rail);
      }
      box(-.24,-.158,side*.37-.052,side*.37+.052,deckH+4.91,deckH+5.60,alloy);
      box(-.228,-.18,side*.37-.033,side*.37+.033,deckH+5.60,deckH+5.98,'#485659');
    }
    box(.049,.059,-.018,.018,deckH+6.37,deckH+7.74,rail);
    box(.04,.068,-.19,.19,deckH+7.51,deckH+7.58,alloy);
    box(.080,.085,-.010,.010,deckH+6.37,deckH+7.96,rail);
  }
  const deckPlan=[[-.984,-.83],[-.88,-.972],[.56,-.972],[.82,-.80],[.90,-.48],[.90,.48],[.82,.80],[.56,.972],[-.88,.972],[-.984,.83]];
  prism(deckPlan,deckH-.18,deckH,small?'#7a8583':cream,'#aaa99f');
  if(v.family==='pyxis')pyxisHouse();
  else if(small){
    cabin(-.60,.55,.82,deckH,deckH+1.93,7,gray);
    cabin(.035,.59,.62,deckH+2.08,deckH+3.16,4,'#c5954d');
    for(const x of [-.48,-.27])box(x,x+.12,-.51,.51,deckH+2.08,deckH+2.38,'#a8b5b2');
  }else if(mono){
    cabin(-.87,.77,.91,deckH,deckH+2.7,18,'#c99559');
    cabin(-.62,.66,.82,deckH+2.85,deckH+5.20,14,cream);
    cabin(.19,.59,.59,deckH+5.35,deckH+7.55,5,white);
    for(const z of [-.46,.46])box(-.45,-.30,z-.09,z+.09,deckH+5.35,deckH+7.1,'#ad684c');
  }else{
    const mendo=v.family==='mendocino';
    cabin(-.78,.71,.92,deckH,deckH+2.64,12,gg?'#9c5543':white);
    cabin(-.55,mendo?.57:.64,.83,deckH+2.79,deckH+5.12,9,cream);
    cabin(mendo?-.08:.02,mendo?.47:.54,.65,deckH+5.27,deckH+7.14,5,white);
    if(!gg)for(const s of [-1,1]){
      const z=.923*s;
      const q=[at(.2,deckH,z),at(.53,deckH+2.50,z),at(.65,deckH+2.50,z),at(.36,deckH,z)];
      if(s>0)q.reverse();f.quad(q[0],q[1],q[2],q[3],green);
    }
  }
  // At a perpendicular heading the local +X ledge center is exactly over stopZ.
  const width=small?.13:.068;
  for(const s of [-1,1]){
    const z0=s*.905,z1=s*(1-.006/(v.beam*.03));
    box(door-width,door+width,Math.min(z0,z1),Math.max(z0,z1),deckH-.11,deckH,'#b9baaa');
    if(pyxis){
      // The foredeck narrows around the two stems. Rails follow that edge.
      const edge=[[.66,.905],[.80,.793],[.895,.479]];
      for(let j=0;j<edge.length;j++){
        const [x,z]=edge[j];
        box(x-.0025,x+.0025,s*z-.007,s*z+.007,deckH,deckH+.86,'#aebdc0');
        if(!j)continue;
        const [a,b]=edge[j-1];
        for(const h of [.42,.83]){
          const railPlan=[[a,s*b-.006],[x,s*z-.006],[x,s*z+.006],[a,s*b+.006]];
          prism(railPlan,deckH+h,deckH+h+.041,'#aebdc0');
        }
      }
      continue;
    }
    for(const x of [-.89,-.79,.76,.84]){
      box(x-.003,x+.003,s*.79-.009,s*.79+.009,deckH,deckH+(small?.74:.93),gray);
    }
    for(const [a,b] of [[-.90,-.76],[.73,.85]])box(a,b,s*.79-.008,s*.79+.008,deckH+(small?.71:.90),deckH+(small?.75:.95),white);
  }
  if(!pyxis){
    const mast=deckH+(small?3.31:mono?7.70:7.29);
    box(.15,.16,-.02,.02,mast,mast+(small?.73:2.35),gray);
    box(.13,.18,-.09,.09,mast+(small?.67:2.26),mast+(small?.77:2.38),cream);
  }
  const first=f.positions.length/3;
  if(v.family==='pyxis'){
    const z=-.92+.010;
    const panel=(a:number,b:number,lo:number,hi:number,offset:number,tint:string)=>
      f.quad(at(a,deckH+lo,z+offset),at(a,deckH+hi,z+offset),at(b,deckH+hi,z+offset),at(b,deckH+lo,z+offset),tint);
    const left=jambA+.006,right=jambB-.006;
    panel(jambA-.001,jambB+.001,0,1.04,0,white);
    panel(jambA-.001,left,1.04,1.98,0,white);
    panel(left,right,1.04,1.98,0,glass);
    panel(right,jambB+.001,1.04,1.98,0,white);
    panel(jambA-.001,jambB+.001,1.98,2.18,0,white);
  }
  const model=f.mesh(serviceFerryPaint);model.name=v.name+' painted hull and superstructure';group.add(model);
  if(v.family==='pyxis'){
    model.userData.pyxisBoardingBody=true;model.receiveShadow=true;
    const positions=model.geometry.getAttribute('position') as THREE.BufferAttribute;
    const closedX=Float32Array.from({length:positions.count-first},(_,i)=>positions.getX(first+i));
    boardingDoors.set(group,{body:model,first,closedX,open:false});
  }
  return group;
}
