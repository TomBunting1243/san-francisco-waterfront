import * as THREE from 'three';
import landscapeData from '../public/data/waterfront-landscape.json' with {type:'json'};
import {sfMap,center,footprintGeometry} from './sf-map.ts';
import {insideBuilding} from './building-character.ts';

type Building={id:number;p:number[][];h:number;minH?:number};
type Area={id:number;name:string;kind:string;sport?:string|null;p:number[][]};
type Path={id:number;kind:string;p:number[][];layer:string;level?:string;bridge?:string;width?:string};
export const waterfrontLandscape=landscapeData as {areas:Area[];paths:Path[];trees:{id:number;p:number[];species:string;height:string|null;diameter:string|null}[]};
const contains=(p:number[],area:Area)=>insideBuilding(p[0],p[1],area.p);
const walton=sfMap.parks.find(p=>p.name.includes('Walton'))!;
export const gardenAreas:Area[]=[...waterfrontLandscape.areas.filter(a=>['park','commercial','podium'].includes(a.kind)),{...walton,id:-1,kind:'park'}];
const ecAreas=gardenAreas.filter(a=>a.kind==='podium');

/** Mapped lawns, paths and tree locations; crown sizes are interpreted from the reference photographs. */
export function waterfrontGardens(buildings:Building[]){
  const root=new THREE.Group();root.name='Referenced waterfront parks and podium gardens';
  const materials=new Map<string,THREE.MeshStandardMaterial>(),treeAnchors:{id:number;x:number;y:number;z:number}[]=[],pathSegments:{x:number;z:number;area:number}[]=[];
  const mat=(c:string)=>{if(!materials.has(c))materials.set(c,new THREE.MeshStandardMaterial({color:c,roughness:.95}));return materials.get(c)!;};
  const mesh=(g:THREE.BufferGeometry,c:string,x=0,y=0,z=0,parent:THREE.Object3D=root)=>{const m=new THREE.Mesh(g,mat(c));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;};
  const box=(w:number,h:number,d:number,x:number,y:number,z:number,c:string,parent:THREE.Object3D=root)=>mesh(new THREE.BoxGeometry(w,h,d),c,x,y,z,parent);
  const height=(area:Area)=>area.kind==='podium'?.61:area.kind==='commercial'?.46:.12;
  const solidAt=(x:number,z:number,y:number)=>buildings.some(b=>b.h>y+.08&&(b.minH||0)<y+.08&&insideBuilding(x,z,b.p));
  const areaAt=(p:number[])=>gardenAreas.find(a=>contains(p,a));
  function strip(a:number[],b:number[],w:number,y:number,color:string){const len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<.001)return;const m=box(w,.022,len,(a[0]+b[0])/2,y,(a[1]+b[1])/2,color);m.rotation.y=Math.atan2(b[0]-a[0],b[1]-a[1]);return m;}
  function tree(x:number,z:number,y:number,id:number,species='',heightTag:string|null=null){
    const seed=Math.abs(Math.sin(id*1.618)),tag=parseFloat(heightTag||'');
    const h=Number.isFinite(tag)?THREE.MathUtils.clamp(tag*.06,.5,1.7):.83+seed*.47;
    const narrow=/Populus|poplar|Lombard|Ginkgo/i.test(species),radius=narrow?.20:.34+seed*.14;
    mesh(new THREE.CylinderGeometry(.023,.039,h*.76,5),'#75654e',x,y+h*.38,z);
    for(let i=0;i<3;i++){
      const a=i*2.4+seed*6,crown=mesh(new THREE.IcosahedronGeometry(radius,1),['#56795c','#70916a','#839963'][i],x+Math.cos(a)*radius*.43,y+h*.73+(i%2)*h*.15,z+Math.sin(a)*radius*.43);
      crown.scale.set(1,narrow?1.8:1.06,.9);
    }
    treeAnchors.push({id,x,y,z});
  }
  function shrub(x:number,z:number,y:number,s=.12){const crown=mesh(new THREE.IcosahedronGeometry(s,1),'#617f55',x,y+s*.55,z);crown.scale.set(1,.65,1);}
  for(const area of gardenAreas){
    const y=height(area),podium=area.kind==='podium';
    if(area.id!==-1){
      // Sue Bierman's west lawn has a mapped service-building hole.
      const holes=waterfrontLandscape.areas.filter(a=>a.kind==='park-hole'&&contains(center(a.p),area));
      if(holes.length){
        const shape=new THREE.Shape(area.p.map(([x,z])=>new THREE.Vector2(x,-z)));
        for(const hole of holes)shape.holes.push(new THREE.Path(hole.p.map(([x,z])=>new THREE.Vector2(x,-z))));
        const geo=new THREE.ExtrudeGeometry(shape,{depth:.06,bevelEnabled:false});geo.rotateX(-Math.PI/2);mesh(geo,'#8d9f70',0,y-.06,0);
      }else mesh(footprintGeometry(area.p,podium?.18:.06),podium||area.kind==='commercial'?'#b8b5a0':'#8d9f70',0,y-(podium?.18:.06),0);
    }
    if(podium){
      // Three-level shopping terraces, open at the street edge, with planted upper walks.
      mesh(footprintGeometry(area.p,.16),'#cbc7b4',0,.04,0);
      for(let i=1;i<area.p.length;i++){
        const a=area.p[i-1],b=area.p[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<.4)continue;
        strip(a,b,.055,.395,'#e2ddc9');strip(a,b,.055,.645,'#ded8c3');
        const [cx,cz]=center(area.p);let nx=(b[1]-a[1])/len,nz=-(b[0]-a[0])/len;if(nx*((a[0]+b[0])/2-cx)+nz*((a[1]+b[1])/2-cz)>0){nx=-nx;nz=-nz;}
        for(let t=.25;t<len-.1;t+=.48){
          const x=a[0]+(b[0]-a[0])*t/len,z=a[1]+(b[1]-a[1])*t/len;
          box(.055,.39,.055,x,.395,z,'#d9d4c1');
          const px=x+nx*.18,pz=z+nz*.18;
          if(contains([px,pz],area)&&!solidAt(px,pz,y)){box(.23,.11,.23,px,y+.04,pz,'#b5b39b');shrub(px,pz,y+.12,.17);}
        }
      }
    }
  }
  // The individually mapped lawn patches preserve Sue Bierman's curving paths.
  for(const area of waterfrontLandscape.areas.filter(a=>a.kind==='grass'||a.kind==='scrub')){
    const p=center(area.p),garden=areaAt(p);if(!garden||solidAt(p[0],p[1],height(garden)))continue;
    mesh(footprintGeometry(area.p,.018),area.kind==='scrub'?'#658563':'#99aa78',0,height(garden)+.006,0);
  }
  for(const path of waterfrontLandscape.paths){
    if(parseFloat(path.layer)<0||path.level?.startsWith('-'))continue;
    const elevated=path.bridge==='yes'||parseFloat(path.layer)>0;
    if(elevated){
      if(path.bridge!=='yes'||!path.p.some(p=>ecAreas.some(a=>contains(p,a))))continue;
      for(let i=1;i<path.p.length;i++){
        const a=path.p[i-1],b=path.p[i];strip(a,b,.27,.59,'#c5c5b1');
        const len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<.01)continue;
        const nx=(b[1]-a[1])/len,nz=-(b[0]-a[0])/len;
        for(const side of [-1,1]){const offset=(p:number[])=>[p[0]+nx*.125*side,p[1]+nz*.125*side];strip(offset(a),offset(b),.022,.76,'#d8d6c1');for(let t=0;t<len;t+=.24){const u=t/len;box(.014,.18,.014,a[0]+(b[0]-a[0])*u+nx*.125*side,.68,a[1]+(b[1]-a[1])*u+nz*.125*side,'#8b9b90');}}
      }
      continue;
    }
    for(let i=1;i<path.p.length;i++){
      const a=path.p[i-1],b=path.p[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]),steps=Math.max(1,Math.ceil(len/.12));
      for(let j=0;j<steps;j++){
        const t=(j+.5)/steps,p=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],area=areaAt(p);if(!area||solidAt(p[0],p[1],height(area)))continue;
        const at=(u:number)=>[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u];
        strip(at(j/steps),at((j+1)/steps),THREE.MathUtils.clamp(parseFloat(path.width||'2.4')*.06,.08,.25),height(area)+.029,'#d2c8ae');pathSegments.push({x:p[0],z:p[1],area:area.id});
      }
    }
  }
  // Golden Gateway's real tennis, pickleball and swimming club occupies the waterfront strip.
  for(const area of waterfrontLandscape.areas.filter(a=>['pitch','swimming_pool','playground'].includes(a.kind))){
    const [cx,cz]=center(area.p);if(cx<14||cx>29||cz< -10||cz> -4)continue;
    const pool=area.kind==='swimming_pool';if(area.kind==='playground')continue;
    mesh(footprintGeometry(area.p,.032),pool?'#78b6be':'#697f77',0,.075,0);
    for(let i=1;i<area.p.length;i++)strip(area.p[i-1],area.p[i],pool?.045:.018,.12,pool?'#dad3bc':'#d0d4bd');
    const corners=area.p.slice(0,-1);if(corners.length!==4||pool)continue;
    const a=corners[0],b=corners[1],c=corners[2],d=corners[3],mid=(p:number[],q:number[])=>[(p[0]+q[0])/2,(p[1]+q[1])/2];
    const l1=Math.hypot(b[0]-a[0],b[1]-a[1]),l2=Math.hypot(c[0]-b[0],c[1]-b[1]);
    const ends=l1>l2?[mid(a,b),mid(c,d)]:[mid(a,d),mid(b,c)];strip(ends[0],ends[1],.012,.19,'#3c5858');
    for(const p of ends)box(.014,.16,.014,p[0],.16,p[1],'#405a58');
    const shrink=(p:number[],s:number)=>[cx+(p[0]-cx)*s,cz+(p[1]-cz)*s];
    for(let i=0;i<4;i++)strip(shrink(corners[i],.80),shrink(corners[(i+1)%4],.80),.012,.123,'#d7dbc8');
  }
  for(const node of waterfrontLandscape.trees){
    const [x,z]=node.p,area=areaAt(node.p),y=area?height(area):.08;
    // Preserve street trees too, but never plant through a roof or traffic carriageway.
    if(solidAt(x,z,y)||!area&&(z< -31||x< -45||x>56))continue;
    tree(x,z,y,node.id,node.species,node.height);
  }
  // OSM records the eastern Sue Bierman trees, but not its dense western grove,
  // the terrace trees, or all of Walton's perimeter groves. These supplemental
  // placements follow the photographed planting zones, rather than pretending
  // missing tree nodes mean bare paving. Negative IDs distinguish interpretation.
  for(const area of gardenAreas){
    if(area.id===175516006)continue;
    const [cx,cz]=center(area.p),xs=area.p.map(p=>p[0]),zs=area.p.map(p=>p[1]),spacing=area.kind==='podium'?1.12:.76,y=height(area);
    let index=0;
    for(let x=Math.min(...xs)+.3;x<Math.max(...xs)-.25;x+=spacing)for(let z=Math.min(...zs)+.3;z<Math.max(...zs)-.25;z+=spacing){
      index++;
      if(![-.20,.20].every(dx=>[-.20,.20].every(dz=>contains([x+dx,z+dz],area)&&!solidAt(x+dx,z+dz,y))))continue;
      if(area.id===-1&&Math.hypot((x-cx)/2.6,(z-cz)/2.3)<.63)continue;
      if(pathSegments.some(p=>p.area===area.id&&Math.hypot(p.x-x,p.z-z)<.24)||treeAnchors.some(p=>Math.hypot(p.x-x,p.z-z)<.54))continue;
      const id=-Math.abs(area.id*1000+index);tree(x,z,y,id,area.id===585983823?'Populus':'',area.kind==='podium'?'9':null);
      if(area.kind==='commercial'){box(.52,.025,.50,x,y+.018,z,'#8e9e70');}
    }
  }
  // Photographed planted roof courts of the Commons; no invented rooftop furniture.
  for(const b of buildings.filter(b=>[941869554,941869555,941869556].includes(b.id))){
    const xs=b.p.map(p=>p[0]),zs=b.p.map(p=>p[1]);
    for(let x=Math.min(...xs)+.4;x<Math.max(...xs)-.3;x+=.45)for(let z=Math.min(...zs)+.4;z<Math.max(...zs)-.3;z+=.45){
      if(![-.16,.16].every(dx=>[-.16,.16].every(dz=>insideBuilding(x+dx,z+dz,b.p)&&!solidAt(x+dx,z+dz,b.h))))continue;
      box(.453,.025,.453,x,b.h+.023,z,'#82916a');
      if(Math.sin(x*23+z*31)>.50)shrub(x+.045,z-.03,b.h+.05,.105);
    }
  }
  return {root,treeAnchors,pathSegments};
}
