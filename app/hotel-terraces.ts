import * as THREE from 'three';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';
import {donCheeHotelCurb,donCheeBedHeight} from './steuart-junction.ts';

const paint=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.91});
type Plan=[number,number];
const pavement=.068;
const unit=.06;

/** Traced between the museum corner and its neighbor on SF's 2024 orthophoto.
 * The north edge uses precisely the line and grade of the streetcar reservation. */
export function addMuseumWalk(root:THREE.Group){
  const wall:Plan[]=[[-8.611,-7.807],[-8.462,-6.749],[-8.53,-6.50],[-8.40,-5.50],[-8.52,-5.22],[-8.45,-4.65]];
  const curb=donCheeHotelCurb.filter(p=>p[1]>-7.86);
  const panels=new FacadePanels();
  function wallX(z:number){
    const i=wall.findIndex(p=>p[1]>=z);
    if(i<=0)return i===0?wall[0][0]:wall.at(-1)![0];
    const [a,b]=[wall[i-1],wall[i]];
    return a[0]+(b[0]-a[0])*(z-a[1])/(b[1]-a[1]);
  }
  function edgeX(z:number){
    const i=donCheeHotelCurb.findIndex(p=>p[1]>=z),a=donCheeHotelCurb[i-1],b=donCheeHotelCurb[i];
    return a[0]+(b[0]-a[0])*(z-a[1])/(b[1]-a[1]);
  }
  const zs=Array.from(new Set([...curb.map(p=>p[1]),...wall.map(p=>p[1]),-7.95])).sort((a,b)=>a-b);
  for(let i=1;i<zs.length;i++){
    const a=zs[i-1],b=zs[i],n=Math.ceil((b-a)/.145);
    for(let j=0;j<n;j++){
      const l=a+(b-a)*j/n,r=a+(b-a)*(j+1)/n;
      function cross(z:number,d:number):FacadePoint{
        const t=Math.max(0,Math.min(1,(z+7.95)/.13)),x=edgeX(z);
        const inside=wallX(z)-.018*(1-t),width=x-inside;
        const h=donCheeBedHeight(z)+.008*t;
        return [inside+width*d,h+(pavement-h)*t*(1-d),z];
      }
      panels.quad(cross(l,0),cross(r,0),cross(r,.87),cross(l,.87),j%2?'#b8b4a8':'#bcb7ac');
      panels.quad(cross(l,.87),cross(r,.87),cross(r,1),cross(l,1),'#c8c2b4');
      const p=cross(l,1),q=cross(r,1);
      panels.quad(p,q,[q[0],donCheeBedHeight(r)-.0005,r],[p[0],donCheeBedHeight(l)-.0005,l],'#9e9c8e');
    }
  }
  const walk=panels.mesh(paint);walk.name='Don Chee museum sidewalk and dropped corner';root.add(walk);
}

// A local orthonormal frame for each furniture placement. Dimensions are in
// metres, including seats at 450 mm and dining tops at 740 mm above the patio.
function furnishings(p:FacadePanels,x:number,base:number,z:number,yaw:number){
  const c=Math.cos(yaw)*unit,s=Math.sin(yaw)*unit;
  const at=(u:number,y:number,v:number):FacadePoint=>[x+c*u+s*v,base+y*unit,z-s*u+c*v];
  function cuboid(u:number,y:number,v:number,w:number,h:number,d:number,color:string){
    const a=u-w/2,b=u+w/2,l=v-d/2,r=v+d/2,t=y+h;
    p.quad(at(a,t,l),at(a,t,r),at(b,t,r),at(b,t,l),color);
    p.quad(at(a,y,r),at(b,y,r),at(b,t,r),at(a,t,r),color);
    p.quad(at(b,y,l),at(a,y,l),at(a,t,l),at(b,t,l),color);
    p.quad(at(a,y,l),at(a,y,r),at(a,t,r),at(a,t,l),color);
    p.quad(at(b,y,r),at(b,y,l),at(b,t,l),at(b,t,r),color);
  }
  function bowl(u:number,y:number,v:number,r:number,h:number,color:string,n=10){
    for(let i=0;i<n;i++){
      const a=i*2*Math.PI/n,b=(i+1)*2*Math.PI/n;
      const vtx=(a:number,y:number,r:number)=>at(u+Math.sin(a)*r,y,v+Math.cos(a)*r);
      p.quad(vtx(a,y,r*.80),vtx(b,y,r*.80),vtx(b,y+h,r),vtx(a,y+h,r),color);
      p.triangle(at(u,y+h,v),vtx(a,y+h,r),vtx(b,y+h,r),color);
    }
  }
  return {cuboid,bowl,at};
}
const plate=(x:number,y:number):Plan=>[x/132-13,-4-y/132];
const streetYaw=.141;
const patioTablePositions:Plan[]=[
  [241,82],[276,86],[315,94],[354,98],[396,106],
  [232,55],[267,58],[309,65],[348,70],[400,82],
].map(([x,y])=>plate(x,y));

export const patioFurniture={positions:patioTablePositions,yaw:-streetYaw,ground:.051,chairOffset:.67};

function diningTable(p:FacadePanels,x:number,z:number,i:number){
  const {cuboid,bowl}=furnishings(p,x,patioFurniture.ground,z,patioFurniture.yaw);
  const oak=i%3===0?'#a97653':'#ae8262',slat='#765f4c';
  for(const dx of [-.45,.45])for(const dz of [-.35,.35])cuboid(dx,0,dz,.07,.70,.07,slat);
  cuboid(0,.686,0,1.12,.055,.86,oak);
  for(const t of [-.27,0,.27])cuboid(0,.741,t,1.09,.003,.009,slat);
  bowl(.05,.745,.03,.078,.12,'#cdba95',8);
  for(const side of [-1,1]){
    const cz=side*patioFurniture.chairOffset;
    for(const u of [-.22,.22])for(const v of [-.20,.20])cuboid(u,0,cz+v,.044,.414,.044,slat);
    cuboid(0,.414,cz,.48,.037,.46,oak);cuboid(0,.451,cz,.46,.039,.43,'#e0d0ae');
    for(const u of [-.21,.21])cuboid(u,.45,cz+.20*side,.040,.39,.04,oak);
    cuboid(0,.69,cz+.21*side,.46,.125,.028,'#c7b79a');
  }
}

function patio(p:FacadePanels){
  const corners=[[194,34],[432,66],[451,131],[197,101]].map(([x,y])=>plate(x,y));
  const v=(i:number,h:number):FacadePoint=>[corners[i][0],h,corners[i][1]];
  const deck=patioFurniture.ground;
  p.quad(v(0,deck),v(1,deck),v(2,deck),v(3,deck),'#b9ac98');
  for(let i=0;i<4;i++){
    const j=(i+1)%4;
    p.quad(v(i,.035),v(j,.035),v(j,deck),v(i,deck),'#aa9f91');
  }
  for(const [i,pt] of patioTablePositions.entries())diningTable(p,pt[0],pt[1],i);
  // The outer balustrade and three strands of festoon lights leave the broad
  // waterfront sidewalk open. Each glowing bulb shares the city's night batch.
  const lights=new FacadePanels();
  for(const u of [.08,.47,.88]){
    const mix=(a:number,b:number,t:number):Plan=>[0,1].map(i=>corners[a][i]+(corners[b][i]-corners[a][i])*t) as Plan;
    const outer=mix(0,1,u),inner=mix(3,2,u),height=.228;
    furnishings(p,outer[0],.051,outer[1],0).cuboid(0,0,0,.045,2.95,.045,'#5a5c50');
    const pt=(t:number):FacadePoint=>[outer[0]+(inner[0]-outer[0])*t,height-.019*Math.sin(t*Math.PI),outer[1]+(inner[1]-outer[1])*t];
    for(let j=0;j<8;j++){
      const a=pt(j/8),b=pt((j+1)/8);
      p.quad(a,b,[b[0],b[1]-.0012,b[2]],[a[0],a[1]-.0012,a[2]],'#535651');
      if(j%2===1)furnishings(lights,a[0],a[1]-.006,a[2],0).bowl(0,0,0,.043,.063,'#eac699',6);
    }
  }
  return lights;
}

export function addHotelTerraces(root:THREE.Group,id:number,top:number){
  const p=new FacadePanels();
  const atPixel=(u:number,v:number,angle=-streetYaw)=>{
    const [x,z]=plate(u,v);return furnishings(p,x,top,z,angle);
  };
  const planting=(x:number,y:number,length:number)=>{
    const {cuboid,bowl}=atPixel(x,y);cuboid(0,0,0,length,.48,.64,'#998a76');
    for(let j=0;j<Math.ceil(length/.30);j++){
      const t=(j+.5)/Math.ceil(length/.30)-.5;
      bowl(length*t,.45,Math.sin(j*5.37)*.09,.22,.35+.25*(.5+.5*Math.sin(j*3.5)),j%3?'#78836a':'#667c68',6);
    }
  };
  if(id===193054134){
    const lights=patio(p).mesh(paint);lights.name='Terrene festoon lamp glass';lights.userData.signLight=[.66,.36,.12];root.add(lights);
  }else if(id===1487225650){
    // The circular sunscreen crowns the projecting Mission/Embarcadero bay.
    const center:Plan=[-11.827,-5.061],yaw0=-.53*Math.PI;
    for(let i=0;i<16;i++){
      const a=yaw0+Math.PI*1.23*i/16,b=yaw0+Math.PI*1.23*(i+1)/16;
      const pos=(ang:number,r:number,y:number):FacadePoint=>[center[0]+r*Math.sin(ang),top+y,center[1]+r*Math.cos(ang)];
      p.quad(pos(a,.247,.013),pos(a,.315,.023),pos(b,.315,.023),pos(b,.247,.013),i%3===0?'#738588':'#b5b9af');
      p.quad(pos(a,.315,.010),pos(b,.315,.010),pos(b,.315,.023),pos(a,.315,.023),'#798783');
    }
    for(const [u,v,n] of [[183,226,4],[195,277,3],[139,329,2]]){
      const {cuboid,bowl}=atPixel(u,v);cuboid(0,0,0,1.9,.57,n*1.02,'#c0c2b8');
      for(let j=0;j<n;j++)bowl(0,.57,(j-(n-1)/2)*.95,.42,.075,'#677271');
    }
  }else{
    const arrangements:Record<number,number[][]>={
      1487225647:[[491,359,2.8],[568,419,2.1]],1487225648:[[409,367,2.8],[385,429,3.1]],
      1487225649:[[276,335,2.4],[241,390,3.0]],1487225651:[[343,147,2.8]],1487225652:[[428,211,2.4]],
    };
    for(const [x,y,length] of arrangements[id]??[])planting(x,y,length);
    if(id===1487225648||id===1487225649){
      const [u,v]=id===1487225648?[401,402]:[282,400],f=atPixel(u,v);
      f.cuboid(0,0,0,4.0,.04,3,'#a9896f');
      for(const side of [-1,1]){
        f.cuboid(side*1.28,.04,0,.55,.34,1.72,'#856957');f.cuboid(side*1.28,.38,0,.55,.07,1.68,'#d7c9b2');
      }
      f.bowl(0,.06,0,.42,.36,'#71695c');
    }
  }
  if(p.indices.length){const deck=p.mesh(paint);deck.name=id===193054134?'Terrene waterfront dining patio':'Planted hotel terrace and roof furniture';root.add(deck);}
}
