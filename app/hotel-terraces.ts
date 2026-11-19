import * as THREE from 'three';
import {museumWalkSeam} from './curb-survey.ts';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';
import {donCheeHotelCurb,donCheeGutterHeight} from './steuart-junction.ts';

const paint=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.91});
type Plan=[number,number];
const pavement=.068;
const unit=.06;

/** Don Chee south sidewalk abuts Steuart sidewalk 337 and municipal curb
 * return 3818976. Its last cross-section is already present in the curb mesh.
 * The concrete door approach and lowered edge are visible in the Railway
 * Museum's entrance photograph. No tactile stud pattern is resolved here. */
export function addMuseumWalk(root:THREE.Group){
  const wall:Plan[]=[[-8.611,-7.807],[-8.462,-6.749],[-8.53,-6.50],[-8.40,-5.50],[-8.52,-5.22],[-8.45,-4.65]];
  const panels=new FacadePanels(),stone='#c1baab',lip='#c8c2b4',face='#9e9c8e';
  function interpolate(rows:Plan[],z:number){
    const i=rows.findIndex(p=>p[1]>=z);
    if(i<=0)return rows[i===0?0:rows.length-1][0];
    const [a,b]=[rows[i-1],rows[i]];
    return a[0]+(b[0]-a[0])*(z-a[1])/(b[1]-a[1]);
  }
  // The cut grade returns to a six-inch curb outside the sloped approach.
  const curbRise:Plan[]=[[.00914,-7.8248073],[.0028,-7.774],[0,-7.709],[0,-7.51],[.008,-7.40]];
  // Walk up toward the sill from the trackside approach. Its wall edge
  // stays level along the door, including the recess behind the exterior brick.
  const wallGrade:Plan[]=[[.045,-7.834],[.050,-7.774],[.061,-7.709],[pavement,-7.698]];
  function row(z:number){
    const gutter=donCheeGutterHeight(z),edge=interpolate(donCheeHotelCurb,z);
    const top=gutter+interpolate(curbRise,z);
    const inside=interpolate(wall,z);
    const back=interpolate(wallGrade,z);
    const width=edge-.012-inside;
    // Carry the sill level across the entrance landing. The outer part of
    // the walk follows the dropped gutter; at the far end it becomes a curb.
    const landing=Math.min(width*.40,.072),transition=THREE.MathUtils.smoothstep(z,-7.71,-7.66);
    const fall=THREE.MathUtils.lerp((back-top-.00035)*landing/width,.001,transition);
    return [[inside,back,z],[edge-.012,top+.00035,z],[edge,top,z],[edge,gutter,z],[inside+landing,back-fall,z]] as FacadePoint[];
  }
  function topPolygon(outline:FacadePoint[],tint:string){
    const tris=THREE.ShapeUtils.triangulateShape(outline.map(([x,,z])=>new THREE.Vector2(x,-z)),[]);
    for(const [a,b,c] of tris)panels.triangle(outline[a],outline[b],outline[c],tint);
  }
  // Continue the clipped back edge of sidewalk 337 and the five-point curb
  // profile. Joining this oblique polyline avoids a flat cover on the old arc.
  const endX=-8.513,endZ=-7.824,nx=.936,nz=-.351;
  const cap=(t:number,y:number):FacadePoint=>[endX+nx*t,y,endZ+nz*t];
  const steuartWall:Plan[]=[[-12.0,-7.3239],[-11.664,-7.371],[-10.851,-7.4878],[-10.531,-7.533],
    [-9.564,-7.671],[-8.611,-7.807]];
  function backOfWalk(x:number){
    return x< -10.851?-7.504+(x+10.851)*(.171/-1.149):-7.844+(x+8.554)*(.340/-2.297);
  }
  for(let k=1;k<steuartWall.length;k++){
    const [a,z]=steuartWall[k-1],[b,w]=steuartWall[k];
    panels.quad([a,.045,backOfWalk(a)],[a,.0472,z],[b,.0472,w],[b,.045,backOfWalk(b)],stone);
  }
  const inner:FacadePoint=[-8.611,.045,backOfWalk(-8.611)];
  const start=row(-7.774);
  topPolygon([inner,[museumWalkSeam[0],.045,museumWalkSeam[1]],cap(-.031,.0451),cap(-.011,.04064),
    start[1],start[4],start[0],[-8.611,.0472,-7.807]],stone);
  topPolygon([cap(-.011,.04064),cap(0,.04064),start[2],start[1]],lip);
  panels.quad(cap(0,.04064),start[2],start[3],cap(.0023,.0315),face);
  const zs=Array.from(new Set([-7.774,...donCheeHotelCurb.map(p=>p[1]),...wall.map(p=>p[1]),
    ...curbRise.map(p=>p[1]),...wallGrade.map(p=>p[1]),-7.71,-7.51])).filter(z=>z>=-7.774).sort((a,b)=>a-b);
  for(let i=1;i<zs.length;i++){
    const a=zs[i-1],b=zs[i],n=Math.ceil((b-a)/.19);
    for(let j=0;j<n;j++){
      const lo=row(a+(b-a)*j/n),hi=row(a+(b-a)*(j+1)/n);
      panels.quad(lo[0],hi[0],hi[4],lo[4],stone);
      panels.quad(lo[4],hi[4],hi[1],lo[1],stone);
      panels.quad(lo[1],hi[1],hi[2],lo[2],lip);
      panels.quad(lo[2],hi[2],hi[3],lo[3],face);
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
  const {cuboid,bowl,at}=furnishings(p,x,patioFurniture.ground,z,patioFurniture.yaw);
  const oak=i%3===0?'#a97653':'#ae8262',slat='#765f4c';
  for(const dx of [-.45,.45])for(const dz of [-.35,.35])cuboid(dx,0,dz,.07,.70,.07,slat);
  cuboid(0,.686,0,1.12,.055,.86,oak);
  for(const t of [-.27,0,.27])cuboid(0,.741,t,1.09,.003,.009,slat);
  bowl(.05,.745,.03,.078,.12,'#cdba95',8);
  for(const side of [-1,1]){
    const cz=side*patioFurniture.chairOffset;
    for(const u of [-.22,.22])for(const v of [-.20,.20])cuboid(u,0,cz+v,.044,.414,.044,slat);
    cuboid(0,.414,cz,.48,.037,.46,oak);cuboid(0,.451,cz,.46,.039,.43,'#e0d0ae');
    // The window row has canvas backs. Along the walk the curved cane chairs
    // have the lighter open profile visible in the hotel's patio photograph.
    if(i>=5){
      for(const u of [-.218,.218])cuboid(u,.45,cz+.20*side,.039,.40,.039,oak);
      cuboid(0,.648,cz+.20*side,.405,.177,.025,'#b9b3a0');
    }else curvedBack(side,cz);
    bowl(0,.745,.239*side,.123,.013,'#d5c5ad',12);
    bowl(0,.758,.239*side,.103,.004,'#efe6d0',12);
    cuboid(.209,.745,.249*side,.080,.013,.176,'#595551');
    if(i!==3||side>0)bowl(-.171,.745,.164*side,.041,.092,'#b7c6bd',8);
  }
  function curvedBack(side:number,cz:number){
    // A single bent cane back sweeps from elbow height at the arms up
    // around the cushion. The cutouts between the woven bands read at cab scale.
    const profile=(t:number,r:number,h:number):FacadePoint=>{
      const a=t*Math.PI*1.24-Math.PI*.62;
      return at(Math.sin(a)*r,h+.145*Math.cos(a),cz+side*Math.cos(a)*(r+.007));
    };
    for(let j=0;j<10;j++){
      const t=j/10,next=(j+1)/10;
      for(const [h,band] of [[.713,.031],[.650,.043],[.568,.033]]){
        const a=profile(t,.252,h),b=profile(next,.252,h),c=profile(next,.252,h+band),d=profile(t,.252,h+band);
        if(side>0)p.quad(a,b,c,d,'#b29571');else p.quad(d,c,b,a,'#b29571');
        if(side>0)p.quad(profile(t,.232,h+band),d,c,profile(next,.232,h+band),'#c6ad87');
        else p.quad(profile(next,.232,h+band),c,d,profile(t,.232,h+band),'#c6ad87');
        if(side>0)p.quad(profile(t,.232,h+band),profile(next,.232,h+band),profile(next,.232,h),profile(t,.232,h),'#a98b67');
        else p.quad(profile(t,.232,h),profile(next,.232,h),profile(next,.232,h+band),profile(t,.232,h+band),'#a98b67');
      }
    }
    for(const t of [.045,.29,.5,.71,.955]){
      const a=(t-.5)*Math.PI*1.24,r=.243;
      cuboid(Math.sin(a)*r,.45,cz+side*Math.cos(a)*(r+.007),.027,.267+.145*Math.cos(a),.034,'#997c60');
    }
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
  // A service cupboard at the end and the fine top edge of the windscreens
  // define the patio without filling the waterfront sightline with a glass wall.
  const cabinet=plate(204,69);
  const f=furnishings(p,cabinet[0],deck,cabinet[1],patioFurniture.yaw);
  f.cuboid(0,0,0,.65,.90,1.79,'#735947');f.cuboid(0,.9,0,.73,.045,1.88,'#bba78b');
  for(const offset of [-.48,0,.48])f.bowl(0,.945,offset,.09,.14,'#adb399');
  for(const [l,r] of [[.04,.42],[.54,.91]]){
    const outer=(t:number,y:number):FacadePoint=>[corners[0][0]+(corners[1][0]-corners[0][0])*t,y,corners[0][1]+(corners[1][1]-corners[0][1])*t];
    const top=deck+1.02*unit;
    for(let j=0;j<=3;j++){
      const pt=outer(l+(r-l)*j/3,deck);
      furnishings(p,pt[0],deck,pt[2],patioFurniture.yaw).cuboid(0,0,0,.033,1.02,.033,'#847d6a');
    }
    p.quad(outer(l,top),outer(l,top-.0016),outer(r,top-.0016),outer(r,top),'#a3b7ae');
  }
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
