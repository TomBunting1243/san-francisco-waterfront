import * as THREE from 'three';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';

type Point=[number,number];
type Window={x:number;y:number;z:number;ry:number;w:number;h:number};
type Building={id:number;p:number[][]};
const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.64});
const grade=.045,soffit=.309,deck=grade+138*.06,rim=grade+139.1*.06;
const pale='#c8c5b9',edge='#d4d0c3',shadow='#797b75',joint='#646762';
const glass=['#555c60','#596064','#5b6263','#535c61','#5c6162'];
// Unit u runs north along Front, v east along Pine. Tower p7 is the southeast
// corner of the window strip. Small returns in plan yield eight corner offices.
const origin=[.233,-34.404],len=Math.hypot(1.48,.747),c=1.48/len,s=.747/len;
const at=([u,v]:Point,y:number):FacadePoint=>[origin[0]+c*u-s*v,y,origin[1]+s*u+c*v];
const local=([x,z]:number[]):Point=>[(x-origin[0])*c+(z-origin[1])*s,-(x-origin[0])*s+(z-origin[1])*c];
const rect=(l:number,t:number,r:number,b:number):Point[]=>[[l,t],[r,t],[r,b],[l,b]];
function cap(f:FacadePanels,r:Point[],y:number,color:string,down=false){
  for(const [a,b,c] of THREE.ShapeUtils.triangulateShape(r.map(([u,v])=>new THREE.Vector2(u,v)),[]))
    f.triangle(at(r[a],y),at(r[down?b:c],y),at(r[down?c:b],y),color);
}
function solid(f:FacadePanels,r:Point[],lo:number,hi:number,wall:string,top=wall){
  r.forEach((a,i)=>{const b=r[(i+1)%r.length];f.quad(at(a,lo),at(a,hi),at(b,hi),at(b,lo),wall);});
  cap(f,r,hi,top);
}
const box=(f:FacadePanels,l:number,t:number,r:number,b:number,lo:number,hi:number,wall:string,top=wall)=>
  solid(f,rect(l,t,r,b),lo,hi,wall,top);

function office(f:FacadePanels,b:Building,windows:Window[]){
  // p3 and p13 are cadastral intermediate vertices along a single straight run.
  const ring=b.p.slice(0,-1).filter((_,i)=>i!==3&&i!==13).map(local);
  cap(f,ring,soffit,'#686b64',true);cap(f,ring,deck,'#aeaa9b');
  ring.forEach((a,i)=>{
    const z=ring[(i+1)%ring.length],L=Math.hypot(z[0]-a[0],z[1]-a[1]),du=(z[0]-a[0])/L,dv=(z[1]-a[1])/L;
    const pt=(l:number,y:number,out:number)=>at([a[0]+l*du+out*dv,a[1]+l*dv-out*du],y);
    const face=(l:number,r:number,y:number,Y:number,out:number,color:string)=>
      f.quad(pt(l,y,out),pt(l,Y,out),pt(r,Y,out),pt(r,y,out),color);
    const across=(y:number,out:number,Y:number,far:number,col:string)=>
      f.quad(pt(0,y,out),pt(0,Y,far),pt(L,Y,far),pt(L,y,out),col);
    const n=Math.round(L/.084),pitch=L/n,rows=32,h=(rim-soffit)/rows;
    for(let row=0;row<rows;row++){
      const y=soffit+row*h,bottom=y+h*.27,head=y+h*.77;
      face(0,L,y,bottom,.001,pale);face(0,L,head,y+h,.001,'#bdbeb4');
      // Two dark gasket lines and a deep, splayed horizontal aluminum nose.
      across(y+h*.12,.002,y+h*.15,.019,shadow);
      across(y+h*.15,.019,y+h*.18,.019,edge);
      across(y+h*.18,.019,y+h*.21,.002,'#aaa99f');
      across(bottom,.002,bottom+.003,-.007,'#96998e');
      across(head-.003,-.007,head,.002,joint);
      for(let j=0;j<n;j++){
        const l=j*pitch,r=(j+1)*pitch,pigment=glass[(i+Math.floor(j/3)+Math.floor(row/4)+j*2)%glass.length];
        face(l,r,bottom,head,-.007,pigment);
        if((j*13+row*7+i*3)%14===3){
          const [x,y,z]=pt((l+r)/2,(bottom+head)/2,-.0055),normal=pt((l+r)/2,y,.9945);
          windows.push({x,y,z,ry:Math.atan2(normal[0]-x,normal[2]-z),h:(head-bottom)*.84,w:pitch*.84});
        }
      }
    }
    for(let j=0;j<n;j++){
      // Every third sash pier is deep and continuous. Lesser sash bars stop at
      // the projected floor bands, leaving the clean horizontal relief intact.
      const l=j*pitch,main=j%3===2||j===0,w=main?.0038:.0018,out=main?.025:.0001;
      face(l,l+w*2,soffit,rim,out,main?edge:'#acb0a7');
      f.quad(pt(l,soffit,-.007),pt(l,rim,-.007),pt(l,rim,out),pt(l,soffit,out),shadow);
      if(main)f.quad(pt(l+2*w,soffit,out),pt(l+2*w,rim,out),pt(l+2*w,rim,-.007),pt(l+2*w,soffit,-.007),'#93958b');
    }
    across(rim,.002,rim,-.013,edge);
    f.quad(pt(L,deck,-.013),pt(L,rim,-.013),pt(0,rim,-.013),pt(0,deck,-.013),'#88887d');
  });
  // Roof corners registered to municipal 2024 aerial. The main rectangular
  // screened roof is about seven metres above the perimeter membrane in lidar.
  const px=(x:number,y:number):Point=>[-.135+(x-53)*1.941/378,-2.313+(y-98)*2.313/479];
  const patch=(x:number,y:number,X:number,Y:number,lo:number,hi:number,wall:string,top=wall)=>{
    const [l,t]=px(x,y),[r,b]=px(X,Y);box(f,l,t,r,b,lo,hi,wall,top);
  };
  const ph=grade+145.25*.06,par=grade+146.2*.06;
  patch(103,177,377,502,deck,ph,'#bdbdb2','#b4b1a7');
  for(const [x,y,X,Y] of [[102,176,378,179],[102,500,378,503],[102,179,105,500],[375,179,378,500]])
    patch(x,y,X,Y,ph,par,'#bfbdb1','#dedbce');
  // Fine vertical seams in the penthouse cladding are particularly prominent
  // on the blank Pine/Front roof walls in the photographer's diagonal view.
  const seam=(a:Point,b:Point)=>f.quad(at(a,deck+.006),at(a,ph),at(b,ph),at(b,deck+.006),'#aba99d');
  for(let y=187;y<498;y+=13)seam(px(102.8,y+.62),px(102.8,y));
  for(let x=114;x<374;x+=13)seam(px(x+.65,502.2),px(x,502.2));
  for(const x of [145,194])for(const y of [185,237]){
    patch(x,y,x+44,y+46,ph,ph+.015,'#9e9e91','#7e8278');
    for(let k=1;k<7;k++)cap(f,rect(...px(x+k*6,y+.6),...px(x+k*6+.6,y+45)),ph+.0165,'#909486');
  }
  patch(213,287,240,391,ph,ph+.074,'#94948b','#565853');
  patch(242,286,272,391,ph,ph+.047,'#aaa99e','#d0ccbe');
  for(const [x,y] of [[305,314],[305,347],[337,377]]){
    patch(x,y,x+17,y+13,ph,ph+.023,'#c8c4b9','#83857a');
  }
}
function lobby(f:FacadePanels){
  // Recess under the Pine overhang; the glazed bank frontage occupies the
  // Front-side half, the inset planted wall the opposite side of the entrance.
  const r=rect(.022,-2.17,1.65,-.115);
  solid(f,r,grade,soffit,'#767c77');
  box(f,.016,-1.53,.023,-.79,grade,soffit-.018,'#475455');
  box(f,.017,-2.14,.023,-1.54,grade,soffit-.033,'#626f59');
  box(f,.016,-.79,.023,-.15,grade,soffit-.033,'#536063');
  for(const v of [-2.065,-1.53,-.82,-.185])box(f,-.097,v-.036,.028,v+.036,grade,soffit,'#b8b3a7','#c9c6bc');
  for(let j=0;j<7;j++)box(f,.009,-1.49+j*.099,.016,-1.485+j*.099,grade,soffit-.04,'#969b93');
  box(f,.002,-1.49,.019,-.839,.211,.22,'#aaa99c');
  // Glass entrance canopy carries the narrow stainless-steel 100 address.
  box(f,-.245,-1.5,.024,-.841,.272,.28,'#6e756f','#bfc6ba');
  box(f,-.247,-1.503,-.236,-.838,.272,.292,'#706f68');
  for(let j=0;j<5;j++)box(f,-.239,-1.5+j*.164,.022,-1.494+j*.164,.27,.281,'#717772');
  for(const v of [-1.20,-1.17]){
    for(const [t,b,Y,Z] of [[v,v+.019,.301,.307],[v,v+.019,.36,.366],[v,v+.004,.305,.362],[v+.015,v+.019,.305,.362]])
      box(f,-.246,t,-.242,b,Y,Z,'#c5c4b9');
  }
  box(f,-.246,-1.212,-.242,-1.207,.301,.364,'#c5c4b9');
  for(let j=0;j<8;j++)box(f,.064+j*.21,-.117,.071+j*.21,-.109,grade,soffit-.026,'#a2a498');
  box(f,.025,-.115,1.63,-.112,grade+.016,soffit-.035,'#505e60');
  box(f,.025,-.111,1.63,-.106,.208,.214,'#a5aa9f');
  box(f,1.676,-1.997,1.797,-.472,grade,soffit,'#7e8178');
}
function plaza(f:FacadePanels){
  const floor=.218,wall='#d4d0c3',tile='#777977';
  box(f,1.803,-2.30,2.316,-.778,grade,floor,'#888a81',tile);
  box(f,1.804,-.778,2.315,-.46,grade,.056,'#99998e','#a8aaa0');
  for(let i=0;i<16;i++){
    const z=-.778+i*.0199;
    box(f,1.814,z,2.11,z+.0199,.055,floor-(i+1)*.0101,'#a8a99f','#b1b1a6');
  }
  // Front Street approach shares the narrow space beside the garage ramp.
  box(f,1.81,-.46,2.11,.012,.042,.048,'#a5a69b','#aaa99e');
  box(f,2.13,-.775,2.316,-.466,.056,.12,'#8e9188','#7d817b');
  box(f,2.105,-.78,2.13,-.455,.054,floor+.045,'#c0bcb0');
  box(f,2.294,-2.30,2.316,-.779,floor,floor+.143,wall);
  box(f,1.804,-2.30,2.316,-2.278,floor,floor+.15,wall);
  box(f,1.82,-2.278,2.29,-2.23,floor,floor+.091,'#798562','#96a06a');
  for(let i=0;i<12;i++)box(f,1.807,-2.245+i*.12,2.288,-2.243+i*.12,floor,floor+.0009,'#717371');
  for(let i=0;i<4;i++)box(f,1.89+i*.10,-2.278,1.892+i*.10,-.778,floor,floor+.0009,'#717371');
  // Mantle's four waterfall panels discharge into a continuous narrow trough.
  box(f,2.215,-1.32,2.288,-.824,floor,floor+.016,'#b3b7aa','#8ea9a1');
  for(let i=0;i<4;i++){
    const z=-1.307+i*.116;
    box(f,2.268,z,2.294,z+.088,floor+.026,floor+.152,'#bbbeb2','#dad7c7');
    box(f,2.26,z+.004,2.267,z+.082,floor+.017,floor+.049,'#aec6bb');
  }
  // Built photographs show one timber communal table, stools, pale stone
  // lounge seats and bamboo rather than a lawn in this elevated pocket.
  box(f,2.02,-1.69,2.089,-1.32,floor+.039,floor+.048,'#997b5c','#ab8e6a');
  for(const z of [-1.65,-1.36])box(f,2.032,z,2.077,z+.009,floor,floor+.039,'#626661');
  for(let i=0;i<5;i++)for(const u of [1.993,2.098]){
    const z=-1.68+i*.077;box(f,u,z,u+.027,z+.027,floor,floor+.025,'#777b74','#99998c');
  }
  for(const [u,z] of [[1.95,-2.18],[2.08,-2.18],[2.20,-2.14],[2.20,-1.97]]){
    box(f,u,z,u+.083,z+.048,floor,floor+.026,'#a2a397','#bbbaad');
  }
  const circle=(u:number,z:number,r:number):Point[]=>Array.from({length:9},(_,i)=>[u+r*Math.cos(2*Math.PI*i/9),z+r*Math.sin(2*Math.PI*i/9)]);
  for(let i=0;i<19;i++){
    const u=1.825+i*.024,z=-2.256+.006*Math.sin(i*2);
    const h=floor+.13+.028*Math.sin(i*2.5);
    box(f,u,z,u+.0024,z+.0024,floor+.03,h,'#818955');
    f.triangle(at([u,z+.012],h-.018),at([u-.012,z+.023],h+.005),at([u+.006,z+.009],h),'#87965f');
  }
  for(const [u,z] of [[2.21,-1.91],[2.20,-1.7],[1.86,-1.91]]){
    solid(f,circle(u,z,.028),floor,floor+.046,'#a8a28b','#77735c');
    solid(f,circle(u,z,.0035),floor+.046,floor+.11,'#766d59');
    const ring=circle(u,z,.033);
    ring.forEach((a,i)=>{const b=ring[(i+1)%ring.length];
      f.triangle(at(a,floor+.117),at([u,z],floor+.145),at(b,floor+.117),'#869164');
      f.triangle(at(b,floor+.117),at([u,z],floor+.092),at(a,floor+.117),'#75805a');
    });
  }

}
export function add100Pine(b:Building,root:THREE.Group,windows:Window[]){
  if(b.id!==32946479&&b.id!==944025918)return false;
  const f=new FacadePanels();
  if(b.id===32946479){office(f,b,windows);lobby(f);}else plaza(f);
  const mesh=f.mesh(material);mesh.name=b.id===32946479?'100 Pine Street':'100 Pine courtyard';root.add(mesh);return true;
}
