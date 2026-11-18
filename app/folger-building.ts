import * as THREE from 'three';
import {footprintGeometry} from './sf-map.ts';

type Building={id:number;p:number[][]};
type Pane={x:number;y:number;z:number;ry:number;w:number;h:number};
type P=[number,number,number];
const main=192305909,warehouse=192305907;
const brick='#a26957',rust='#915b4d',lightBrick='#bb8167',granite='#c6bda9',glass='#405653',iron='#3e4948';
const materials=new Map<string,THREE.MeshStandardMaterial>();
function material(color:string){
  if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.9}));
  return materials.get(color)!;
}
const cube=new THREE.BoxGeometry(1,1,1);
function box(g:THREE.Group,name:string,c:string,x:number,y:number,z:number,w:number,h:number,d:number){
  const m=new THREE.Mesh(cube,material(c));m.name=name;m.position.set(x,y,z);m.scale.set(w,h,d);g.add(m);return m;
}
function slab(g:THREE.Group,name:string,p:number[][],base:number,top:number,color:string){
  const m=new THREE.Mesh(footprintGeometry(p,top-base),material(color));m.name=name;m.position.y=base;g.add(m);
}
class Masonry{
  positions:number[]=[];colors:number[]=[];indices:number[]=[];
  quad(a:P,b:P,c:P,d:P,color:string){
    const i=this.positions.length/3,tone=material(color).color;
    for(const p of [a,b,c,d]){this.positions.push(...p);this.colors.push(tone.r,tone.g,tone.b);}
    this.indices.push(i,i+1,i+2,i,i+2,i+3);
  }
  rect(l:number,r:number,b:number,t:number,z:number,c:string){
    this.quad([l,b,z],[r,b,z],[r,t,z],[l,t,z],c);
  }
  build(g:THREE.Group){
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(this.positions,3));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(this.colors,3));
    geometry.setIndex(this.indices);geometry.computeVertexNormals();
    const m=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.89}));
    m.name='Brick arches, spandrels and opening reveals';g.add(m);
  }
}
function street(root:THREE.Group,name:string,a:number[],b:number[]){
  const g=new THREE.Group(),dx=b[0]-a[0],dz=b[1]-a[1];
  g.name=name;g.position.set(a[0],0,a[1]);g.rotation.y=Math.atan2(-dz,dx);root.add(g);g.updateWorldMatrix(true,false);
  return {g,width:Math.hypot(dx,dz)};
}
function light(out:Pane[],g:THREE.Group,x:number,y:number,z:number,w:number,h:number){
  const p=g.localToWorld(new THREE.Vector3(x,y,z));out.push({x:p.x,y:p.y,z:p.z,ry:g.rotation.y,w,h});
}
function balcony(g:THREE.Group,x:number,y:number,w:number){
  box(g,'Historic iron fire balcony',iron,x,y,.056,w,.008,.083);
  for(const h of [.024,.053])box(g,'Balcony rail',iron,x,y+h,.095,w,.004,.004);
  for(let k=0;k<7;k++)box(g,'Baluster',iron,x+w*(k/6-.5),y+.027,.095,.0035,.052,.0035);
  for(const side of [-1,1])box(g,'Balcony return',iron,x+side*w/2,y+.052,.055,.004,.004,.082);
}

// The opening is real: glass sits behind a reveal. Wedge-shaped brick voussoirs
// follow the segmental lower heads and the semicircular fifth-floor heads.
function opening(wall:Masonry,g:THREE.Group,out:Pane[],x:number,bottom:number,spring:number,rise:number,half:number,
  l:number,r:number,top:number,z:number,door:boolean){
  const paneZ=z-.023,glazing=door?'#414e49':glass;
  wall.rect(l,x-half,bottom,top,z,brick);wall.rect(x+half,r,bottom,top,z,brick);
  const count=rise>.001?12:1;
  for(let j=0;j<count;j++){
    const u=-1+2*j/count,v=-1+2*(j+1)/count;
    const a=x+u*half,b=x+v*half;
    const ya=spring+rise*Math.sqrt(Math.max(0,1-u*u)),yb=spring+rise*Math.sqrt(Math.max(0,1-v*v));
    wall.quad([a,ya,z],[b,yb,z],[b,top,z],[a,top,z],brick);
    wall.quad([a,bottom,paneZ],[b,bottom,paneZ],[b,yb,paneZ],[a,ya,paneZ],glazing);
    wall.quad([a,ya,z],[a,ya,paneZ],[b,yb,paneZ],[b,yb,z],rust);
    if(rise>.001){
      const thickness=rise>.055?.042:.029;
      const q=x+u*(half+.015),s=x+v*(half+.015);
      wall.quad([a,ya,z+.001],[b,yb,z+.001],[s,yb+thickness,z+.001],[q,ya+thickness,z+.001],j%3===1?lightBrick:'#ad725c');
      wall.quad([a,ya,z+.002],[a+.0018,ya,z+.002],[q+.0018,ya+thickness,z+.002],[q,ya+thickness,z+.002],rust);
    }
  }
  for(const side of [-1,1]){
    const sx=x+side*half;
    wall.quad([sx,bottom,z],[sx,spring,z],[sx,spring,paneZ],[sx,bottom,paneZ],rust);
  }
  box(g,'Paired mullion',iron,x,(bottom+spring+rise)/2,paneZ+.003,.005,spring+rise-bottom,.004);
  box(g,'Transom',iron,x,spring-(door?.032:.042),paneZ+.004,half*2,.005,.005);
  box(g,'Terra-cotta window sill','#ac785e',x,bottom-.002,z+.002,half*2+.009,.010,.014);
  for(const side of [-1,1])light(out,g,x+side*half*.47,(bottom+spring)/2,paneZ+.007,half*.78,(spring-bottom)*.76);
}

function factoryElevation(g:THREE.Group,out:Pane[],width:number,howard:boolean){
  const bays=howard?9:6,step=width/bays,wall=new Masonry();
  for(let i=0;i<bays;i++){
    const x=(i+.5)*step,l=i*step,r=(i+1)*step,half=step*.346;
    const recessed=howard?i>=3&&i<=5:i<3,z=recessed?-.010:.003;
    const entry=howard?i>=3&&i<=5:i<3;
    wall.rect(l,x-half,.03,.095,z+.003,granite);
    wall.rect(x+half,r,.03,.095,z+.003,granite);
    if(!entry)wall.rect(x-half,x+half,.03,.095,z,granite);
    const levels=[[.095,.298,.030,.377],[.405,.567,.014,.614],[.637,.804,0,.862],[.882,1.048,0,1.095],[1.109,1.259,half,1.44]];
    let last=entry?.03:.095;
    for(const [floor,[base,spring,rise,top]] of levels.entries()){
      const threshold=floor===0&&entry?.03:base;
      wall.rect(l,r,last,threshold,z,brick);
      opening(wall,g,out,x,threshold,spring,rise,half,l,r,top,z,entry&&floor===0);last=top;
    }
    // Rusticated banding returns at corners and around the three recessed bays.
    for(let y=.114;y<1.38;y+=.0345){
      const q=step*(Math.round(y/.0345)%2?.16:.115);
      wall.rect(l,l+q,y,y+.0024,z+.0025,rust);
      wall.rect(r-q,r,y,y+.0024,z+.0025,rust);
    }
    if(i===(howard?4:2))for(const y of [.395,.622,.873,1.104])balcony(g,x,y,step*1.01);
  }
  wall.rect(0,width,1.439,1.501,0,brick);
  wall.build(g);
  for(const [y,h,d,c] of [[.374,.020,.031,'#b67e60'],[.618,.014,.027,'#af765c'],[1.421,.016,.032,rust],[1.470,.020,.050,lightBrick],[1.501,.020,.060,'#b98067']] as const)
    box(g,'Terra-cotta stringcourse',c,width/2,y,.002,width+.018,h,d);
  for(let i=0;i<bays*4;i++)box(g,'Corbelled cornice tooth',rust,(i+.5)*width/(bays*4),1.447,.007,.023,.041,.032);
}

// National Register nomination, section 7 and photographs 1–2 (1996):
// https://npgallery.nps.gov/GetAsset/ad9fd586-32ec-4a65-929b-1aabb60e8143
// Both public elevations photographed from the street corner:
// https://commons.wikimedia.org/wiki/File:Folger_Coffee_Company_Building_(San_Francisco).JPG
// The 2023 USGS cloud resolves the 28 m factory roof, 29 m street parapet,
// raised service strip, and the warehouse's 22–23 m front and 26 m setback roof.
export function addFolgerBuilding(b:Building,root:THREE.Group,windows:Pane[]){
  if(b.id!==main&&b.id!==warehouse)return false;
  const factory=b.id===main,part=new THREE.Group();
  part.name=factory?'Folger office and coffee manufactory':'Folger adjoining warehouse';root.add(part);
  const p=b.p.slice(0,-1),top=factory?1.467:1.075;
  // Move the street backing inward so the glass and the main entries can recess.
  const core=p.map(q=>q.slice());
  for(const edge of factory?[[0,3],[1,0]]:[[0,1]]){
    const [a,c]=edge,dx=p[c][0]-p[a][0],dz=p[c][1]-p[a][1],len=Math.hypot(dx,dz);
    for(const k of edge){core[k][0]+=dz/len*.042;core[k][1]-=dx/len*.042;}
  }
  slab(part,'Brick party walls',core,.029,top-.012,brick);
  slab(part,'Flat roofing',p,top-.012,top,'#9a9890');
  if(factory){
    const howard=street(part,'Nine Howard Street bays',p[0],p[3]),spear=street(part,'Six Spear Street bays',p[1],p[0]);
    factoryElevation(howard.g,windows,howard.width,true);factoryElevation(spear.g,windows,spear.width,false);
    for(const side of [[p[2],p[1]],[p[3],p[2]]]){
      const rear=street(part,'Rear roof perimeter',side[0],side[1]);
      box(rear.g,'Brick parapet',rust,rear.width/2,1.480,0,rear.width,.045,.026);
    }
    // Roof service volumes follow the party wall shared with the warehouse.
    box(spear.g,'Setback smoke tower','#8e8173',.105,1.606,-.46,.17,.278,.68);
    box(spear.g,'Smoke tower coping','#b3a697',.105,1.749,-.46,.183,.014,.697);
    box(spear.g,'Rear service roof','#aaa49a',.068,1.547,-1.64,.12,.16,1.34);
    box(howard.g,'Corner flagstaff','#a7a799',.18,1.697,-.12,.007,.402,.007);
  }else{
    const {g,width}=street(part,'Spear Street warehouse front',p[0],p[1]),wall=new Masonry(),x=width/2;
    const levels=[[.096,.289,.023,.374],[.403,.528,.015,.608],[.627,.752,0,.817],[.837,.955,.020,1.045]];
    let previous=.03;
    for(const [floor,[base,spring,rise,cap]] of levels.entries()){
      const half=floor===0?.094:.060;
      if(floor)wall.rect(0,width,previous,base,.006,brick);
      else{
        wall.rect(0,x-half,.03,base,.006,granite);
        wall.rect(x+half,width,.03,base,.006,granite);
      }
      opening(wall,g,windows,x,floor?base:.03,spring,rise,half,0,width,cap,-.013,floor===0);previous=cap;
      if(floor)balcony(g,x,base-.007,.152);
    }
    wall.build(g);
    for(const side of [-1,1])box(g,'Warehouse rusticated end pier',brick,x+side*width*.385,.538,.006,width*.217,1.015,.028);
    for(const y of [.375,.816,1.046,1.088])box(g,'Warehouse cornice and belt',lightBrick,x,y,.008,width+.009,.014,.036);
    for(let i=0;i<15;i++)box(g,'Warehouse dentil',rust,(i+.5)*width/15,1.063,.015,.022,.024,.030);
    const depth=Math.hypot(p[2][0]-p[1][0],p[2][1]-p[1][1]);
    box(g,'Setback warehouse rooftop','#aa9d8d',x,1.183,-depth*.62,width-.068,.215,depth*.68);
    box(g,'Warehouse roof coping','#aca69b',x,1.303,-depth*.62,width-.056,.025,depth*.68+.01);
  }
  return true;
}
