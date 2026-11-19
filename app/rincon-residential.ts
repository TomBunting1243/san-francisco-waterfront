import * as THREE from 'three';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';

type Point=[number,number];
type Ring=Point[];
type Light={x:number;y:number;z:number;ry:number;w:number;h:number};
type Building={id:number;p:number[][];minH?:number};
const unit=.06, c=.98894,s=.14834;
const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.76,metalness:.025});
const homes:Record<number,Point>={
  288647269:[-46.639,-34.1317],288647262:[-43.2314,-35.1173],
  1487195805:[-51.7872,-17.3172],260318802:[-52.212,-20.1090],
};
const rect=(l:number,r:number,b:number,t:number):Ring=>[[l,b],[r,b],[r,t],[l,t]];
// Clip the mapped lobes at the surveyed setbacks, retaining the same registration on each floor.
function clip(ring:Ring,axis:0|1,bound:number,below:boolean){
  const result:Ring=[];
  for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length];
    const inside=(p:Point)=>below?p[axis]<=bound:p[axis]>=bound;
    if(inside(a))result.push(a);
    if(inside(a)!==inside(b)){
      const t=(bound-a[axis])/(b[axis]-a[axis]);
      result.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);
    }
  }
  return result;
}

function build(b:Building,root:THREE.Group,lights:Light[],met:boolean){
  const [cx,cz]=homes[b.id],f=new FacadePanels();
  const ring:Ring=b.p.map(([x,z])=>[(x-cx)*c-(z-cz)*s,(x-cx)*s+(z-cz)*c]);
  if(Math.hypot(ring[0][0]-ring.at(-1)![0],ring[0][1]-ring.at(-1)![1])<.001)ring.pop();
  if(THREE.ShapeUtils.area(ring.map(([u,v])=>new THREE.Vector2(u,v)))<0)ring.reverse();
  const world=(u:number,v:number,y:number):FacadePoint=>[cx+c*u+s*v,y*unit,cz-s*u+c*v];
  function cap(shape:Ring,y:number,color:string){
    for(const [i,j,k] of THREE.ShapeUtils.triangulateShape(shape.map(([u,v])=>new THREE.Vector2(u,v)),[]))
      f.triangle(world(...shape[i],y),world(...shape[k],y),world(...shape[j],y),color);
  }
  function tier(shape:Ring,lo:number,hi:number,rows:number,plant=false){
    const pitch=(hi-lo)/Math.max(1,rows);
    shape.forEach(([u,v],i)=>{
      const [endU,endV]=shape[(i+1)%shape.length];
      const len=Math.hypot(endU-u,endV-v);
      if(len<.0002)return;
      const du=(endU-u)/len,dv=(endV-v)/len;
      const p=(d:number,y:number,out=0)=>world(u+du*d+dv*out,v+dv*d-du*out,y);
      const panel=(l:number,r:number,low:number,high:number,color:string,out=0)=>
        f.quad(p(l,low,out),p(l,high,out),p(r,high,out),p(r,low,out),color);
      const ivory=met?'#d8d3c5':'#c7c4b7',edge=met?'#b8b6aa':'#a49c90';
      if(!rows){panel(0,len,lo,hi,plant?'#aaa99e':ivory);return;}
      const midU=u+du*len*.5,midV=v+dv*len*.5;
      const rounded=met&&(len<.18||Math.abs(midU)>.66&&Math.abs(midV)>.55);
      const balcony=met&&Math.abs(dv)>.85&&len>.27;
      const width=len/Math.max(1,Math.round(len/(met?.21:.22)));
      const reveal=rounded?.006:balcony?.035:.016;
      const bayCount=!met&&len>.65?Math.floor(len/.52):0;
      const bays=Array.from({length:bayCount},(_,j)=>(j+.5)*len/bayCount);
      for(let j=0;j<Math.round(len/width);j++){
        const l=j*width,r=l+width;
        const glass=met?['#53797b','#66878a','#617e7f'][(j+i)%3]:'#718197';
        panel(l,r,lo,hi,glass,-reveal);
        panel(l,l+width*(rounded?.055:.17),lo,hi,rounded?'#9eaaa9':ivory,.0006);
        f.quad(p(l+width*(rounded?.055:.17),lo),p(l+width*(rounded?.055:.17),hi),
          p(l+width*(rounded?.055:.17),hi,-reveal),p(l+width*(rounded?.055:.17),lo,-reveal),edge);
        if(width>.12)panel(l+.58*width,l+.58*width+.003,lo,hi,'#a6aeaa',-.8*reveal);
        for(let k=0;k<rows;k++){
          if((j+3*k+i)%7||width<.085||bays.some(center=>Math.abs(center-l-width*.395)<.077+width*.145))continue;
          const [x,y,z]=p(l+width*.395,lo+(k+.65)*pitch,-reveal+.0013);
          lights.push({x,y,z,ry:Math.atan2(c*dv-s*du,-s*dv-c*du),w:width*.29,h:pitch*unit*(rounded?.55:.34)});
        }
      }
      for(let k=0;k<rows;k++){
        const y=lo+k*pitch,band=pitch*(rounded?.105:balcony?.15:.43);
        panel(0,len,y,y+band,rounded?'#a4afad':ivory);
        f.quad(p(0,y+band),p(0,y+band,-reveal),p(len,y+band,-reveal),p(len,y+band),edge);
        if(balcony){
          panel(0,len,y+band,y+band+.52,'#879794',-.004);
          panel(0,len,y+band+.52,y+band+.59,'#a7adaa');
        }
      }
      // The Harrison photograph shows slate-clad, three-sided bays between plain panels.
      if(bays.length){
        for(const center of bays){
          const cuts=[center-.077,center-.059,center+.059,center+.077];
          const depth=[.0008,.027,.027,.0008];
          for(let j=0;j<3;j++){
            const face=(low:number,high:number,tint:string,offset=0)=>f.quad(
              p(cuts[j],low,depth[j]+offset),p(cuts[j],high,depth[j]+offset),
              p(cuts[j+1],high,depth[j+1]+offset),p(cuts[j+1],low,depth[j+1]+offset),tint);
            face(lo,hi,j===1?'#718497':'#655f68');
            for(let row=0;row<rows;row++)face(lo+row*pitch,lo+(row+.31)*pitch,'#5c6873',.0012);
          }
          f.quad(p(cuts[3],hi,depth[3]),p(cuts[2],hi,depth[2]),
            p(cuts[1],hi,depth[1]),p(cuts[0],hi,depth[0]),'#737a7c');
        }
      }
      panel(0,len,hi-.18,hi,ivory,.0007);
    });
    cap(shape,hi,plant?'#b7b7aa':'#b6b4a7');
  }
  const base=(b.minH??(met?.60:.42))/unit;
  if(b.id===288647269){
    tier(ring,base,37,9);
    const mid=clip(ring,1,.84,true);
    tier(mid,37,65,9);
    const upper=clip(clip(mid,1,-.86,false),0,.89,true);
    tier(upper,65,76.6,4);
    // Rounded central crown flanked by two light terrace decks.
    const crown:Ring=[[-.74,-.52],[-.49,-.64],[.48,-.64],[.69,-.54],[.70,.43],
      [.63,.58],[.46,.65],[-.48,.65],[-.65,.60],[-.74,.49]];
    tier(crown,76.6,81.0,1);
  }else if(b.id===288647262){
    // The two mapped outer ends are a low projection on the podium, visible in the DSM.
    const shaft=clip(clip(clip(clip(ring,0,-1.21,false),0,1.14,true),1,.69,true),1,-.631,false);
    tier(shaft,base,54,14);
    const upper=clip(shaft,0,1.02,true);
    tier(upper,54,62.9,3);
    const crown:Ring=[[-1.09,-.38],[-.86,-.515],[.74,-.515],[.92,-.39],[.92,.30],
      [.78,.40],[-.25,.45],[-.29,.50],[-.86,.50],[-1.09,.38]];
    tier(crown,62.9,67.4,1);
  }else{
    const high=b.id===260318802;
    const deck=high?34.1:28.5;
    tier(ring,base,deck,high?9:7);
    // Registered mechanical penthouse and smaller secondary roof beside it.
    const core:Ring=high?[[.10,-.22],[.58,-.22],[.58,.04],[.77,.04],[.77,.33],[.10,.33]]:
      [[.10,-.30],[.39,-.30],[.39,-.225],[.71,-.225],[.71,.11],[.47,.11],[.47,.22],[.33,.22],[.33,.31],[.20,.31],[.20,.22],[.10,.22]];
    tier(core,deck,high?39:33.5,0,true);
    tier(high?rect(.49,.92,-.53,-.29):rect(.52,.83,.43,.62),deck,high?37.1:31.1,0,true);
  }
  const mesh=f.mesh(material);mesh.name=met?'Metropolitan residential tower':'BayCrest residential wing';
  root.add(mesh);
}
export function addMetropolitanTowers(b:Building,root:THREE.Group,lights:Light[]){
  if(b.id!==288647269&&b.id!==288647262)return false;
  build(b,root,lights,true);return true;
}
export function addBayCrestWings(b:Building,root:THREE.Group,lights:Light[]){
  if(b.id!==1487195805&&b.id!==260318802)return false;
  build(b,root,lights,false);return true;
}
