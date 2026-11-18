import * as THREE from 'three';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';

type P=[number,number];
type Building={id:number;p:number[][]};
type Window={x:number;y:number;z:number;ry:number;w:number;h:number};
const towerD=421816059,plazaA=421816065,plazaC=421816064,common=1328554757;
const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.69});
const metal='#c2cbca', glass=['#65899a','#7395a1','#71919e','#688999'];
const silver='#adbfc1', rim='#bfc2b8', paving='#c1bbaa';
const deck=.525, plazaRoof=1.59;
// The SF Planning parcel layer places every component on 3746/008. The 2012
// commission set uses the older 3746/001 and identifies this as 338 Main, Tower D.
// Site frame follows sheet 2: Main above, Folsom left, Beale below.
// https://commissions.sfplanning.org/cpcpackets/2012.1097C.pdf
// https://arquitectonica.com/architecture/project/lumina/
// Heights are relative to 6 m local grade in CA_SanFrancisco_1_B23 (1.5 m DSM).
// Roof hardware and the three courtyard lights follow SF's 2024 8-cm orthophoto.
function world([p,q]:P,y:number):FacadePoint{
  const u=p/145-.6,v=q/145-.5;
  return [-39.312-.991*u-.136*v,y,-18.095+.136*u-.991*v];
}
function site([x,z]:number[]):P{
  const a=x+39.312,b=z+18.095,den=.991**2+.136**2;
  return [145*(.6+(-.991*a+.136*b)/den),145*(.5+(-.136*a-.991*b)/den)];
}
const mix=(a:P,b:P,t:number):P=>[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])];
function ccw(p:P[]) {
  return THREE.ShapeUtils.area(p.map(([x,y])=>new THREE.Vector2(x,y)))<0 ? p.slice().reverse():p;
}
function cap(batch:FacadePanels,p:P[],y:number,color:string,down=false){
  const v=p.map(([x,z])=>new THREE.Vector2(x,z));
  for(const [i,j,k] of THREE.ShapeUtils.triangulateShape(v,[]))
    batch.triangle(world(p[i],y),world(p[down?j:k],y),world(p[down?k:j],y),color);
}
function wall(batch:FacadePanels,a:P,b:P,lo:number,hi:number,color:string){
  batch.quad(world(a,lo),world(a,hi),world(b,hi),world(b,lo),color);
}
function prism(batch:FacadePanels,points:P[],lo:number,hi:number,side:string,top:string){
  const p=ccw(points);
  p.forEach((a,i)=>wall(batch,a,p[(i+1)%p.length],lo,hi,side));cap(batch,p,hi,top);
}
const box=(x:number,y:number,w:number,d:number):P[]=>[[x-w/2,y-d/2],[x+w/2,y-d/2],[x+w/2,y+d/2],[x-w/2,y+d/2]];
function ellipse(x:number,y:number,w:number,d:number,turn:number):P[]{
  return Array.from({length:20},(_,i)=>{
    const a=i*Math.PI/10,u=.5*w*Math.cos(a),v=.5*d*Math.sin(a);
    return [x+Math.cos(turn)*u-Math.sin(turn)*v,y+Math.sin(turn)*u+Math.cos(turn)*v];
  });
}
function cubic(start:P,c:P,d:P,end:P,count:number):P[]{
  return Array.from({length:count+1},(_,i)=>{
    const t=i/count,s=1-t;
    return [s**3*start[0]+3*s*s*t*c[0]+3*s*t*t*d[0]+t**3*end[0],
            s**3*start[1]+3*s*s*t*c[1]+3*s*t*t*d[1]+t**3*end[1]];
  });
}
function windowLight(windows:Window[],a:P,b:P,lo:number,hi:number){
  const [x,,z]=world(a,0),[xx,,zz]=world(b,0),dx=xx-x,dz=zz-z,len=Math.hypot(dx,dz);
  windows.push({x:(xx+x)/2+.002*dz/len,z:(zz+z)/2-.002*dx/len,y:(lo+hi)/2,
    ry:Math.atan2(dz,-dx),w:len*.84,h:(hi-lo)*.88});
}

// Four bowed curtains end at four independent, curved balcony stacks. End
// points were traced on the right-hand Tower D plans of sheets 17, 19 and 20.
function towerArcs(tier:number){
  const hinge1:P=tier===0?[1150,137]:tier===1?[1153,185]:[1145,232];
  const join1:P=tier===0?[1171,111]:tier===1?[1181,164]:[1177,214];
  const hinge2:P=tier===0?[1225,539]:tier===1?[1224,541]:[1223,539];
  const hinge3:P=tier===0?[807,604]:tier===1?[800,562]:[815,511];
  const join3:P=tier===0?[784,630]:tier===1?[774,582]:[780,527];
  const arcs=[
    cubic([705,192],[728,55+13*tier],[1028,54+13*tier],hinge1,13),
    cubic(join1,[1260,147+45*tier],[1282,388],hinge2,15),
    cubic([1252,549],[1220,697-10*tier],[950,662-8*tier],hinge3,13),
    cubic(join3,[672,572-36*tier],[691,346],[735,201],14)
  ];
  const survey=([x,y]:P):P=>[452+(x-698)*.578,56+(y-86)*.564];
  return arcs.map(arc=>arc.map(survey));
}

function tower(batch:FacadePanels,windows:Window[]){
  const elevations=[deck,4.38,6.17,6.53],floorCounts=[23,10,2];
  for(let t=0;t<3;t++){
    const arcs=towerArcs(t),lo=elevations[t],hi=elevations[t+1],rows=floorCounts[t];
    const pitch=(hi-lo)/rows;
    // Curves run clockwise on the drawing, which has positive y downward.
    const footprint=arcs.flat();
    cap(batch,footprint,hi,rim);
    const outside=footprint.reduce((area,a,i)=>{const b=footprint[(i+1)%footprint.length];return area+a[0]*b[1]-a[1]*b[0];},0);
    for(const [j,arc] of arcs.entries()){
      for(let n=0;n<arc.length-1;n++){
        const a=arc[n],b=arc[n+1],m=mix(a,b,.063);
        wall(batch,a,m,lo,hi,metal);
        for(let k=0;k<rows;k++){
          const bottom=lo+k*pitch,sill=bottom+pitch*.135,top=bottom+pitch;
          wall(batch,m,b,bottom,sill,'#829ba3');
          wall(batch,m,b,sill,top,glass[(Math.floor(n/3)+Math.floor(k/5)+j)%4]);
          if((7*k+n*3+j)%12===0)windowLight(windows,m,b,sill,top);
        }
      }
      const a=arc.at(-1)!,b=arcs[(j+1)%4][0],du=b[0]-a[0],dv=b[1]-a[1],len=Math.hypot(du,dv);
      const reach=Math.min(11,len*.41), rimline=Array.from({length:5},(_,n):P=>{
        const t=n/4,z=4*t*(1-t)*reach*(outside>0?1:-1);
        return [a[0]+du*t+dv*z/len,a[1]+dv*t-du*z/len];
      });
      for(let row=0;row<rows;row++){
        const y=lo+row*pitch;
        wall(batch,a,b,y,y+pitch,'#607d8b');
        for(let n=0;n<4;n++){
          wall(batch,rimline[n],rimline[n+1],y,y+.014,metal);
          wall(batch,rimline[n],rimline[n+1],y+.014,y+.067,'#97adb3');
        }
        cap(batch,rimline,y+.014,paving);cap(batch,rimline,y,metal,true);
      }
    }
  }
  // Lens-shaped roof screen runs NW to SE, across the stepped side wings.
  const crown=[...cubic([454,95],[471,17],[719,27],[764,281],21).slice(0,-1),
    ...cubic([764,281],[779,298],[780,302],[785,308],3).slice(0,-1),
    ...cubic([785,308],[763,406],[495,368],[477,101],23).slice(0,-1),
    [454,95] as P].slice(0,-1);
  const top=6.925,inner=crown.map(p=>mix(p,[618,203],.025));
  crown.forEach((a,i)=>{
    const j=(i+1)%crown.length,b=crown[j],m=mix(a,b,.08);
    wall(batch,a,m,6.53,top,metal);wall(batch,m,b,6.53,top,glass[i%4]);
    wall(batch,inner[j],inner[i],6.755,top,'#909e9e');
    cap(batch,[a,b,inner[j],inner[i]],top,silver);
  });
  cap(batch,inner,6.755,'#929995');
  prism(batch,box(636,204,97,94),6.755,6.935,'#a4a5a0','#d1cebf');
  prism(batch,box(570,174,32,146),6.755,6.897,'#92958d','#b3b2a5');
  prism(batch,box(716,321,83,43),6.755,6.829,'#8c9292','#697675');
  for(const x of [698,735]){
    cap(batch,ellipse(x,321,30,30,0),6.831,'#c4c4b9');
    cap(batch,ellipse(x,321,25,25,0),6.832,'#65716c');
    for(let i=0;i<5;i++){
      const a=i*2*Math.PI/5;
      const tip=(r:number,t:number):P=>[x+r*Math.cos(t),321+r*Math.sin(t)];
      cap(batch,[tip(2,a),tip(12,a+.14),tip(12,a+.69)],6.833,'#b5b7aa');
    }
  }
}

function plaza(batch:FacadePanels,isA:boolean,windows:Window[]){
  // Both eight-story plazas have sawtooth bays along their two street edges.
  // The other two sides open to the podium garden. The as-built southern roof
  // has a planted grove, unlike the extensive low planting on the Main roof.
  const poly:P[]=isA?[[57,84],[85,60],[149,73],[171,62],[215,74],[239,63],[278,75],
    [307,64],[379,79],[357,388],[210,402],[193,416],[79,438]]:
    [[433,754],[464,509],[498,503],[510,488],[613,475],[628,460],[680,458],[694,441],
     [781,443],[790,473],[783,769],[750,780],[710,771],[679,784],[639,774],[606,788],
     [568,776],[537,788],[493,777],[467,785],[432,773]];
  if(isA) for(let j=0;j<5;j++){
    const y=403-j*62;
    poly.push([62,y],[72,y-27],[63,y-53]);
  }
  const p=ccw(poly),base=deck, top=plazaRoof, pitch=(top-base)/7;
  for(const [i,a] of p.entries()){
    const b=p[(i+1)%p.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
    const cols=Math.max(1,Math.round(len/15));
    for(let col=0;col<cols;col++){
      const l=mix(a,b,col/cols),r=mix(a,b,(col+1)/cols),m=mix(l,r,.10);
      wall(batch,l,m,base,top,metal);
      for(let k=0;k<7;k++){
        const y=base+k*pitch,sill=y+pitch*(k===6?.29:.20);
        wall(batch,m,r,y,sill,'#c3c9c7');
        wall(batch,m,r,sill,y+pitch,glass[(Math.floor(col/2)+k+i)%4]);
        if((k+col*2+i)%10===0)windowLight(windows,m,r,sill,y+pitch);
      }
    }
    wall(batch,a,b,top,top+.032,metal);
  }
  cap(batch,p,top+.032,'#c0bbab');
  if(isA){
    const soil:P[]=[[81,107],[110,90],[344,88],[324,369],[194,383],[169,404],[93,412]];
    cap(batch,soil,top+.033,'#99987d');
    // The roof walk wraps the service core, bisecting the planting.
    cap(batch,[[148,91],[158,91],[192,399],[181,401]],top+.035,'#bdb7a8');
    prism(batch,box(215,231,92,147),top+.034,1.79,'#a19f94','#c2c1b4');
    prism(batch,box(214,207,65,59),1.79,1.884,'#a8a99c','#d0cdbd');
    for(const [x,y] of [[110,126],[124,155],[119,276],[116,341],[185,113],[267,114],
       [282,177],[276,235],[297,329],[219,364],[105,381]])
      cap(batch,ellipse(x,y,20,13,-.37),top+.036,'#858b6e');
  }else{
    const bed:P[]=[[453,741],[481,523],[622,471],[753,461],[758,504],[640,537],[541,579],[512,709],[486,748]];
    cap(batch,bed,top+.034,'#85886b');
    for(const [x,y,r] of [[467,708,32],[481,677,35],[486,639,38],[491,604,37],[505,575,32],
      [522,549,38],[560,539,35],[589,530,37],[619,511,39],[658,508,38],[692,496,33],[728,490,29]]){
      const crown=ellipse(x,y,r*1.5,r*1.13,.2);
      prism(batch,box(x,y,3,3),top+.034,top+.20,'#87816e','#87816e');
      const center=world([x,y],top+.32+(x%3)*.03);
      for(let n=0;n<crown.length;n++)batch.triangle(world(crown[n],top+.19),center,world(crown[(n+1)%crown.length],top+.19),n%4?'#718367':'#819071');
    }
    prism(batch,box(605,622,138,95),top+.033,1.805,'#8a9189','#b6b9af');
    prism(batch,box(632,615,64,59),1.805,1.859,'#a8aaa1','#d1cfc4');
    prism(batch,box(574,617,45,52),1.805,1.828,'#89938d','#91a09c');
    cap(batch,box(718,621,52,107),top+.035,'#8f9378');
    for(const x of [574,634,701])prism(batch,box(x,712,21,8),top+.035,1.68,'#9b846b','#b1997f');
  }
}

function podium(batch:FacadePanels,building:Building){
  const p=ccw(building.p.slice(0,-1).map(site));
  p.forEach((a,i)=>{
    const b=p[(i+1)%p.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]),cols=Math.max(1,Math.round(len/22));
    const mid=mix(a,b,.5);
    const street=mid[1]<120?'Main':mid[1]>747?'Beale':mid[0]<110?'Folsom':'passage';
    const du=b[0]-a[0],dv=b[1]-a[1];
    for(let col=0;col<cols;col++){
      const l=mix(a,b,col/cols),r=mix(a,b,(col+1)/cols),j=mix(l,r,.15);
      const [x,y]=mix(l,r,.5);
      const entry=street==='Main'&&(x>540&&x<585 || x>195&&x<225)
        || street==='Beale' && x>653&&x<683;
      const garage=street==='passage'&&x>758&&y>327&&y<401;
      const inset=entry?9:garage?5:2.5;
      const recess=(s:P):P=>[s[0]-dv*inset/len,s[1]+du*inset/len];
      wall(batch,l,j,.025,deck,'#adaba4');
      wall(batch,j,recess(j),.025,deck,'#8a8a83');
      wall(batch,recess(r),r,.025,deck,'#92918c');
      wall(batch,recess(j),recess(r),.025,deck,garage?'#626b6a':'#667e80');
      wall(batch,recess(j),recess(r),.225,.237,silver);
      if(entry)wall(batch,recess(mix(j,r,.48)),recess(mix(j,r,.52)),.025,.225,silver);
    }
  });
  cap(batch,p,deck,'#a4a891');
  // The upper garden's walks lead around the pool lights to all four lobbies.
  // The narrow beds and diagonal passages remain inside the mapped common roof.
  const beds:P[][]=[
    [[361,181],[376,160],[398,144],[445,128],[449,138],[398,166],[375,193]],
    [[501,382],[560,378],[615,391],[637,413],[622,429],[595,403],[535,397]],
    [[295,433],[331,413],[355,400],[377,395],[378,406],[344,429],[314,445]],
    [[440,498],[452,475],[468,464],[477,465],[475,477],[452,505]]
  ];
  for(const bed of beds)cap(batch,bed,deck+.003,'#788b71');
  // Three distinct oval glazed roof lights sit over the pool/fitness hall.
  // Their rotation and spacing follow the 2024 image rather than the proposal.
  for(const [x,y,w,h,angle] of [[423,338,75,38,-1.30],[394,449,83,41,-1.15],[497,429,108,67,.17]]){
    const outer=ellipse(x,y,w,h,angle);
    prism(batch,outer,deck,deck+.029,'#aeb9b6','#a9b9b8');
    cap(batch,ellipse(x,y,w-4,h-4,angle),deck+.031,'#859ca1');
    for(const frac of [-.5,0,.5]){
      const u=frac*(w-6)/2,dy=Math.sqrt(1-frac*frac)*(h-6)/2;
      const at=(a:number,b:number):P=>[x+a*Math.cos(angle)-b*Math.sin(angle),y+a*Math.sin(angle)+b*Math.cos(angle)];
      cap(batch,[at(u-.65,-dy),at(u+.65,-dy),at(u+.65,dy),at(u-.65,dy)],deck+.032,silver);
    }
  }
}

export function addLuminaMainStreet(b:Building,root:THREE.Group,windows:Window[]){
  if(b.id!==towerD && b.id!==common && b.id!==plazaA && b.id!==plazaC)return false;
  const batch=new FacadePanels();
  if(b.id===towerD)tower(batch,windows);
  else if(b.id===common)podium(batch,b);
  else plaza(batch,b.id===plazaA,windows);
  const mesh=batch.mesh(material);
  mesh.name=b.id===towerD?'LUMINA II · Tower D, 338 Main':b.id===common?'LUMINA common podium':
    b.id===plazaA?'LUMINA Plaza A · 318 Main':'LUMINA Plaza C · 333 Beale';
  root.add(mesh);
  return true;
}
