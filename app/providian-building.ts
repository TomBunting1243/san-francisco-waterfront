import * as THREE from 'three';
import {footprintGeometry} from './sf-map.ts';

type Building = {id:number; p:number[][]; h:number};
type Window = {x:number; y:number; z:number; ry:number; w:number; h:number};
type Point = [number,number,number];

const podiumId=32862919, towerId=616813259;
const stone='#d2c8b3', endStone='#c3bba9', returnStone='#b0a794', roof='#aba99a';
const glass=['#48565b','#515f63','#465357'];

// JLL's cover photograph and surveyed fifth-floor plan show projecting precast
// uprights, alternating deep glazing and short spandrels, and narrow end faces.
// https://www.201mission.com/uploads/1/5/3/2/153220932/201mission_brochure_custom_design_6.20.25.pdf
// https://www.201mission.com/uploads/1/5/3/2/153220932/201_mission_suite_0-5000_sf_1.pdf
// https://www.pci.org/ProjectProfile?ID=270038 describes two-story column panels
// and roughly 5 ft square spandrels. Minesweeper's original 2013 photograph:
// https://commons.wikimedia.org/wiki/File:201_Mission_Street,_San_Francisco.jpg
//
// The mapped parent is the block-long base. The mapped child is slightly
// undersized/offset compared to the USGS 2023 returns. Fit eight planes parallel
// to its surveyed street directions to the >70 m mass in the 1.5 m local DSM.
// The 127.5 m main roof and ~135 m plant enclosure are distinct observed planes.
const shaft=[[-20.04,-22.13],[-17.95,-22.41],[-17.47,-22.75],[-16.77,-23.95],
  [-16.93,-25.00],[-18.89,-24.64],[-19.34,-24.39],[-20.16,-22.91]];
const skirt=[[-20.12,-22.14],[-17.58,-22.48],[-16.93,-22.94],[-16.64,-23.44],
  [-16.90,-25.18],[-19.24,-24.75],[-19.61,-24.55],[-20.31,-23.30]];
const plant=[[-19.43,-22.66],[-18.82,-22.74],[-17.50,-23.68],[-17.38,-23.88],
  [-17.45,-24.33],[-18.02,-24.23],[-19.40,-23.47],[-19.52,-23.25]];
const shoulder=7.31, mainRoof=7.648, plantRoof=8.112;
const bays=[12,3,8,5,11,3,9,4];
const painted=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.89});
const concrete=new THREE.MeshStandardMaterial({color:roof,roughness:.94});

class Surface {
  xyz:number[]=[]; rgb:number[]=[]; indices:number[]=[];
  palette=new Map<string,THREE.Color>();
  quad(a:Point,b:Point,c:Point,d:Point,tint:string){
    let color=this.palette.get(tint);
    if(!color)this.palette.set(tint,color=new THREE.Color(tint));
    const n=this.xyz.length/3;
    for(const p of [a,b,c,d]){this.xyz.push(...p);this.rgb.push(color.r,color.g,color.b);}
    this.indices.push(n,n+1,n+2,n,n+2,n+3);
  }
  attach(root:THREE.Group,name:string){
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(this.xyz,3));
    geo.setAttribute('color',new THREE.Float32BufferAttribute(this.rgb,3));
    geo.setIndex(this.indices);geo.computeVertexNormals();geo.userData.paintVertices=true;
    const m=new THREE.Mesh(geo,painted);m.name=name;root.add(m);
  }
}

function deck(root:THREE.Group,p:number[][],y:number,name:string){
  const mesh=new THREE.Mesh(footprintGeometry(p,.009),concrete);
  mesh.name=name;mesh.position.y=y-.009;root.add(mesh);
}

function elevation(surface:Surface,a:number[],b:number[]){
  const dx=b[0]-a[0],dz=b[1]-a[1],w=Math.hypot(dx,dz);
  const px=dx/w,pz=dz/w;
  const point=(x:number,y:number,depth:number):Point=>[a[0]+px*x-pz*depth,y,a[1]+pz*x+px*depth];
  function panel(left:number,right:number,bottom:number,top:number,depth:number,tint:string){
    surface.quad(point(left,bottom,depth),point(right,bottom,depth),point(right,top,depth),point(left,top,depth),tint);
  }
  function pier(left:number,right:number,bottom:number,top:number,depth:number,tint:string){
    panel(left,right,bottom,top,depth,tint);
    surface.quad(point(left,bottom,0),point(left,bottom,depth),point(left,top,depth),point(left,top,0),returnStone);
    surface.quad(point(right,bottom,depth),point(right,bottom,0),point(right,top,0),point(right,top,depth),returnStone);
    surface.quad(point(left,top,depth),point(right,top,depth),point(right,top,0),point(left,top,0),stone);
  }
  return {w,point,panel,pier,angle:Math.atan2(-pz,px)};
}

function wallRing(surface:Surface,ring:number[][],bottom:number,top:number,levels:number,
  counts:number[],windows:Window[],kind:'base'|'skirt'|'shaft'|'head'|'plant',mission=-1){
  for(let edge=0;edge<ring.length;edge++){
    const face=elevation(surface,ring[edge],ring[(edge+1)%ring.length]);
    const count=counts[edge],step=face.w/count,storey=(top-bottom)/levels;
    const jamb=kind==='base'?.27:kind==='skirt'?.31:.245;
    const depth=kind==='base'?.018:kind==='skirt'?.021:.028;
    for(let bay=0;bay<count;bay++){
      const left=bay*step,right=left+step,l=left+jamb*step,r=right-jamb*step;
      if(!bay)face.pier(left,l,bottom,top,depth,stone);
      face.pier(r,Math.min(face.w,right+jamb*step),bottom,top,depth,edge===3||edge===7?endStone:stone);
      face.panel(l,r,bottom,top,0,kind==='plant'?'#72776e':glass[(bay+edge)%glass.length]);
      for(let floor=0;floor<levels;floor++){
        const y=bottom+floor*storey;
        const entry=kind==='base'&&edge===mission&&floor===0&&Math.abs(bay+.5-count*.5)<1.1;
        const sill=entry?y:y+storey*(kind==='base'?.32:.33);
        const lintel=y+storey*(kind==='plant'?.79:.95);
        const bandBase=floor?y-storey*.05:y;
        if(sill>bandBase)face.panel(l,r,bandBase,sill,.006,kind==='plant'?returnStone:endStone);
        if(floor===levels-1)face.panel(l,r,lintel,top,.006,stone);
        if(entry)face.panel((l+r)/2-.003,(l+r)/2+.003,y,lintel,.004,returnStone);
        if(kind!=='plant'&&(floor+bay+edge)%4===0){
          const [x,py,z]=face.point((l+r)/2,(sill+lintel)/2,.002);
          windows.push({x,y:py,z,ry:face.angle,w:(r-l)*.93,h:(lintel-sill)*.94});
        }
      }
    }
  }
}

// Move the two end walls back at the last occupied levels. Their roof returns
// concentrate around 121–122 m; the adjacent long side planes continue to 127.5 m.
function crownRing(){
  const result=shaft.map(p=>p.slice());
  for(const edge of [3,7]){
    const a=shaft[edge],j=(edge+1)%shaft.length,b=shaft[j];
    const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
    for(const k of [edge,j]){result[k][0]+=dz/length*.15;result[k][1]-=dx/length*.15;}
  }
  return result;
}

export function addProvidianBuilding(b:Building,root:THREE.Group,windows:Window[]){
  if(b.id!==podiumId&&b.id!==towerId)return false;
  const surface=new Surface(),section=new THREE.Group();root.add(section);
  if(b.id===podiumId){
    section.name='201 Mission stepped plaza and podium';
    const ring=b.p.slice(0,-1).reverse();
    const counts=ring.map((p,i)=>Math.max(1,Math.round(Math.hypot(p[0]-ring[(i+1)%ring.length][0],p[1]-ring[(i+1)%ring.length][1])/.225)));
    // Reversing the parcel ring maps original Mission Street edge 1 to edge 10.
    wallRing(surface,ring,.04,b.h,3,counts,windows,'base',ring.length-3);
    deck(section,ring,b.h,'Stepped podium roof');
  }else{
    section.name='201 Mission Pacific Gateway tower';
    wallRing(surface,skirt,.84,1.22,2,bays,windows,'skirt');
    deck(section,skirt,1.22,'Lower end terraces');
    wallRing(surface,shaft,1.22,shoulder,24,bays,windows,'shaft');
    deck(section,shaft,shoulder,'End shoulder terraces');
    const crown=crownRing();
    wallRing(surface,crown,shoulder,mainRoof,1,bays,windows,'head');
    deck(section,crown,mainRoof,'Main roof');
    wallRing(surface,plant,mainRoof,plantRoof,1,[3,8,1,2,3,8,1,2],windows,'plant');
    deck(section,plant,plantRoof,'Mechanical enclosure roof');
  }
  surface.attach(section,'Pacific Gateway precast and recessed glazing');
  return true;
}
