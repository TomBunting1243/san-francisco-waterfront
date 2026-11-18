import * as THREE from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import fontData from './harbor-font.json' with {type:'json'};
import {bakeRigidChunk} from './city-blocks.ts';
import {westMarketGround} from './curb-survey.ts';

const font=new FontLoader().parse(fontData);
const boxGeometry=new THREE.BoxGeometry();
const colors=new Map<string,THREE.MeshStandardMaterial>();
export function createStreetPaint(){
  return new THREE.MeshStandardMaterial({vertexColors:true,roughness:.74,side:THREE.DoubleSide});
}
const painted=createStreetPaint();

/** Each rigid assembly is baked once in local metres. Doors and people can then move independently. */
export class StreetAssembly {
  parts:THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>[]=[];
  add(geometry:THREE.BufferGeometry,ink:string,x:number,y:number,z:number){
    let material=colors.get(ink);
    if(!material){material=new THREE.MeshStandardMaterial({color:ink});colors.set(ink,material);}
    const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);this.parts.push(mesh);return mesh;
  }
  box(x:number,y:number,z:number,w:number,h:number,d:number,ink:string){
    const mesh=this.add(boxGeometry,ink,x,y,z);mesh.scale.set(w,h,d);return mesh;
  }
  label(text:string,x:number,y:number,z:number,height:number,ink:string,angle=0){
    const shape=new THREE.ShapeGeometry(font.generateShapes(text,height),2);
    shape.computeBoundingBox();shape.translate(-.5*(shape.boundingBox!.min.x+shape.boundingBox!.max.x),0,0);
    this.add(shape,ink,x,y,z).rotation.y=angle;
  }
  bake(name:string,material=painted){
    for(const part of this.parts)part.updateMatrixWorld();
    return bakeRigidChunk(name,this.parts,material);
  }
}

export function streetPassenger(coat:string,skin:string){
  const root=new THREE.Group(),body=new StreetAssembly(),trousers=new StreetAssembly();
  const oval=(w:number,h:number,d:number)=>new THREE.SphereGeometry(1,8,5).scale(w,h,d);
  body.add(oval(.19,.32,.13),coat,0,1.10,0);
  body.add(oval(.119,.146,.117),skin,0,1.53,0);
  body.add(oval(.121,.079,.119),'#53433e',0,1.61,-.01);
  for(const side of [-1,1])body.box(side*.195,1.10,.02,.085,.44,.105,coat).rotation.z=side*.095;
  root.add(body.bake('Painted passenger'));
  trousers.box(0,-.208,0,.13,.42,.15,'#4c5962');trousers.box(0,-.58,0,.115,.36,.14,'#515c60');
  trousers.box(0,-.772,.045,.135,.085,.24,'#514c46');
  const left=trousers.bake('Walking leg'),right=left.clone();root.add(left,right);
  left.position.set(-.083,.817,0);right.position.set(.083,.817,0);
  function stride(t:number,walking:boolean){left.rotation.x=walking?.37*Math.sin(5.6*t):.014;right.rotation.x=-left.rotation.x;}
  return {root,stride};
}

const clamp=(x:number)=>Math.max(0,Math.min(1,x));
export const restroomSites=[
  // Contract toilet 12. The two lobes in SF’s 2024 8 cm aerial lie ~9.6 m east of OSM node 10538307838, between the paired palm rows.
  {name:'Embarcadero Plaza AmeniPOD',x:-.353,z:-7.855,yaw:-1.45,modern:true},
  // Contract toilet 13 at Pier 22 1/2; measured long axis / dimensions of mapped OSM closed way 1164599598.
  {name:'Harrison automatic public toilet',x:-43.5396,z:-1.1677,yaw:1.421,modern:false},
];
function vestibule(body:StreetAssembly,r:number){
  body.box(0,1.06,-.33,1.42,2.1,.047,'#676e6b');
  for(const side of [-1,1])body.box(side*.69,1.07,.35,.04,2.14,1.28,'#77837e');
  body.box(-.66,1.33,r+.050,.165,.33,.025,'#687773');
  body.box(-.66,1.40,r+.067,.115,.13,.013,'#344e51');
}
function plazaPod(body:StreetAssembly){
  // Roof trace: round ends separated by 1.88 m and a shallow concave waist.
  // The 2023 USGS surface has a 7.19–7.29 m roof cluster beside 3.39 m paving;
  // higher overlapping returns are the palm crown. The SmithGroup installation
  // photograph shows the horizontal seam and taper above and below the belly.
  const stations=[[-1.89,.008],[-1.84,.32],[-1.68,.61],[-1.44,.84],[-1.18,.96],[-.94,1.00],[-.69,.96],[-.53,.88],[0,.79],[.53,.88],[.69,.96],[.94,1.00],[1.18,.96],[1.44,.84],[1.68,.61],[1.84,.32],[1.89,.008]];
  const levels=[[.02,.92],[.35,.975],[2.12,1.035],[2.15,1.035],[2.19,1.03],[3.75,.931],[3.83,.92]];
  const colors=['#9baaaa','#b3b9ad','#939f9e','#adc0bd','#8d9c9d','#b9bdb3'];
  for(let i=1;i<stations.length;i++){
    const [x0,w0]=stations[i-1],[x1,w1]=stations[i];
    for(let j=1;j<levels.length;j++)for(const sign of [-1,1]){
      if(sign===1&&Math.abs((x1+x0)/2)<.53&&j<=3)continue;
      const [y0,f0]=levels[j-1],[y1,f1]=levels[j];
      const quad=new THREE.BufferGeometry();quad.setAttribute('position',new THREE.Float32BufferAttribute([
        x0*f0,y0,sign*w0*f0,x1*f0,y0,sign*w1*f0,x1*f1,y1,sign*w1*f1,x0*f1,y1,sign*w0*f1],3));
      quad.setIndex(sign===1?[0,1,2,0,2,3]:[2,1,0,3,2,0]);quad.computeVertexNormals();
      body.add(quad,j===3?'#667677':colors[(i+(j>4?1:0))%colors.length],0,0,0);
    }
    // Flat, pale roof with a continuous sinuous perimeter visible from the Ferry camera.
    const [y,f]=levels[levels.length-1],top=new THREE.BufferGeometry();
    top.setAttribute('position',new THREE.Float32BufferAttribute([x0*f,y,-w0*f,x0*f,y,w0*f,x1*f,y,w1*f,x1*f,y,-w1*f],3));
    top.setIndex([0,1,2,0,2,3]);top.computeVertexNormals();body.add(top,'#c5c9bf',0,0,0);
  }
  body.box(0,.015,0,2.4,.030,1.54,'#9b9b8c');
  body.label('WC',.72,1.84,.997,.12,'#d3d7c9');
  vestibule(body,.87);return .875;
}
function harrisonToilet(body:StreetAssembly){
  const r=1.14,half=.76,height=2.69,trim='#455c50';
  for(const side of [-1,1])body.add(new THREE.CylinderGeometry(r,r,height,16,1,true,side>0?0:Math.PI,Math.PI),trim,side*half,height/2,0);
  body.box(0,height/2,-r,half*2,height,.055,trim);
  for(const s of [-1,1])body.box(s*(half+.53)/2,height/2,r,half-.53,height,.047,trim);
  body.box(0,(height+2.16)/2,r,1.075,height-2.16,.048,trim);
  body.box(0,.016,0,half*2,.032,2*r,'#958f82');
  for(const [y,h,f] of [[height-.08,.09,1.03],[height+.036,.085,1.065],[height+.13,.10,1.035],[height+.20,.075,.98]]){
    body.box(0,y,0,2*half,h,2*r*f,trim);
    for(const s of [-1,1])body.add(new THREE.CylinderGeometry(r*f,r*f,h,20),trim,s*half,y,0);
  }
  for(const side of [-1,1])for(const x of [-.65,.65])body.box(x,1.30,side*(r+.025),.047,2.24,.047,'#647264');
  body.box(0,1.40,-r-.037,1.19,1.54,.055,'#425449');body.box(0,1.40,-r-.073,1.05,1.39,.012,'#b5b7a4');
  vestibule(body,r);body.label('WC',0,2.29,r+.036,.14,'#e0d7bc');return r;
}
export function createStreetAmenities(){
  const root=new THREE.Group();root.name='Waterfront automatic toilets';
  const sites=restroomSites.map((site,i)=>{
    const room=new THREE.Group();room.name=site.name;room.position.set(site.x,site.modern?westMarketGround(site.x,site.z)+.00035:.11,site.z);
    room.rotation.y=site.yaw;room.scale.setScalar(.06);root.add(room);
    const body=new StreetAssembly(),r=site.modern?plazaPod(body):harrisonToilet(body);
    room.add(body.bake('Fixed enclosure and recessed vestibule'));
    const panel=new StreetAssembly();
    panel.box(0,1.08,0,1.10,2.14,.042,site.modern?'#a3afae':'#526657');
    panel.box(.44,1.09,.027,.030,.44,.027,site.modern?'#6d7874':'#c1b99d');
    const door=panel.bake('Sliding accessible door');room.add(door);door.position.z=r-.044;
    const visitor=streetPassenger(i?'#878b6d':'#aa7060',i?'#b4896e':'#ca9f81');room.add(visitor.root);visitor.root.name='Restroom visitor';
    return {site,room,r,door,visitor};
  });
  function update(elapsed:number){
    for(const [i,{site,room,r,door,visitor}] of sites.entries()){
      const t=(elapsed+(i?55:9))%137;
      const entering=clamp((t-7)/3), exiting=clamp((t-43)/3);
      const gap=Math.max(Math.min(clamp(t-5),clamp(12-t)),Math.min(clamp(t-41),clamp(48-t)));
      door.position.x=gap*1.10;
      const p=visitor.root;p.visible=t<10||t>=43&&t<55;
      if(p.visible){
        const z=t<10?r+.73+Math.max(0,6-t)*.83-entering*1.31:r-.58+exiting*1.31+Math.max(0,t-46)*.83;
        p.position.set(.04,0,z);p.rotation.y=t<10?Math.PI:0;
        if(site.modern){const x=site.x+.06*(Math.cos(site.yaw)*p.position.x+Math.sin(site.yaw)*z),worldZ=site.z+.06*(-Math.sin(site.yaw)*p.position.x+Math.cos(site.yaw)*z);
          p.position.y=Math.max(0,(westMarketGround(x,worldZ)+.00035-room.position.y)/.06);}
        visitor.stride(t,t<6||t>=7);
      }
    }
  }
  update(0);return {root,update};
}
