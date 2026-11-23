import * as THREE from 'three';
import data from '../public/data/approach-soma.json' with {type:'json'};
import { footprintGeometry, center, sfMap } from './sf-map.ts';
import { approachDistance, approachGround, type ApproachMesh } from './approach-road.ts';
import { bayReliefGround } from './bay-relief.ts';

const walls=['#b9ae94','#babca9','#aab3a7','#c6b49a','#c2bcaa','#a9afa0'];
const roofs=['#9f9f8e','#a5a995','#9a9d91','#a69a87','#a7a08e'];
const nearExistingStreet=(x:number,z:number,name:string)=>sfMap.roads.some(road=>
  road.name===name&&approachDistance(x,z,road.p)<.18);

export function buildApproachBlocks(mesh:ApproachMesh,root:THREE.Group){
  const group=new THREE.Group();group.name='Mapped SoMa warehouses and streets';root.add(group);
  const base=new THREE.BoxGeometry(1,1,1);
  function box(w:number,h:number,d:number,x:number,y:number,z:number,color:string,heading=0){
    const m=mesh(base,color,x,y,z,group);m.scale.set(w,h,d);m.rotation.y=heading;return m;
  }
  // Join the detailed waterfront's level base to the regional ground at the
  // back of the inland blocks. The far end follows the same elevation samples.
  const poz:number[]=[];
  for(let x=-99;x< -42;x+=2){
    for(let z=-114;z> -126;z-=1){
      const next=x+2,far=z-1;
      const a=[x,approachGround(x,z),z],b=[next,approachGround(next,z),z];
      const c=[next,approachGround(next,far),far],d=[x,approachGround(x,far),far];
      if(a[1]>bayReliefGround(x,z)+.004||b[1]>bayReliefGround(next,z)+.004||
         c[1]>bayReliefGround(next,far)+.004||d[1]>bayReliefGround(x,far)+.004)poz.push(...a,...b,...c,...a,...c,...d);
    }
  }
  if(poz.length){
    const base=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(poz,3));
    base.computeVertexNormals();mesh(base,'#b9bba9',0,0,0,group);
  }
  for(const street of data.roads){
    for(let i=1;i<street.points.length;i++){
      const [a,b]=street.points.slice(i-1,i+1),dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
      const x=(a[0]+b[0])/2,z=(a[1]+b[1])/2;
      if(length<.04||nearExistingStreet(x,z,street.name))continue;
      const count=Math.max(1,Math.ceil(length/1.7)),heading=-Math.atan2(dz,dx);
      for(let j=0;j<count;j++){
        const mx=a[0]+dx*(j+.5)/count,mz=a[1]+dz*(j+.5)/count;
        box(length/count+.022,.025,street.width,mx,approachGround(mx,mz)+.035,mz,'#8b9c99',heading).userData.roadExposure=1;
      }
    }
  }
  for(const building of data.buildings){
    const {id,height,kind,points}=building;
    const [x,z]=center(points);
    const grade=Math.min(...points.map(([x,z])=>approachGround(x,z)))-.026;
    const wall=walls[id%walls.length],roof=roofs[id%roofs.length];
    const isBillboardHost=id===243353690||id===243353706;
    // These two ground floors and rooflines are beneath the historical signs.
    const concreteHeight=id===243353690?.78:id===243353706?.32:height;
    const mass=mesh(footprintGeometry(points,concreteHeight),wall,0,grade,0,group);
    mass.name=building.name||'SoMa '+kind;
    const raisedRoof=points.map(([u,v])=>[THREE.MathUtils.lerp(x,u,.95),THREE.MathUtils.lerp(z,v,.95)]);
    if(concreteHeight>.32)mesh(footprintGeometry(raisedRoof,.027),roof,0,grade+concreteHeight+.009,0,group);
    if(!isBillboardHost&&(Math.abs(x+63)>18||concreteHeight<.62||id%3===0))continue;
    for(let i=1;i<points.length;i++){
      const [a,b]=points.slice(i-1,i+1),dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
      if(length<.61)continue;
      const heading=-Math.atan2(dz,dx),nx=-dz/length,nz=dx/length;
      const width=concreteHeight<.95?.235:.182;
      const levels=Math.min(7,Math.max(1,Math.round(concreteHeight/.21)-1));
      const bays=Math.max(1,Math.floor((length-.15)/.31));
      for(let floor=0;floor<levels;floor++){
        const y=grade+concreteHeight*(floor+.8)/(levels+.65);
        for(let j=0;j<bays;j++){
          if(floor===0&&j===bays-1&&kind==='workshop')continue;
          const u=(j+.5)/bays,mx=a[0]+dx*u,mz=a[1]+dz*u;
          box(width,.089,.024,mx+nx*.009,y,mz+nz*.009,kind==='garage'?'#778782':'#6b8584',heading);
        }
      }
      if(kind==='workshop'){
        const dx0=a[0]+dx*.80,dz0=a[1]+dz*.80;
        box(.24,.21,.037,dx0+nx*.012,grade+.12,dz0+nz*.012,'#8b948a',heading);
      }
    }
  }
}
