import * as THREE from 'three';
import type {Font} from 'three/addons/loaders/FontLoader.js';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';

type P=[number,number];
type Building={id:number;p:number[][]};
type Pane={x:number;y:number;z:number;ry:number;w:number;h:number};
const m=.06,angle=Math.atan2(-.1583,.9874),c=Math.cos(angle),s=Math.sin(angle);
const origin=[-21.85,-17.88],grade=.045;
const point=([u,v]:P,h:number):FacadePoint=>[origin[0]+m*(c*u-s*v),grade+h*m,origin[1]+m*(s*u+c*v)];
const local=([x,z]:number[]):P=>[((x-origin[0])*c+(z-origin[1])*s)/m,(-(x-origin[0])*s+(z-origin[1])*c)/m];
const rect=(u:number,v:number,w:number,d:number):P[]=>[[u,v],[u+w,v],[u+w,v+d],[u,v+d]];
const brick=['#975f50','#a76d5b','#995d50'],mortar='#c69d83',precast='#c9c4b8',metal='#9aa7a4';
const glass=['#55777c','#5c8082','#4c6970','#638486','#516d79'],baseGray='#666d70';
const paint=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.76});

// 160 Spear Street / 155 Main Street. Coordinates of the typical JLL floor
// plan (p. 8, street labels printed on the plan) calibrated to the measured
// 36 x 43 m OSM envelope. u runs along Main toward Mission, v toward Spear.
// Main has four narrow canted stacks; the plan resolves the larger courtyard
// bay and two chamfered end wings toward Spear. The top floor loses its central bays.
const typicalOutline=[ [633,122],[1051,122],[1076,147],[1076,243],[1066,254],[1099,286],[1099,371],
  [1066,404],[1076,414],[1076,512],[1051,536],[633,536],[610,513],[610,473],[599,463],[599,432],
  [616,416],[616,402],[599,385],[599,344],[610,333],[610,324],[599,312],[599,283],[616,265],
  [616,243],[599,226],[599,194],[610,183],[610,147] ];
const topOutline=[[423,73],[715,73],[733,90],[733,152],[727,159],[727,275],[733,282],[733,344],
  [715,362],[423,362],[407,345],[407,324],[400,316],[400,288],[407,280],[407,154],[400,146],
  [400,115],[407,108],[407,90]];
const typical:P[]=typicalOutline.map(([x,y])=>[(329-y)*.087-.40,(x-840)*.087]);
const upper:P[]=topOutline.map(([x,y])=>[(217.5-y)*.1245-.40,(x-566.5)*.1245]);

export function add160Spear(b:Building,root:THREE.Group,windows:Pane[],font?:Font){
  if(b.id!==288645261)return false;
  const f=new FacadePanels();
  function ccw(p:P[]){return THREE.ShapeUtils.isClockWise(p.map(q=>new THREE.Vector2(...q)))?p.slice().reverse():p;}
  function lid(p:P[],h:number,color:string){
    for(const [i,j,k] of THREE.ShapeUtils.triangulateShape(p.map(q=>new THREE.Vector2(...q)),[]))f.triangle(point(p[i],h),point(p[k],h),point(p[j],h),color);
  }
  function wall(a:P,b:P,lo:number,hi:number,color:string){
    f.quad(point(a,lo),point(a,hi),point(b,hi),point(b,lo),color);
  }
  function block(p:P[],lo:number,hi:number,color:string,cap=color){
    const ring=ccw(p);ring.forEach((a,i)=>wall(a,ring[(i+1)%ring.length],lo,hi,color));lid(ring,hi,cap);
  }
  function facade(a:P,b:P,lo:number,hi:number,rows:number,side:number){
    const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
    const at=(p:number,d=0):P=>[a[0]+(dx*p+dz*d)/len,a[1]+(dz*p-dx*d)/len];
    const panel=(l:number,r:number,y:number,h:number,d:number,tint:string)=>wall(at(l,d),at(r,d),y,h,tint);
    const story=(hi-lo)/rows,count=Math.max(1,Math.round(len/1.48));
    for(let floor=0;floor<rows;floor++){
      const bottom=lo+story*floor,sill=bottom+.42*story,head=lo+story*(floor+1);
      wall(a,b,bottom,sill,brick[(side+Math.floor(floor/4))%3]);
      for(const h of [bottom+.24,bottom+.68,bottom+1.10])if(h<sill-.1)panel(0,len,h,h+.058,.018,mortar);
      panel(0,len,sill-.085,sill,.027,precast);
      for(let j=0;j<count;j++){
        const l=len*j/count,r=len*(j+1)/count;
        panel(l,r,sill,head,-.035,glass[(side+Math.floor(j/2)+Math.floor(floor/4))%5]);
        panel(l,l+.036,sill,head,.0,'#829291');
        if((j+floor*3+side)%17===0){
          const [x,y,z]=point(at((l+r)/2,-.003),(sill+head)/2);
          const p=point(a,0),q=point(b,0);windows.push({x,y,z,ry:Math.atan2(q[2]-p[2],p[0]-q[0]),w:(r-l)*m*.88,h:(head-sill)*m*.88});
        }
      }
    }
  }
  function tower(p:P[],base:number,top:number,rows:number){
    const r=ccw(p);r.forEach((a,i)=>facade(a,r[(i+1)%r.length],base,top,rows,i));lid(r,top,'#adaaa0');
  }

  // The two-story concrete base remains rectangular behind the projecting
  // upper bay windows. Its paired entrances align with the public path from Spear.
  const portalU=-1.6;
  const ground=ccw(b.p.slice(0,-1).map(local));
  for(let i=0;i<ground.length;i++){
    const a=ground[i],b=ground[(i+1)%ground.length],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
    const centerV=(a[1]+b[1])/2;
    // Construct the recessed street walls separately below.
    if(centerV>18.5||centerV< -18.3)continue;
    const bays=Math.max(1,Math.round(len/3.4));
    wall(a,b,0,8.05,baseGray);
    for(let j=0;j<bays;j++){
      const pos=(t:number):P=>[a[0]+dx*t+dz/len*.035,a[1]+dz*t-dx/len*.035];
      wall(pos((j+.07)/bays),pos((j+.93)/bays),.28,4.4,glass[j%5]);
      wall(pos((j+.07)/bays),pos((j+.93)/bays),5.8,7.8,glass[(j+1)%5]);
    }
  }
  // Close the four chamfered returns between the surveyed side walls and
  // the recessed two-story street fronts. These return walls face the street.
  for(const [a,b] of [
    [[-18.4,-18.0],[-17.1,-19.7]],[[17.1,-19.7],[17.6,-17.7]],
    [[17.3,18.5],[16.5,19]], [[-17.9,19],[-18.6,18.1]]
  ] as [P,P][])wall(a,b,0,8.05,baseGray);
  lid(ground,8.05,'#ada99f');
  function entry(side:number){
    const left=side>0?-17.9:-17.1,right=side>0?16.5:17.1;
    const faceV=side>0?19.0:-19.7;
    const segment=(l:number,r:number,v:number,lo:number,hi:number,color:string)=>{
      const p:P=[l,v],q:P=[r,v];wall(side>0?q:p,side>0?p:q,lo,hi,color);
    };
    const l=portalU-3.15,r=portalU+3.15;
    const inset=faceV-1.14*side;
    for(const [a,b] of [[left,l],[r,right]]){
      segment(a,b,faceV,0,8.05,baseGray);
      const n=Math.max(1,Math.round((b-a)/3.2));
      for(let i=0;i<n;i++){
        const x=a+(b-a)*(i+.07)/n,y=a+(b-a)*(i+.93)/n;
        segment(x,y,faceV+.03*side,.30,4.55,glass[(i+1)%5]);segment(x,y,faceV+.03*side,5.68,7.83,'#46585b');
      }
    }
    segment(l,r,inset,.08,6.20,'#657c7e');segment(l,r,faceV,6.2,8.05,'#535f62');
    for(const u of [l,r,portalU-1.45,portalU,portalU+1.45])segment(u-.045,u+.045,inset+.025*side,.08,6.2,metal);
    segment(l,r,inset+.03*side,3.23,3.34,metal);
    for(const u of [l,r])block(rect(u-.18,Math.min(faceV,inset)-.08,.36,1.30),0,8.08,baseGray);
    segment(left,right,faceV+.11*side,7.72,8.16,precast);
    if(side>0){
      block(rect(l,faceV-.25,6.3,1.5),4.38,4.65,'#d7d6ca');
      segment(l,r,faceV+1.19,4.65,5.56,'#676b70');
    }else{
      // IwamotoScott's Main Street entrance: a broad powder-coated horizontal
      // skin folds into an asymmetric pointed soffit, then turns down to the ground.
      const A=point([l-3.8,-20.15],3.6),B=point([l-3.8,-21.3],3.65);
      const C=point([portalU+1.1,-22.55],6.55),D=point([r+2.2,-21.3],4.65);
      const E=point([r+2.2,-20.15],4.65),F=point([portalU,-19.9],4.05);
      f.triangle(B,C,F,'#dcddd7');f.triangle(C,D,F,'#c8cbc6');f.triangle(D,E,F,'#e8e7de');f.triangle(F,A,B,'#caced0');
      f.triangle(F,C,B,'#d6dad5');f.triangle(F,D,C,'#bfc6c3');f.triangle(F,E,D,'#d0d5d2');f.triangle(B,A,F,'#c7cdc9');
      f.triangle(B,point([l-1.9,-20.72],.04),F,'#ced0ca');
      f.triangle(F,point([l-1.9,-20.72],.04),B,'#d7d8d1');
    }
    if(font&&side>0){
      const letters=new THREE.ShapeGeometry(font.generateShapes('160 SPEAR',.55),3);
      letters.computeBoundingBox();const center=letters.boundingBox!.getCenter(new THREE.Vector3()).x;
      const p=letters.getAttribute('position'),index=letters.index;
      const textPoint=(i:number)=>point([portalU+p.getX(i)-center,faceV+1.22],4.73+p.getY(i));
      if(index)for(let i=0;i<index.count;i+=3)f.triangle(textPoint(index.getX(i)),textPoint(index.getX(i+1)),textPoint(index.getX(i+2)),'#e1e0d6');
      letters.dispose();
    }
  }
  entry(1);entry(-1);
  // Sixteen typical floors and the set-back top floor sit above the two-story base.
  tower(typical,8.14,70.45,16);
  tower(upper,70.45,74.15,1);
  for(const side of [-1,1]){
    // Wide end piers and the narrow vertical gap between the central glass
    // stacks: their relative widths follow the Main elevation in JLL's photo.
    const frontV=side>0?20.5:-20.5;
    for(const [u,w] of [[-7.55,1.12],[-.05,.34],[6.53,1.13]]){
      const v=side>0?(Math.abs(u)<1?22.65:20.75):frontV;
      const centralSpear=side>0&&Math.abs(u)<1;
      block(rect(u-w/2,v-.28,w,.56),8.1,centralSpear?70.45:74.7,precast);
      if(centralSpear)block(rect(u-w/2,19.82,w,.35),70.45,74.7,precast);
    }
  }
  // Parapet, recessed flat terrace, hipped copper-colored screen and central
  // raised roof house. Absolute USGS returns range from 77.7 to 85 m.
  function oct(w:number,d:number,corner:number):P[]{return [[-w+corner,-d],[w-corner,-d],[w,-d+corner],[w,d-corner],[w-corner,d],[-w+corner,d],[-w,d-corner],[-w,-d+corner]];}
  const apron=oct(14.9,15.45,3.3),screen=oct(13.3,13.8,2.9);
  for(let i=0;i<apron.length;i++){
    const j=(i+1)%apron.length;
    f.quad(point(apron[i],74.15),point(screen[i],78.4),point(screen[j],78.4),point(apron[j],74.15),i%2?'#ba9584':'#bf9e8c');
  }
  lid(screen,78.4,'#aaa496');
  block(rect(-5.75,-9.15,12.2,10.4),78.4,81.35,'#b0a395','#b9afa0');
  // Open Spear forecourt on assessor lot 3717/005. Keep the mapped footway
  // on u=-1.9 clear through the two planted sides and both entry directories.
  const court:P[]=[[-10.1,21.95],[3.85,21.95],[3.8,64.25],[-10.15,64.1]];
  block(court,.04,.17,'#aba7a0','#c3bcb1');
  const beds:P[][]=[
    [[-9.8,27],[-5.8,27.5],[-4.45,31.4],[-5.5,39.7],[-8.4,41.4],[-9.8,40.2]],
    [[-9.8,43.6],[-6.3,43.1],[-4.75,47.2],[-5.65,54.9],[-4.95,58.8],[-8,60.2],[-9.8,59.5]],
    [[.37,29.2],[3.63,28.3],[3.63,40.3],[1.15,39.1],[.45,35.8]],
    [[.7,44.7],[3.55,42.8],[3.55,57],[1.3,56.4],[.42,52]]
  ];
  for(const bed of beds)block(bed,.17,.64,'#9e8b76','#7d876a');
  function seat(u:number,v:number,length:number){
    for(const x of [u+.23,u+length-.35])block(rect(x,v+.10,.12,.36),.18,.59,baseGray);
    for(let j=0;j<3;j++)block(rect(u,v+j*.17,length,.14),.59,.68,'#a8886d');
  }
  seat(-8.4,41.5,2.8);seat(.25,41.3,2.55);seat(-8.5,26.1,3.25);
  // The silver ring is open through the middle, not a solid metal disc.
  const ringPoint=(a:number,r:number,d:number)=>{
    const y=Math.sin(a)*r*.92;
    return point([-7.05+Math.cos(a)*r+y*.27,57.4+d-y*.40],1.97+y);
  };
  for(let i=0;i<28;i++){
    const a=Math.PI*i/14,b=Math.PI*(i+1)/14;
    f.quad(ringPoint(a,1.46,.18),ringPoint(b,1.46,.18),ringPoint(b,.71,.18),ringPoint(a,.71,.18),'#d2d8d4');
    f.quad(ringPoint(b,1.46,-.18),ringPoint(a,1.46,-.18),ringPoint(a,.71,-.18),ringPoint(b,.71,-.18),'#a6adab');
    f.quad(ringPoint(b,1.46,.18),ringPoint(a,1.46,.18),ringPoint(a,1.46,-.18),ringPoint(b,1.46,-.18),'#bbc4c1');
    f.quad(ringPoint(a,.71,.18),ringPoint(b,.71,.18),ringPoint(b,.71,-.18),ringPoint(a,.71,-.18),'#899797');
  }
  for(const u of [-8.65,2.05])block(rect(u-.56,62.1,1.12,.30),.17,2.14,'#848987','#abb2ad');
  function tree(u:number,v:number,height:number,radius:number){
    block(rect(u-.19,v-.18,.38,.36),.62,height*.64,'#7a7362');
    const layers=[[.33,.07],[.52,.82],[.75,1],[.91,.65],[1,.07]];
    const leaf=['#788467','#818b70','#718168','#859175'];
    function vertex(layer:number,i:number){
      const [h,w]=layers[layer],a=(i+layer*.23)*Math.PI/4;
      return point([u+Math.cos(a)*w*radius,v+Math.sin(a)*w*radius*1.17],height*h);
    }
    for(let j=0;j+1<layers.length;j++)for(let i=0;i<8;i++)
      f.quad(vertex(j,i),vertex(j+1,i),vertex(j+1,(i+1)%8),vertex(j,(i+1)%8),leaf[(j+i)%4]);
    for(let i=0;i<8;i++)f.triangle(vertex(4,i),point([u,v],height+.04),vertex(4,(i+1)%8),leaf[2]);
  }
  tree(-7.85,35.8,9.0,2.9);tree(-7.7,49.9,18.2,3.55);
  tree(2.25,35.9,20.6,3.40);tree(2.28,51,21.1,3.55);
  const mesh=f.mesh(paint);mesh.geometry.userData.paintVertices=true;
  mesh.name='160 Spear Street · 155 Main 288645261';root.add(mesh);return true;
}
