import * as THREE from 'three';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';

type P=[number,number];
type Building={id:number;p:number[][]};
type Window={x:number;y:number;z:number;ry:number;w:number;h:number};
const north=944990391,podium=260320982,m=.06;
const a=Math.atan2(.1583,-.9874),c=Math.cos(a),s=Math.sin(a);
const x0=-52.539,z0=-29.626;
const point=([x,z]:P,h:number):FacadePoint=>[x0+m*(c*x-s*z),h*m,z0+m*(s*x+c*z)];
const local=([x,z]:number[]):P=>[((x-x0)*c+(z-z0)*s)/m,(-(x-x0)*s+(z-z0)*c)/m];
const rect=(x:number,z:number,w:number,d:number):P[]=>[[x,z],[x+w,z],[x+w,z+d],[x,z+d]];
const tint=['#6b8891','#79939a','#708d97','#809a9f','#73909a'];
const pearl='#d8dad2',aluminum='#b9c6c5';
const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.65});
const lerp=(a:P,b:P,t:number):P=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];

// SCB sheet A0.18, A0.49 and the dimensioned level-8 plate on packet p44.
// x increases from Harrison toward the freeway; z increases from Fremont toward First.
// The lower plate is 112'6" long. Only its bowed mechanical penthouse is in the OSM part.
const floorPoint=([x,z]:P):P=>[(x-549)*.1732,(z-218)*.1732];
const arcPixels:P[]=[[560,213],[581,204],[601,198],[621,194],[642,191],[662,191],[683,192],[702,195]];
const bow=arcPixels.map(floorPoint);
const common=([[702,209],[748,209],[748,293],[741,293],[741,312],[748,312],[748,339]] as P[]).map(floorPoint);
const below=([[701,344],[701,365],[549,380],[549,336],[557,336],[557,318],[549,318],[549,236],[560,236]] as P[]).map(floorPoint);
const above=([[701,344],[569,358],[569,331],[557,327],[557,318],[549,318],[549,236],[560,236]] as P[]).map(floorPoint);
const low=[...bow,...common,...below],high=[...bow,...common,...above];
// Surveyed 2023 absolute roof heights 149, 168 and 179–182 m, expressed
// relative to the 32 m shared site datum already used by One Rincon Hill South.
const lowerTop=116.75,upperTop=135.95,screenRoof=145.5,base=10;

export function addHarrison(b:Building,root:THREE.Group,windows:Window[]){
  if(b.id!==north&&b.id!==podium)return false;
  const f=new FacadePanels();
  function ccw(r:P[]){return THREE.ShapeUtils.isClockWise(r.map(q=>new THREE.Vector2(...q)))?r.slice().reverse():r;}
  function lid(r:P[],h:number,color:string,up=true){
    for(const [i,j,k] of THREE.ShapeUtils.triangulateShape(r.map(q=>new THREE.Vector2(...q)),[]))
      f.triangle(point(r[i],h),point(r[up?k:j],h),point(r[up?j:k],h),color);
  }
  function wall(a:P,b:P,lo:number,hi:number,color:string){
    f.quad(point(a,lo),point(a,hi),point(b,hi),point(b,lo),color);
  }
  function box(r:P[],lo:number,hi:number,color:string,top=color){
    const ring=ccw(r);ring.forEach((a,i)=>wall(a,ring[(i+1)%ring.length],lo,hi,color));lid(ring,hi,top);
  }
  function face(a:P,b:P,lo:number,hi:number,rows:number,seed:number,framed=false){
    const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),bays=Math.max(1,Math.round(len/1.6));
    const pos=(d:number,v:number):P=>[a[0]+(dx*d+dz*v)/len,a[1]+(dz*d-dx*v)/len];
    const step=(hi-lo)/rows;
    for(let j=0;j<bays;j++){
      const l=j*len/bays,r=(j+1)*len/bays;
      wall(pos(l,0),pos(r,0),lo,hi,tint[(j+seed)%tint.length]);
      wall(pos(l,.018),pos(l+.042,.018),lo,hi,'#80949a');
      for(let k=0;k<rows;k++)if((7*j+3*k+seed)%23===1){
        const [x,y,z]=point(pos((l+r)/2,.039),lo+(k+.55)*step);
        const p=point(a,0),q=point(b,0);
        windows.push({x,y,z,w:(r-l)*m*.80,h:step*m*.63,ry:Math.atan2(q[2]-p[2],p[0]-q[0])});
      }
    }
    for(let k=0;k<rows;k++){
      const y=lo+k*step,band=framed?(k%7===0?.40:.09):.28;
      wall(pos(0,.024),pos(len,.024),y,y+band,framed&&band<.12?'#8b9fa2':aluminum);
    }
    // Wide pale piers on Fremont are the defining waterfront elevation.
    if(framed){
      wall(pos(0,.035),pos(0,.32),lo,hi,'#a5b8ba');
      wall(pos(0,.32),pos(.36,.32),lo,hi,pearl);
      wall(pos(.36,.32),pos(.36,.035),lo,hi,'#a8b9bc');
    }
  }
  function balcony(r:P[],exposed:number[],lo:number,hi:number,rows:number){
    const ring=ccw(r),step=(hi-lo)/rows;
    for(let k=0;k<rows;k++){
      const floor=lo+k*step+.035;
      lid(ring,floor+.18,'#b4b8b0');lid(ring,floor,'#9aa6a8',false);
      for(const i of exposed){
        const p=ring[i],q=ring[(i+1)%ring.length];
        wall(p,q,floor,floor+.18,aluminum);
        // Transparent guard in the photographs. Only its laminated shoe,
        // top rail and end post are opaque here, leaving the actual void open.
        wall(p,q,floor+.18,floor+.32,'#95afb4');
        wall(p,q,floor+1.16,floor+1.23,'#b3c0c1');
        wall(p,lerp(p,q,.028),floor+.30,floor+1.16,'#8ba1a6');
      }
    }
  }
  if(b.id===podium){
    const r=ccw(b.p.slice(0,-1).map(local));
    r.forEach((p,i)=>{
      const q=r[(i+1)%r.length];
      // The north lobby and Fremont return have their own recessed street wall.
      if((p[0]+q[0])/2<.75&&Math.max(p[1],q[1])<27.0)return;
      if(Math.max(p[1],q[1])<.2&&Math.min(p[0],q[0])<35.5)return;
      wall(p,q,0,base,'#aea9a0');
    });
    lid(r,base,'#acafa3');
    // A0.09 locates the existing townhouse frontage and shared driveway
    // along Harrison, between the two independent tower entrances.
    for(const [z,length] of [[30,13],[47.5,18],[69,7.4]]){
      const runs=Math.max(1,Math.round(length/3.2));
      for(let i=0;i<runs;i++){
        const z1=z+i*length/runs,z2=z+(i+1)*length/runs;
        const edge=(v:number)=>v<47.6?2.2+(1.9-2.2)*(v-25.9)/(47.6-25.9):v<67.2?1.9+(1.6-1.9)*(v-47.6)/(67.2-47.6):-.12;
        const x=edge((z1+z2)/2)-.13;
        wall([x,z2],[x,z1],.72,9.58,'#ccc8b9');
        for(const [y,h] of [[1.1,4.4],[5.1,9.15]])wall([x-.025,z2-.23],[x-.025,z1+.23],y,h,'#70878c');
      }
    }
  }else{
    // The building meets the sloping street at its north end. Set the lobby
    // back between independent pale uprights, then carry the glazed bow round.
    const p=low.map(([x,z]):P=>[x<.1?.75:x,z]);
    p.forEach((q,i)=>face(q,p[(i+1)%p.length],.05,base,2,2+i,i<bow.length-1));
    for(const z of [2.4,7.2,12.15,16.7])box(rect(-.18,z,.56,.40),.05,base,pearl);
    box(rect(-1.45,6.9,1.88,5.9),3.22,3.43,aluminum);
    function shaft(r:P[],lo:number,hi:number,rows:number,upper:boolean){
      for(let i=0;i<r.length;i++)face(r[i],r[(i+1)%r.length],lo,hi,rows,i+(upper?4:0),i<bow.length-1);
      lid(r,hi,'#acaea8');
      const deck=(coords:P[],sides:number[])=>balcony(coords.map(floorPoint),sides,lo,hi,rows);
      deck([[548,218],[560,213],[560,236],[548,236]],[0,3]);
      deck([[702,195],[713,199],[713,209],[702,209]],[0,1]);
      deck([[741,293],[752,293],[752,312],[741,312]],[0,1,2]);
      if(!upper){
        deck([[544,318],[557,318],[557,336],[544,336]],[0,2,3]);
        deck([[701,344],[715,342],[715,364],[701,366]],[1,2]);
      }
    }
    shaft(low,base,lowerTop,37,false);shaft(high,lowerTop,upperTop,6,true);
    // The mapped OSM ring traces the crown rather than the 112.5-foot shaft.
    // Its straight north end joins the bowed Fremont frame and rounded nose.
    const crown=ccw(b.p.slice(0,-1).map(local));
    const inner=crown.map(v=>lerp(v,[15,7],.027));
    for(let i=0;i<crown.length;i++){
      const j=(i+1)%crown.length,p=crown[i],q=crown[j];
      const east=(p[1]+q[1])/2<.04,crest=east?148.15:147.15;
      wall(p,q,upperTop,crest,east?'#d6dad4':'#b3c0c2');
      const dx=q[0]-p[0],dz=q[1]-p[1],len=Math.hypot(dx,dz),offset=(t:number):P=>[p[0]+dx*t+.025*dz/len,p[1]+dz*t-.025*dx/len];
      if(east&&Math.min(p[0],q[0])<14&&Math.max(p[0],q[0])>=14){
        const t=(14-p[0])/dx,d=.13/len;
        wall(offset(t-d),offset(t+d),upperTop+1.55,crest,'#61767b');
      }
      if(!east)for(let k=0;k<5;k++)wall(offset(.01),offset(.99),upperTop+1.05+k*1.95,upperTop+1.14+k*1.95,'#9aadb2');
      const n=Math.max(1,Math.round(len/2.15));
      for(let k=0;k<n;k++)wall(offset(k/n),offset((k+.045)/n),upperTop,crest,'#c7cfcd');
      wall(inner[j],inner[i],screenRoof,crest,'#9daaaa');
      lid([p,q,inner[j],inner[i]],crest,pearl);
    }
    lid(inner,screenRoof,'#a8aaa4');
    box(rect(9.2,4.8,12.6,6.0),screenRoof,147.2,'#acb3ae');
    box(rect(3.8,.9,2.7,2.2),screenRoof,150.0,'#b5b5ac');
  }
  const mesh=f.mesh(material);mesh.geometry.userData.paintVertices=true;
  mesh.name=b.id===north?'The Harrison · north tower 944990391':'One Rincon Hill shared podium 260320982';
  root.add(mesh);return true;
}
