import * as THREE from 'three';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';

type UV=[number,number];
type Pane={x:number;y:number;z:number;ry:number;w:number;h:number};
const meter=.06,angle=Math.atan2(-.1583,.9874),c=Math.cos(angle),s=Math.sin(angle);
const point=([u,v]:UV,h:number):FacadePoint=>[-26.848+meter*(u*c-v*s),.045+h*meter,-25.009+meter*(u*s+v*c)];
const rectangle=(u:number,v:number,width:number,depth:number):UV[]=>[[u,v],[u+width,v],[u+width,v+depth],[u,v+depth]];
const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.58});
const colors=['#8ca9b8','#95b0bc','#9ab7c1','#829ea9','#90acb8','#87a3b6'];
const edge='#abb9bc',silver='#bcc7c6',floor='#b5a897',soffit='#acb1ae';
const podiumId=611390934,middleId=693630048,highId=693630045;
// Local u runs from Howard toward Natoma, v from Beale toward Main.
// Plate widths and corner cut dimensions follow planning presentation sheet 16.
// A 2023 lidar transect places the high plate across v≈10–43, beyond its OSM outline.
const depth=43.6,end=42.1,upperStart=10.45,midCutU=38.85,midCutV=14.7,highCutU=7.55,highCutV=29.85;
const mid:UV[]=[[0,0],[midCutU,0],[midCutU,midCutV],[depth,midCutV],[depth,end],[0,end]];
const high:UV[]=[[0,upperStart],[depth,upperStart],[depth,end],[highCutU,end],[highCutU,highCutV],[0,highCutV]];
const level12=45.38,level13=49.22,level28=106.68;
const highSpacing=3.858,level43=level28+15*highSpacing;

export function addParkTower(b:{id:number;p:number[][]},root:THREE.Group,windows:Pane[]){
  if(b.id!==podiumId&&b.id!==middleId&&b.id!==highId)return false;
  const f=new FacadePanels(),isPodium=b.id===podiumId;
  function cap(p:UV[],height:number,color:string,below=false){
    for(const [i,j,k] of THREE.ShapeUtils.triangulateShape(p.map(v=>new THREE.Vector2(...v)),[]))
      f.triangle(point(p[i],height),point(p[below?j:k],height),point(p[below?k:j],height),color);
  }
  function wall(a:UV,b:UV,lo:number,hi:number,color:string){
    f.quad(point(a,lo),point(a,hi),point(b,hi),point(b,lo),color);
  }
  function block(p:UV[],lo:number,hi:number,color:string,top=color){
    p.forEach((a,i)=>wall(a,p[(i+1)%p.length],lo,hi,color));
    cap(p,hi,top);cap(p,lo,soffit,true);
  }
  // Each three-story curtain-wall module shares glass columns. Individual
  // floor divisions and the alternating fritted fins are physical surfaces.
  function face(a:UV,b:UV,lo:number,hi:number,stories:number,phase:number,blade:number){
    const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),n=Math.max(1,Math.round(len/1.58));
    const at=(p:number,out=0):UV=>[a[0]+(dx*p+dz*out)/len,a[1]+(dz*p-dx*out)/len];
    const step=(hi-lo)/stories;
    for(let j=0;j<n;j++){
      const l=j*len/n,r=(j+1)*len/n;
      wall(at(l),at(r),lo,hi,colors[(phase+Math.floor(j/3))%colors.length]);
      wall(at(l,.015),at(l+.050,.015),lo,hi,'#778e9c');
      const finSections=isPodium?stories:1;
      for(let k=0;k<finSections;k++)if(blade>0&&(j+phase+k)%2===0){
        const y=lo+k*(hi-lo)/finSections+.13,head=lo+(k+1)*(hi-lo)/finSections-.16,d=blade;
        wall(at(l),at(l,d),y,head,'#627f90');
        wall(at(l,d),at(l+.065,d),y,head,'#b4c6cd');
        wall(at(l+.065,d),at(l+.065),y,head,'#8faab4');
      }
      for(let k=0;k<stories;k++)if((j*7+k+phase*5)%17===1){
        const [x,y,z]=point(at((l+r)/2,.035),lo+(k+.51)*step),p=point(a,0),q=point(b,0);
        windows.push({x,y,z,ry:Math.atan2(q[2]-p[2],p[0]-q[0]),w:(r-l)*meter*.79,h:step*meter*.68});
      }
    }
    for(let k=0;k<stories;k++){
      const h=lo+k*step;
      wall(at(0,.02),at(len,.02),h,h+.28,'#8da4b0');
      wall(at(0,.036),at(len,.036),h+.27,h+.36,silver);
    }
  }
  function storeys(outline:UV[],lo:number,hi:number,stories:number,phase:number,blade:number){
    outline.forEach((a,i)=>face(a,outline[(i+1)%outline.length],lo,hi,stories,phase+i,blade));
  }
  function rail(a:UV,b:UV,h:number){
    const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
    // Light steel uprights and top cap preserve the view through the glazing.
    const along=(p:number):UV=>[a[0]+dx*p/len,a[1]+dz*p/len];
    for(let p=0;p<len-.07;p+=1.75){
      const left=along(p),right=along(p+.09);
      wall(left,right,h,h+1.19,edge);wall(right,left,h,h+1.19,edge);
    }
    const side:UV=[dz/len*.065,-dx/len*.065];
    const ring:UV[]=[a,[a[0]+side[0],a[1]+side[1]],[b[0]+side[0],b[1]+side[1]],b];
    block(ring,h+1.15,h+1.22,silver);
    wall(a,b,h+.04,h+.22,'#9eb5bb');
  }
  function terrace(p:UV[],h:number,rails:number[]){
    block(p,h-.39,h,edge,floor);
    for(const i of rails)rail(p[i],p[(i+1)%p.length],h);
  }
  function planting(u:number,v:number,w:number,d:number,h:number){
    block(rectangle(u,v,w,d),h,h+.72,'#bbb9ac','#7f8b70');
    block(rectangle(u+.18,v+.16,w-.36,d-.32),h+.72,h+1.02,'#829076');
  }
  if(b.id===podiumId){
    // Rounded diagonal frontage of the recorded podium, retaining the open
    // Howard plaza under the 35-foot silver soffit (ground plan, sheet 14).
    const ring:UV[]=b.p.slice(0,-1).map(([x,z])=>[((x+26.848)*c+(z+25.009)*s)/meter,(-(x+26.848)*s+(z+25.009)*c)/meter]);
    if(THREE.ShapeUtils.isClockWise(ring.map(q=>new THREE.Vector2(...q))))ring.reverse();
    const ground:UV[]=[[9.0,2.8],[37.6,2.8],[37.6,.45],[54.35,.45],[54.35,41.85],[30.0,51.45],[14.8,54.5],[.1,56.25],[.1,40.2],[9.0,38.0]];
    storeys(ground,.10,10.67,2,1,0);
    for(const [u,v] of [[1,1],[1,17.3],[1,28.4],[10.2,1],[19.5,1],[29,1]]){
      block(rectangle(u-.51,v-.51,1.02,1.02),.04,10.68,silver);
    }
    cap(ring,10.67,soffit,true);
    const artA:UV=[8.94,28.7],artB:UV=[8.94,12.5];
    wall(artA,artB,.34,8.8,'#4c596b');
    for(let i=0;i<28;i++){
      const v=13+i*.55,h=2.7+1.4*Math.sin(i*.29)+i*.095;
      wall([8.91,v+.37],[8.91,v],h,h+.36,'#8998a7');
    }
    storeys(ring,10.67,level12,9,0,.25);
    cap(ring,level12,floor);
    // Outer exposed edges only. The lower roof continues around the tower
    // toward both Natoma and the linear park as a connected outdoor terrace.
    for(let i=0;i<ring.length;i++){
      const a=ring[i],q=ring[(i+1)%ring.length];
      if((a[0]+q[0])/2>49||(a[1]+q[1])/2>43)rail(a,q,level12);
    }
    planting(46.6,17,1.95,13,level12);planting(13.0,46.75,12,1.55,level12);
  }
  if(b.id===middleId){
    storeys(rectangle(0,0,depth,end),level12,level13,1,2,.31);
    const pocket=rectangle(midCutU,0,depth-midCutU,midCutV);
    for(let i=0;i<5;i++){
      const lo=level13+i*(level28-level13)/5,hi=level13+(i+1)*(level28-level13)/5;
      storeys(mid,lo,hi,3,2+i,.48);terrace(pocket,lo,[0,1]);
      planting(depth-1.36,.65,.93,2.85,lo);
    }
    const setback=rectangle(0,0,depth,upperStart);terrace(setback,level28,[0,1,3]);
    planting(3.0,1.3,13.6,1.6,level28);planting(32.4,1.25,7.5,1.65,level28);
    cap(rectangle(0,upperStart,depth,end-upperStart),level28,soffit,true);
  }
  if(b.id===highId){
    const pocket=rectangle(0,highCutV,highCutU,end-highCutV);
    for(let i=0;i<6;i++){
      const lo=level28+i*3*highSpacing,hi=i===5?level43+highSpacing:lo+3*highSpacing;
      storeys(high,lo,hi,i===5?1:3,3+i,.53);
      terrace(pocket,lo,[2,3]);planting(.65,end-1.45,3.45,.87,lo);
    }
    // The top corner remains open above L43. A raked screen around the two
    // mechanical floors crests at the Beale side, 605 feet above grade.
    const base=level43+highSpacing;
    const screenHeight=(v:number)=>184.45-(v-upperStart)*.235;
    high.forEach((a,i)=>{
      const q=high[(i+1)%high.length],n=Math.max(1,Math.round(Math.hypot(q[0]-a[0],q[1]-a[1])/1.54));
      const interp=(t:number):UV=>[a[0]+(q[0]-a[0])*t,a[1]+(q[1]-a[1])*t];
      for(let j=0;j<n;j++){
        const l=interp(j/n),r=interp((j+1)/n),seam=interp((j+.09)/n);
        const draw=(p:UV,q:UV,color:string)=>f.quad(point(p,base),point(p,screenHeight(p[1])),point(q,screenHeight(q[1])),point(q,base),color);
        draw(l,seam,'#7f939f');draw(seam,r,colors[(i+Math.floor(j/4))%colors.length]);
      }
    });
    // Enclosed roof and recessed mechanical areas follow the stepped DSM.
    cap(high,176.9,'#a0abae');
    block(rectangle(2.05,12.0,39.5,17.6),176.9,179.26,'#98a5a9');
    block(rectangle(16.8,24.1,17.6,4.1),179.26,182.45,'#9ca8aa');
  }
  const mesh=f.mesh(material);mesh.geometry.userData.paintVertices=true;
  mesh.name='Park Tower at Transbay '+b.id;root.add(mesh);return true;
}
