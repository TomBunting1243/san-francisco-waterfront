import * as THREE from 'three';

type Building={id:number;p:number[][]};
type Window={x:number;y:number;z:number;ry:number;w:number;h:number};
type Plan=[number,number];
type Vertex=[number,number,number]; // u, height, v
const tower=72963089,lofts=73348851;
const origin=[-20.682,-32.585],angle=Math.atan2(-.316,2.23),c=Math.cos(angle),s=Math.sin(angle);
const metal='#9faeb1',steel='#71858c',roof='#adaea8';
const blues=['#68838f','#718b97','#748e99','#78939d','#6d8592'];
const paint=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.73});
const mix=(a:Plan,b:Plan,t:number):Plan=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
const vertex=(p:Plan,y:number):Vertex=>[p[0],y,p[1]];
const rect=(l:number,r:number,n:number,f:number):Plan[]=>[[l,n],[l,f],[r,f],[r,n]];
function local([x,z]:number[]):Plan{return [(x-origin[0])*c+(z-origin[1])*s,-(x-origin[0])*s+(z-origin[1])*c];}
function world([u,y,v]:Vertex):Vertex{return [origin[0]+u*c-v*s,y,origin[1]+u*s+v*c];}

class Skin{
  positions:number[]=[];colors:number[]=[];indices:number[]=[];
  palette=new Map<string,THREE.Color>();
  points(p:Vertex[],tone:string){
    let color=this.palette.get(tone);
    if(!color){color=new THREE.Color(tone);this.palette.set(tone,color);}
    const i=this.positions.length/3;
    for(const point of p){this.positions.push(...world(point));this.colors.push(color.r,color.g,color.b);}
    return i;
  }
  quad(a:Vertex,b:Vertex,c:Vertex,d:Vertex,tone:string){
    const i=this.points([a,b,c,d],tone);this.indices.push(i,i+1,i+2,i,i+2,i+3);
  }
  deck(ring:Plan[],y:number,tone:string){
    const i=this.points(ring.map(p=>vertex(p,y)),tone);
    for(const [a,b,c] of THREE.ShapeUtils.triangulateShape(ring.map(([x,z])=>new THREE.Vector2(x,z)),[]))this.indices.push(i+c,i+b,i+a);
  }
  // Straight wall chains are clockwise in plan; the left normal faces out.
  edge(a:Plan,b:Plan,bottom:number,top:number,tone:string){
    this.quad(vertex(a,bottom),vertex(b,bottom),vertex(b,top),vertex(a,top),tone);
  }
  block(ring:Plan[],bottom:number,top:number,tone:string,cap:string){
    ring.forEach((p,i)=>this.edge(p,ring[(i+1)%ring.length],bottom,top,tone));
    this.deck(ring,top,cap);
  }
  attach(root:THREE.Group,name:string){
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(this.positions,3));
    geo.setAttribute('color',new THREE.Float32BufferAttribute(this.colors,3));
    geo.setIndex(this.indices);geo.computeVertexNormals();geo.userData.paintVertices=true;
    const m=new THREE.Mesh(geo,paint);m.name=name;root.add(m);
  }
}

function glazed(skin:Skin,ring:Plan[],base:number,top:number,levels:number,lights:Window[],residential:boolean){
  ring.forEach((a,i)=>{
    const b=ring[(i+1)%ring.length],du=b[0]-a[0],dv=b[1]-a[1],length=Math.hypot(du,dv);
    const count=Math.max(1,Math.round(length/(residential?.089:.19))),pitch=(top-base)/levels;
    const normal:Plan=[-dv/length,du/length];
    const at=(t:number,d:number):Plan=>[a[0]+du*t+normal[0]*d,a[1]+dv*t+normal[1]*d];
    for(let k=0;k<count;k++){
      const l=k/count,r=(k+1)/count;
      skin.edge(at(l,0),at(r,0),base,top,blues[(Math.floor(k/3)+i*2)%blues.length]);
      if(count>1){
        const fin=residential&&k%3===1?.015:.0035,x=at(l,fin),w=Math.min(.004/length,.04);
        skin.quad(vertex(at(l,0),base),vertex(x,base),vertex(x,top),vertex(at(l,0),top),steel);
        skin.edge(x,at(l+w,fin),base,top,residential&&k%3===1?metal:'#576e78');
        skin.quad(vertex(at(l+w,fin),base),vertex(at(l+w,0),base),vertex(at(l+w,0),top),vertex(at(l+w,fin),top),steel);
      }
      // Scattered operable lights and darkened interiors break the long flush glazing units.
      for(let floor=(k*5+i*3)%11;floor<levels;floor+=11){
        const y=base+floor*pitch,lo=y+pitch*.17,hi=y+pitch*.83;
        skin.edge(at(l+.08/count,.001),at(r-.08/count,.001),lo,hi,'#647d86');
        const [x,py,z]=world(vertex(at((l+r)/2,.003),(lo+hi)/2));
        lights.push({x,y:py,z,ry:Math.atan2(normal[0]*c-normal[1]*s,normal[0]*s+normal[1]*c),w:length/count*.76,h:(hi-lo)*.94});
      }
    }
    for(let j=1;j<levels;j++){
      const y=base+j*pitch;
      skin.edge(at(0,.002),at(1,.002),y-pitch*.13,y,'#647d87');
      skin.edge(at(0,.003),at(1,.003),y,y+.004,metal);
    }
  });
}

// Two perforated triangular roof screens rise on opposite sides of a diagonal
// open plant slot. SF 2024 8 cm ortho p2024_rgb8cm resolves the slats and slot;
// USGS 2023 1.5 m DSM resolves their different pitches. Scene scale .06/m.
// Handel's Hargis/Damonte photos show the metal-clad canopy and sloped fins:
// https://handelarchitects.com/project/301-mission-san-francisco
// https://enclos.com/project/millennium-tower-301-mission/
function screen(skin:Skin,low:Vertex,end:Vertex,tip:Vertex){
  const blend=(a:Vertex,b:Vertex,t:number):Vertex=>a.map((n,i)=>n+(b[i]-n)*t) as Vertex;
  // Both triangles are wound upwards. The slots between slats admit a view of plant beneath.
  const strip=(t:number,w:number,tone:string)=>{
    const a=blend(low,end,t),b=blend(low,tip,t);
    skin.quad(a,b,blend(low,tip,t+w),blend(low,end,t+w),tone);
  };
  for(let j=1;j<=32;j++)strip((j-.81)/32,.59/32,j%4===0?'#afb4ad':'#9ca7a9');
  strip(.985,.015,metal);
  for(let j=0;j<=5;j++){
    const u=j/5,near=blend(end,tip,Math.max(0,u-.005)),far=blend(end,tip,Math.min(1,u+.005));
    const raised=(v:Vertex):Vertex=>[v[0],v[1]+.003,v[2]];
    skin.quad(raised(blend(low,near,.025)),raised(blend(low,far,.025)),raised(far),raised(near),steel);
  }
  for(const [a,b] of [[low,end],[tip,low]]){
    const ap:Vertex=[a[0],a[1]-.031,a[2]],bp:Vertex=[b[0],b[1]-.031,b[2]];
    skin.quad(ap,bp,b,a,metal);skin.quad(bp,ap,a,b,metal);
  }
}

function highRise(skin:Skin,plan:Plan[],lights:Window[]){
  const middle:Plan=[1.44,.98],inset=plan.map(p=>mix(p,middle,.13));
  glazed(skin,inset,.03,.324,1,lights,false);
  const canopy=plan.map(p=>mix(p,middle,-.034));
  skin.block(canopy,.323,.43,'#b8bcb9','#b8bcb9');
  // Inclined, folded metal piers under the two street elevations.
  for(const i of [0,2,3,4,9]){
    const p=plan[i],q=mix(p,middle,.09);
    const base=rect(q[0]-.055,q[0]+.055,q[1]-.066,q[1]+.066);
    const top=rect(p[0]-.083,p[0]+.083,p[1]-.088,p[1]+.088);
    for(let j=0;j<4;j++)skin.quad(vertex(base[j],.03),vertex(base[(j+1)%4],.03),vertex(top[(j+1)%4],.324),vertex(top[j],.324),j%2?'#a3a9a7':'#c5c7c1');
  }
  glazed(skin,plan,.43,10.83,55,lights,true);
  skin.deck(plan,10.83,roof);
  // Shoulders step down outside the raised diagonal head, especially toward the lofts.
  const crown:Vertex[]=[[.10,11.88,1.87],[.83,11.61,1.87],[2.84,11.23,1.17],[2.84,12.07,.195],[2.11,11.74,.195],[.10,11.29,.89]];
  for(let i=0;i<crown.length;i++){
    const a=crown[i],b=crown[(i+1)%crown.length];
    const start:Plan=[a[0],a[2]],end:Plan=[b[0],b[2]];
    const n=Math.max(3,Math.round(Math.hypot(end[0]-start[0],end[1]-start[1])/.085));
    for(let k=0;k<n;k++){
      const l=k/n,r=(k+1)/n,p=mix(start,end,l),q=mix(start,end,r);
      const hi=a[1]+(b[1]-a[1])*l,hj=a[1]+(b[1]-a[1])*r;
      skin.quad(vertex(p,10.83),vertex(q,10.83),vertex(q,hj),vertex(p,hi),blues[(i+Math.floor(k/3))%blues.length]);
      const inset=mix(start,end,Math.min(1,l+.0025));
      const normal:Plan=[-(q[1]-p[1]),q[0]-p[0]],len=Math.hypot(...normal);
      const off=(p:Plan):Plan=>[p[0]+normal[0]/len*.002,p[1]+normal[1]/len*.002];
      skin.quad(vertex(off(p),10.83),vertex(off(inset),10.83),vertex(off(inset),hi),vertex(off(p),hi),'#516a74');
    }
  }
  const plant=rect(.89,1.68,.79,1.11);skin.block(plant,10.83,11.20,'#9ba6a4','#b7b9ad');
  for(const t of [.22,.46,.70]){
    const u=.61+t*1.65,v=1.62-t*1.08;
    skin.block(rect(u-.082,u+.082,v-.055,v+.055),10.83,11.02,steel,'#b5b7b0');
  }
  screen(skin,crown[5],crown[4],crown[0]);
  screen(skin,crown[2],crown[1],crown[3]);
}

// Handel identifies a separate nine-story residential block and a two-story
// glass atrium. Andrew Campbell Nelson's Mission/Main photograph shows its blue
// end wall. The mapped Lofts outline also includes the low linking section.
// https://sfyimby.com/2021/11/number-8-millennium-tower-in-soma-san-francisco.html
function midRise(skin:Skin,plan:Plan[],lights:Window[]){
  skin.block(plan,.025,.045,'#838e8e','#aab0aa');
  skin.block(rect(-.375,.278,2.14,4.94),.045,.55,'#8b9693','#aab0aa');
  skin.block(rect(.05,2.89,2.09,3.39),.045,.304,'#859391','#aab0aa');
  const bar=rect(.285,2.91,3.39,5.045);
  const base=rect(.325,2.87,3.43,5.00);
  glazed(skin,base,.03,.48,2,lights,false);
  skin.block(bar,.475,.525,'#a7b0ad','#b8bdb5');
  glazed(skin,bar,.525,2.41,9,lights,true);
  // Flat service deck between the set-back mechanical enclosure and eastern parapet.
  skin.deck(bar,2.41,roof);
  skin.block(rect(.36,2.84,3.43,4.34),2.41,2.64,'#a4a7a2','#b8b8ae');
  for(const [u,w] of [[.78,.22],[1.69,.235],[2.40,.236]]){
    skin.block(rect(u-w,u+w,4.54,4.88),2.41,2.64,steel,'#a4aaa6');
    for(let j=0;j<9;j++)skin.deck(rect(u-w*.84,u+w*.84,4.569+j*.032,4.581+j*.032),2.642,'#737e7e');
  }
  for(const u of [.285,2.89])skin.block(rect(u,u+.024,3.39,5.045),2.41,2.699,steel,metal);
  skin.block(rect(.285,2.91,3.39,3.42),2.41,2.696,steel,metal);
  skin.block(rect(.285,2.91,4.984,5.045),2.41,2.82,'#788d96',metal);
  const service=rect(.075,2.89,2.77,3.39);
  glazed(skin,service,.30,.641,1,lights,false);skin.deck(service,.641,'#aaa99e');
  // The pitched glass garden roof spans the gap; the street edge is lower.
  const glassEnd=2.855,west=.05,v0=2.055,v1=2.79;
  const height=(u:number)=>.995-.382*(u-west)/(glassEnd-west);
  const glass=rect(west,glassEnd,v0,v1);
  for(let k=0;k<4;k++){
    const a=glass[k],b=glass[(k+1)%4];
    skin.quad(vertex(a,.303),vertex(b,.303),vertex(b,height(b[0])),vertex(a,height(a[0])),'#758d8a');
  }
  const point=(u:number,v:number,h=0):Vertex=>[u,height(u)+h,v];
  const pane=(l:number,r:number,n:number,f:number,h:number,tone:string)=>
    skin.quad(point(l,n,h),point(l,f,h),point(r,f,h),point(r,n,h),tone);
  pane(west,glassEnd,v0,v1,0,'#81938e');
  for(let j=0;j<13;j++){
    const u=west+(glassEnd-west)*j/13;
    pane(u,u+.014,v0,v1,.004,metal);
  }
  for(const v of [v0,v0+(v1-v0)*.5,v1-.012])pane(west,glassEnd,v,v+.012,.005,metal);
}

export function addMillenniumTower(b:Building,root:THREE.Group,windows:Window[]){
  if(b.id!==tower&&b.id!==lofts)return false;
  const skin=new Skin(),plan=b.p.slice(0,-1).map(local);
  if(b.id===tower)highRise(skin,plan,windows);else midRise(skin,plan,windows);
  skin.attach(root,b.id===tower?'301 Mission faceted residential tower':'301 Mission lofts and atrium');
  return true;
}
