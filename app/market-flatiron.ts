import * as THREE from 'three';
import {footprintGeometry} from './sf-map.ts';

type Building = {id:number;p:number[][]};
type NightWindow = {x:number;y:number;z:number;ry:number;w:number;h:number};
type Point = [number,number,number];

const podium = 1279504526, tower = 288505730;
const baseTop = .735, roofDeck = 6.534, parapet = 6.62;
const granite = '#895c55', trim = '#48534d', bronze = '#605851';
const glazing = ['#586266','#626a6c','#576369','#60686a'];
const facadeMaterial = new THREE.MeshStandardMaterial({vertexColors:true,roughness:.75});
const roofMaterial = new THREE.MeshStandardMaterial({color:'#a59c91',roughness:.95});

// SOM's elevation and floor plans, Architecture, March 1988, pp. 106–109:
// retail base, offices through floor 17, two mechanical floors and seven residential.
// The structural engineer gives 16-foot column spacing (Modern Steel Construction, Nov. 1990).
// Resample complete runs so the surveyor's extra points on a bend do not create extra windows.
function divideRun(points:number[][],bays:number){
  const lengths=[0];
  for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]+Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]));
  const result:number[][]=[];
  let edge=0;
  for(let i=0;i<bays;i++){
    const at=lengths[lengths.length-1]*i/bays;
    while(edge<points.length-2&&lengths[edge+1]<at)edge++;
    const t=(at-lengths[edge])/(lengths[edge+1]-lengths[edge]);
    result.push(points[edge].map((v,k)=>v+(points[edge+1][k]-v)*t));
  }
  return result;
}

// All opaque panels share one indexed geometry, including real reveals at the entrance
// and across the residential levels. Palette values are converted to linear vertex color.
class Facade {
  positions:number[]=[];colors:number[]=[];indices:number[]=[];
  palette=new Map<string,THREE.Color>();
  quad(a:Point,b:Point,c:Point,d:Point,tint:string){
    let color=this.palette.get(tint);
    if(!color){color=new THREE.Color(tint);this.palette.set(tint,color);}
    const n=this.positions.length/3;
    for(const p of [a,b,c,d]){this.positions.push(...p);this.colors.push(color.r,color.g,color.b);}
    this.indices.push(n,n+1,n+2,n,n+2,n+3);
  }
  mesh(){
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(this.positions,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(this.colors,3));
    g.setIndex(this.indices);g.computeVertexNormals();
    return new THREE.Mesh(g,facadeMaterial);
  }
}

function addBay(batch:Facade,ring:number[][],i:number,isBase:boolean,windows:NightWindow[]){
  const a=ring[i],b=ring[(i+1)%ring.length];
  const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
  const nx=dz/length,nz=-dx/length;
  const at=(u:number,y:number,recess=0):Point=>[a[0]+u*dx-recess*nx,y,a[1]+u*dz-recess*nz];
  const panel=(l:number,r:number,bottom:number,top:number,recess:number,color:string)=>
    batch.quad(at(l,bottom,recess),at(l,top,recess),at(r,top,recess),at(r,bottom,recess),color);
  function aperture(bottom:number,top:number,sill:number,head:number,jamb:number,depth:number,tint:string){
    panel(0,1,bottom,sill,0,granite);
    panel(0,1,head,top,0,granite);
    panel(0,jamb,sill,head,0,granite);panel(1-jamb,1,sill,head,0,granite);
    batch.quad(at(jamb,sill),at(jamb,head),at(jamb,head,depth),at(jamb,sill,depth),bronze);
    batch.quad(at(1-jamb,sill,depth),at(1-jamb,head,depth),at(1-jamb,head),at(1-jamb,sill),bronze);
    batch.quad(at(jamb,sill,depth),at(1-jamb,sill,depth),at(1-jamb,sill),at(jamb,sill),bronze);
    batch.quad(at(jamb,head),at(1-jamb,head),at(1-jamb,head,depth),at(jamb,head,depth),bronze);
    panel(jamb,1-jamb,sill,head,depth,tint);
  }
  if(isBase){
    // The glazing recedes behind red-stone piers at the two-story shopfront.
    const entrance=i===9;
    const recess=entrance?.083:.038,jamb=entrance?.07:.12;
    aperture(.035,baseTop,entrance?.038:.075,baseTop-.065,jamb,recess,glazing[i%4]);
    panel(jamb,1-jamb,.37,.382,recess-.002,bronze);
    panel(.493,.507,.075,baseTop-.065,recess-.002,bronze);
    return;
  }
  const officeTop=4.47,plantTop=4.93,crownBase=6.48;
  for(let floor=0;floor<15;floor++){
    const step=(officeTop-baseTop)/15,y=baseTop+floor*step,sill=y+step*.25,head=y+step*.91;
    // Broad horizontal red bands wrap continuously through the blunted prow.
    panel(0,1,y,sill,0,granite);panel(0,1,sill,head,0,glazing[(i+Math.floor(floor/3))%4]);
    panel(0,1,head,y+step,0,granite);panel(0,.045,sill,head,-.0018,trim);
    panel(.493,.507,sill,head,-.0018,trim);
    if((i+floor)%5===0){
      const [x,wy,z]=at(.265,(sill+head)*.5,-.0025);
      windows.push({x,y:wy,z,ry:Math.atan2(nx,nz),w:length*.4,h:(head-sill)*.94});
    }
  }
  panel(0,1,officeTop,plantTop,0,trim);
  for(let k=0;k<4;k++){
    const y=officeTop+(k+.5)*(plantTop-officeTop)/4;
    panel(0,1,y,y+.012,-.002,bronze);
  }
  for(let floor=0;floor<7;floor++){
    const step=(crownBase-plantTop)/7,y=plantTop+step*floor;
    const sill=y+step*.22,head=y+step*.84;
    aperture(y,y+step,sill,head,.13,.011,glazing[(i+2*floor)%4]);
    panel(.488,.512,sill,head,.009,bronze);
    if((i+floor)%3===0){
      const [x,wy,z]=at(.31,(sill+head)*.5,.008);
      windows.push({x,y:wy,z,ry:Math.atan2(nx,nz),w:length*.31,h:(head-sill)*.92});
    }
  }
  panel(0,1,crownBase,parapet,0,granite);
  panel(0,1,parapet-.014,parapet,-.002,trim);
  // Inside return of the parapet is visible from the high end of the permitted orbit.
  const inset=(p:number[])=>[p[0]+(-3.14-p[0])*.018,p[1]+(-33.1-p[1])*.018];
  const ia=inset(a),ib=inset(b);
  batch.quad(at(0,parapet),[ia[0],parapet,ia[1]],[ib[0],parapet,ib[1]],at(1,parapet),bronze);
  batch.quad([ia[0],roofDeck,ia[1]],[ib[0],roofDeck,ib[1]],[ib[0],parapet,ib[1]],[ia[0],parapet,ia[1]],bronze);
}

function roofSurface(group:THREE.Group,name:string,ring:number[][],height:number){
  const shape=new THREE.Shape(ring.map(([x,z])=>new THREE.Vector2(x,-z)));
  const g=new THREE.ShapeGeometry(shape);g.rotateX(-Math.PI/2);
  const m=new THREE.Mesh(g,roofMaterial);m.name=name;m.position.y=height;group.add(m);
}

function slab(group:THREE.Group,name:string,ring:number[][],bottom:number,top:number){
  const m=new THREE.Mesh(footprintGeometry(ring,top-bottom),roofMaterial);
  m.position.y=bottom;m.name=name;group.add(m);
}

// Upper roofs fitted to the 2023 USGS 1.5 m DSM: a receding long mechanical deck
// and a shallow curved cap over the broad end. Heights stay separate from the outer parapet.
const upperDeck=[[-3.24,-34.30],[-3.65,-34.06],[-3.87,-33.67],[-3.60,-31.51],
  [-3.06,-31.51],[-2.88,-32.14],[-2.25,-33.04],[-2.25,-33.65],[-2.39,-33.96],[-2.69,-34.22]];
function addRoof(group:THREE.Group,ring:number[][]){
  roofSurface(group,'388 Market roof terrace',ring,roofDeck);
  slab(group,'388 Market raised mechanical deck',upperDeck,roofDeck,6.735);
  const batch=new Facade(),cx=-3.045,cz=-33.45,sides=28;
  const point=(angle:number,r:number,h:number):Point=>[cx+r*Math.cos(angle),h,cz+r*.97*Math.sin(angle)];
  for(let i=0;i<sides;i++){
    const a=i*2*Math.PI/sides,b=(i+1)*2*Math.PI/sides;
    batch.quad(point(a,.66,6.735),point(a,.58,6.795),point(b,.58,6.795),point(b,.66,6.735),'#97968b');
    batch.quad(point(a,.58,6.795),point(a,.27,6.865),point(b,.27,6.865),point(b,.58,6.795),'#b1a99c');
  }
  const cap=batch.mesh();cap.name='388 Market shallow round crown';group.add(cap);
  const lid=Array.from({length:sides},(_,i)=>{const p=point(i*2*Math.PI/sides,.27,6.865);return [p[0],p[2]];});
  slab(group,'388 Market crown lid',lid,6.857,6.865);
}

export function addMarketFlatiron(b:Building,root:THREE.Group,windows:NightWindow[]){
  if(b.id!==podium&&b.id!==tower)return false;
  const group=new THREE.Group(),batch=new Facade(),base=b.id===podium;
  group.name=base?'388 Market commercial base':'388 Market granite flatiron';
  root.add(group);
  const outline=b.p;
  const ring=base?[
    ...divideRun(outline.slice(0,9),3),...divideRun(outline.slice(8,27),10),
    ...divideRun(outline.slice(26,28),5),...divideRun(outline.slice(27,29),6),
    ...divideRun(outline.slice(28,43),7),...divideRun(outline.slice(42),9),
  ]:[
    ...divideRun(outline.slice(26,28),9),
    ...divideRun(outline.slice(27,36),3),
    ...divideRun(outline.slice(35,51),9),
    ...divideRun([...outline.slice(50,-1),...outline.slice(0,27)],15),
  ];
  for(let i=0;i<ring.length;i++)addBay(batch,ring,i,base,windows);
  const wall=batch.mesh();wall.name=base?'388 Market recessed storefronts':'388 Market offices, mechanical band and residences';group.add(wall);
  if(base)roofSurface(group,'388 Market podium roof',outline,baseTop);
  else addRoof(group,ring);
  return true;
}
