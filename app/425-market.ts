import * as THREE from 'three';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';
type Point=[number,number];
type Window={x:number;y:number;z:number;ry:number;w:number;h:number};
const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.70,metalness:.025});
const pale='#c4c1b4',shade='#939389',rim='#d0cbbc',jamb='#a9a79a';
const glasses=['#536367','#53646c','#596668','#55636a','#57656c'];
const at=(u:number,v:number,y:number):FacadePoint=>[-10.733+.98875*u+.1492*v,y,-37.897-.1492*u+.98875*v];
const rectangle=(l:number,r:number,b:number,t:number):Point[]=>[[l,b],[r,b],[r,t],[l,t]];
const grade=.054,roof=9.105,parapet=9.273,shoulder=8.875,first=.389;
function deck(f:FacadePanels,ring:Point[],y:number,color:string){
  for(const [a,b,c] of THREE.ShapeUtils.triangulateShape(ring.map(p=>new THREE.Vector2(...p)),[]))f.triangle(at(...ring[a],y),at(...ring[c],y),at(...ring[b],y),color);
}
function edge(f:FacadePanels,a:Point,b:Point){
  const len=Math.hypot(b[0]-a[0],b[1]-a[1]),dx=(b[0]-a[0])/len,dz=(b[1]-a[1])/len;
  const p=(s:number,y:number,out=0)=>at(a[0]+s*dx+dz*out,a[1]+s*dz-dx*out,y);
  const panel=(l:number,r:number,low:number,high:number,color:string,out=0)=>f.quad(p(l,low,out),p(l,high,out),p(r,high,out),p(r,low,out),color);
  const start=p(0,0),n=p(0,0,1);
  return {p,panel,len,ry:Math.atan2(n[0]-start[0],n[2]-start[2])};
}
function prism(f:FacadePanels,ring:Point[],lo:number,hi:number,wall:string,cap=wall){
  ring.forEach((a,i)=>{const e=edge(f,a,ring[(i+1)%ring.length]);e.panel(0,e.len,lo,hi,wall);});
  deck(f,ring,hi,cap);
}
const circle=(u:number,v:number,r:number,n=12):Point[]=>Array.from({length:n},(_,i)=>[u+r*Math.cos(i*2*Math.PI/n),v+r*Math.sin(i*2*Math.PI/n)]);
function clipped(l:number,r:number,b:number,t:number,c:number):Point[]{
  return [[l+c,b],[r-c,b],[r,b+c],[r,t-c],[r-c,t],[l+c,t],[l,t-c],[l,b+c]];
}
function shaft(f:FacadePanels,windows:Window[]){
  const ring=clipped(0,3.673,0,2.318,.030),pitch=(shoulder-first)/37;
  for(const [i,a] of ring.entries()){
    const e=edge(f,a,ring[(i+1)%8]),n=i%4===0?20:13;
    if(i%2){e.panel(0,e.len,first,parapet,pale);continue;}
    const step=e.len/n;
    // 5-foot glazing module, grouped into pairs behind a full-height blade.
    // The shoulder slopes from the aluminum face down and back into the glass.
    for(let j=0;j<n;j++){
      const l=j*step,r=(j+1)*step;
      e.panel(l,r,first,shoulder,glasses[(i+j)%glasses.length],-.024);
      e.panel(l+step*.50-.002,l+step*.50+.002,first,shoulder,'#728085',-.022);
      e.panel(l,l+.006,first,shoulder,rim,.002);
      f.quad(e.p(l,first,-.024),e.p(l,shoulder,-.024),e.p(l,shoulder,.002),e.p(l,first,.002),shade);
      f.quad(e.p(l+.006,first,.002),e.p(l+.006,shoulder,.002),e.p(l+.006,shoulder,-.024),e.p(l+.006,first,-.024),jamb);
      for(let k=0;k<37;k++){
        const row=first+k*pitch,seed=(j*11+i*7+k*5)%17;
        if(seed===0||seed===3){
          const x=l+(seed===3?step*.52:step*.03);
          e.panel(x,x+step*.44,row+pitch*.77,row+pitch*.975,seed===0?'#85908c':'#758583',-.0233);
        }
        if((j*7+i+k*3)%8!==0)continue;
        const [x,y,z]=e.p(l+step*(k%2?.26:.75),first+(k+.62)*pitch,-.0226);
        windows.push({x,y,z,ry:e.ry,w:step*.39,h:pitch*.48});
      }
    }
    for(let k=0;k<37;k++){
      const y=first+k*pitch,h=y+pitch*.30;
      e.panel(0,e.len,y,y+.014,shade,.001);
      f.quad(e.p(0,y+.014,.001),e.p(0,h,-.024),e.p(e.len,h,-.024),e.p(e.len,y+.014,.001),pale);
    }
    // Broad unbroken aluminum mechanical cap seen in the leasing and field photographs.
    e.panel(0,e.len,shoulder,parapet,pale);
    for(let j=1;j<n*2;j++)e.panel(j*step/2-.0015,j*step/2+.0015,shoulder,parapet,'#aaa99d',.001);
  }
  deck(f,ring,roof,'#c7c6b9');
  for(const [i,a] of ring.entries()){
    const e=edge(f,a,ring[(i+1)%8]),{p,len}=e;
    f.quad(p(0,parapet),p(0,parapet,-.019),p(len,parapet,-.019),p(len,parapet),rim);
    f.quad(p(len,roof,-.019),p(len,parapet,-.019),p(0,parapet,-.019),p(0,roof,-.019),shade);
  }
}
function lobby(f:FacadePanels){
  const ring=clipped(.097,3.56,.115,2.20,.025);
  ring.forEach((a,i)=>{
    const e=edge(f,a,ring[(i+1)%ring.length]);
    if(i%2){e.panel(0,e.len,grade,first,'#969f99');return;}
    const n=Math.round(e.len/.182);
    for(let j=0;j<n;j++){
      const x=j*e.len/n,r=(j+1)*e.len/n;
      const entry=i===2&&j>=Math.floor(n*.32)&&j<Math.ceil(n*.70);
      e.panel(x,r,grade,first,entry?'#526668':'#667677',entry?-.035:0);
      e.panel(x,x+.008,grade,first,'#a9a79a',.002);
      e.panel(x,r,.263,.272,'#a6a397',entry?-.032:.002);
      if(entry)e.panel((x+r)/2-.004,(x+r)/2+.004,grade,.263,rim,-.031);
    }
  });
  // The Market street photograph shows a shadowed, inset glazed lobby behind
  // four squared, stone-clad posts. The long colonnades continue toward Fremont.
  for(const u of [.055,3.618])for(const v of [.07,.89,1.44,2.248])
    prism(f,rectangle(u-.044,u+.044,v-.055,v+.055),grade,first,'#bcb6a5');
  for(const v of [.065,2.253])for(const u of [.73,1.47,2.20,2.94])
    prism(f,rectangle(u-.032,u+.032,v-.033,v+.033),grade,first,'#b7b2a6');
  const under=rectangle(.02,3.65,.02,2.30);
  f.quad(at(...under[0],first),at(...under[1],first),at(...under[2],first),at(...under[3],first),'#8c8f83');
}
function equipment(f:FacadePanels){
  const box=(a:number,b:number,c:number,d:number,y:number,wall:string,cap=wall)=>prism(f,rectangle(a,b,c,d),roof,y,wall,cap);
  // Three service islands around the central five-fan cooling bank, and the
  // recessed perimeter track. Sizes registered to the aerial and USGS DSM.
  const track=clipped(.077,3.596,.065,2.247,.069);
  track.forEach((a,i)=>{
    const e=edge(f,a,track[(i+1)%8]),{p,len}=e;
    f.quad(p(0,roof+.003,-.014),p(len,roof+.003,-.014),p(len,roof+.003,.014),p(0,roof+.003,.014),'#82877e');
  });
  box(.690,1.121,.704,1.558,9.367,'#a6a596','#c9c6b6');
  box(.492,.684,.931,1.08,9.214,'#b9b8a7');
  box(1.16,2.13,.81,1.42,9.278,'#8d9790','#9aa59b');
  for(let i=0;i<5;i++){
    const u=1.267+i*.185;
    prism(f,circle(u,1.115,.084),9.278,9.292,'#aab1a5','#57645e');
    for(let n=0;n<6;n++){
      const t=n*Math.PI/3;
      f.triangle(at(u,1.115,9.294),at(u+.071*Math.cos(t+.37),1.115+.071*Math.sin(t+.37),9.294),at(u+.074*Math.cos(t),1.115+.074*Math.sin(t),9.294),'#9b9f90');
    }
  }
  box(2.511,2.991,.946,1.577,9.337,'#a6a99c','#c6c4b7');
  for(const [a,b,c,d] of [[3.042,3.442,.829,.924],[3.042,3.442,.960,1.062],[1.892,2.234,1.572,1.790]])box(a,b,c,d,9.204,'#a1a494');
  // Low triangular steel mast over the east service enclosure.
  const m=at(2.845,1.431,9.576);
  for(const [x,z] of [[2.54,1.53],[2.93,1.53],[2.83,1.21]]){
    f.quad(at(x-.008,z,9.337),at(x+.008,z,9.337),[m[0]+.004,m[1],m[2]],[m[0]-.004,m[1],m[2]],'#959989');
    f.quad(at(x,z-.007,9.337),[m[0],m[1],m[2]-.004],[m[0],m[1],m[2]+.004],at(x,z+.007,9.337),'#a4a695');
  }
}
function publicGarden(f:FacadePanels){
  const paving=.055;
  deck(f,rectangle(-1.305,.09,-.14,2.37),paving,'#aaa498');
  deck(f,rectangle(.09,3.647,-.14,.11),paving,'#aaa498');
  deck(f,rectangle(1.20,3.647,-1.0,-.14),paving,'#b5b0a5');
  // The two granite colors make the cross-block route legible in shade.
  for(let u=1.40;u<3.63;u+=.36)deck(f,rectangle(u,u+.027,-.97,-.15),paving+.001,'#a09f95');
  for(const v of [-.94,-.59,-.21])deck(f,rectangle(1.22,3.63,v,v+.022),paving+.001,'#9c9d92');
  const foliage=['#6b8063','#849775','#768a69'];
  function tree(u:number,v:number,h:number,n:number){
    prism(f,rectangle(u-.036,u+.036,v-.036,v+.036),paving,paving+.004,'#83897e');
    prism(f,circle(u,v,.013,7),paving+.004,paving+h*.66,'#736d5e');
    const radius=h*.29,count=8;
    const bottom=at(u,v,paving+h*.40),tip=at(u-.009,v+.013,paving+h);
    const lower=circle(u,v,radius*.91,count),upper=circle(u-.012,v+.010,radius,count);
    for(let k=0;k<count;k++){
      const z=(k+1)%count,a=at(...lower[k],paving+h*.58),b=at(...lower[z],paving+h*.58);
      const c=at(...upper[k],paving+h*(.80+.025*Math.cos(k+n))),d=at(...upper[z],paving+h*(.80+.025*Math.cos(z+n)));
      f.triangle(bottom,a,b,foliage[(k+n)%2]);f.quad(a,c,d,b,foliage[(k+n)%3]);f.triangle(c,tip,d,foliage[(k+n+1)%3]);
    }
  }
  function bench(u:number,v:number){
    for(const a of [u-.060,u+.060])prism(f,rectangle(a-.007,a+.007,v-.022,v+.022),paving,paving+.027,'#6a7069');
    for(let i=0;i<3;i++)prism(f,rectangle(u-.084,u+.084,v-.023+i*.016,v-.010+i*.016),paving+.024,paving+.032,'#927b65');
    prism(f,rectangle(u-.084,u+.084,v+.022,v+.030),paving+.033,paving+.065,'#907963');
  }
  function flowerBowl(u:number,v:number,i:number){
    const ring=circle(u,v,.056,12);
    prism(f,ring,paving+.006,paving+.044,'#7e8075','#6c7d60');
    for(let k=0;k<5;k++){
      const a=k*Math.PI*.4+i,U=u+.031*Math.cos(a),V=v+.029*Math.sin(a);
      deck(f,circle(U,V,.013,6),paving+.050,['#aa6471','#b78185','#c3aa9e'][(k+i)%3]);
    }
  }
  // Registered rows of crowns in the side court. SPUR's field plate records
  // separate flower bowls, square tree grates and timber-backed benches.
  for(const [i,u] of [1.84,2.24,2.65,3.02,3.38].entries()){
    for(const [j,v] of [-.79,-.365].entries())tree(u,v,.34+.041*((i+j)%4),i+j);
    if(i===0||i===2||i===4){
      bench(u,-.715);bench(u,-.435);
      flowerBowl(u+.120,-.77,i);flowerBowl(u+.120,-.376,i+1);
    }
  }
}
export function add425Market(b:{id:number},root:THREE.Group,windows:Window[]){
  if(b.id!==32946526)return false;
  const f=new FacadePanels();
  shaft(f,windows);lobby(f);equipment(f);publicGarden(f);
  const mesh=f.mesh(material);mesh.name='425 Market Street';root.add(mesh);return true;
}
