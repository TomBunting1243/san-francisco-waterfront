import * as THREE from 'three';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import type {Font} from 'three/addons/loaders/FontLoader.js';
import {center,footprintGeometry} from './sf-map.ts';
import {insideBuilding} from './building-character.ts';

type Building={id:number;p:number[][];h:number;parent?:number};
export const mooredVesselIds=new Set([281243360,281243626]);
export const isMooredVessel=(b:Building)=>mooredVesselIds.has(b.parent||b.id);

/** The mapped mooring footprints, with photographed deck and hull profiles. */
export function mooredVessel(b:Building,font:Font){
  const root=new THREE.Group(),windows:{x:number;y:number;z:number;ry:number;w:number;h:number}[]=[];
  const belle=b.id===281243626,[cx,cz]=center(b.p),white='#e0dfce',dark='#324d4f',materials=new Map<string,THREE.MeshStandardMaterial>();
  root.name=belle?'San Francisco Belle, Pier 3':'Santa Rosa, Pier 3';
  const mat=(c:string)=>{if(!materials.has(c))materials.set(c,new THREE.MeshStandardMaterial({color:c,roughness:.85}));return materials.get(c)!;};
  const mesh=(geo:THREE.BufferGeometry,c:string,x:number,y:number,z:number,parent:THREE.Object3D=root)=>{const m=new THREE.Mesh(geo,mat(c));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;};
  const box=(w:number,h:number,d:number,x:number,y:number,z:number,c:string,parent:THREE.Object3D=root)=>mesh(new THREE.BoxGeometry(w,h,d),c,x,y,z,parent);
  const scaled=(sx:number,sz:number)=>b.p.map(([x,z])=>[cx+(x-cx)*sx,cz+(z-cz)*sz]);
  const deck=(p:number[][],base:number,h:number,c:string)=>mesh(footprintGeometry(p,h),c,0,base,0);
  const beam=(a:THREE.Vector3,q:THREE.Vector3,r:number,c:string)=>{const d=q.clone().sub(a),m=mesh(new THREE.CylinderGeometry(r,r,d.length(),5),c,(a.x+q.x)/2,(a.y+q.y)/2,(a.z+q.z)/2);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());};
  deck(b.p,-.75,.45,dark);deck(scaled(.99,.99),-.32,.035,white);
  const cabin=scaled(belle?.80:.94,belle?.89:.97),floors=belle?3:2,step=belle?.30:.34;
  deck(cabin,-.285,floors*step,white);
  for(let floor=0;floor<floors;floor++){
    const base=-.285+floor*step;
    deck(belle?scaled(1,.97):b.p,base+step-.008,.033,white);
    for(let e=1;e<cabin.length;e++){
      const a=cabin[e-1],q=cabin[e],len=Math.hypot(q[0]-a[0],q[1]-a[1]);if(len<.06)continue;
      let nx=(q[1]-a[1])/len,nz=-(q[0]-a[0])/len;if(insideBuilding((a[0]+q[0])/2+nx*.01,(a[1]+q[1])/2+nz*.01,cabin)){nx=-nx;nz=-nz;}
      const face=new THREE.Group();face.position.set((a[0]+q[0])/2,base,(a[1]+q[1])/2);face.rotation.y=Math.atan2(nx,nz);root.add(face);face.updateWorldMatrix(true,false);
      const bays=Math.max(1,Math.round(len/(belle?.19:.21))),spacing=len/bays,w=spacing*(belle?.60:.54),h=step*.58;
      for(let i=0;i<bays;i++){
        const x=-len/2+(i+.5)*spacing;
        box(w,h,.015,x,step*.51,.012,dark,face);
        if(belle){mesh(new THREE.TorusGeometry(w/2,.014,4,10,Math.PI),white,x,step*.51+h/2-w/2,.026,face);}
        else {box(.010,h,.017,x,step*.51,.025,white,face);box(w,.01,.017,x,step*.51,.025,white,face);}
        const p=face.localToWorld(new THREE.Vector3(x,step*.51,.023));windows.push({x:p.x,y:p.y,z:p.z,ry:face.rotation.y,w:w*.80,h:h*.79});
      }
      if(belle){
        const outside=.12;
        for(const y of [.05,.13])box(len,.012,.012,0,y,outside,dark,face);
        for(let x=-len/2;x<len/2;x+=.15)box(.009,.16,.009,x,.08,outside,dark,face);
        for(let x=-len/2;x<len/2;x+=.47)box(.014,step,.014,x,step/2,outside,white,face);
      }
    }
  }
  const top=-.285+floors*step;
  if(belle){
    for(const x of [cx-.25,cx+.25]){
      mesh(new THREE.CylinderGeometry(.055,.062,.27,8),dark,x,top+.15,cz-.72);
      mesh(new THREE.CylinderGeometry(.079,.057,.07,8),'#916346',x,top+.30,cz-.72);
    }
    box(.43,.17,.36,cx,top+.09,cz-1.30,white);box(.39,.07,.025,cx,top+.11,cz-1.49,dark);
    // Decorative stern wheel and its two transverse rims.
    const stern=Math.max(...b.p.map(p=>p[1]))-.06;
    for(const x of [cx-.31,cx+.31]){const wheel=mesh(new THREE.TorusGeometry(.30,.022,5,18),'#965447',x,-.22,stern);wheel.rotation.y=Math.PI/2;}
    for(let i=0;i<12;i++){const a=i*Math.PI/6,paddle=box(.64,.085,.036,cx,-.22+Math.sin(a)*.29,stern+Math.cos(a)*.29,'#985746');paddle.rotation.x=-a;}
    for(const side of [-1,1]){
      const sign=new THREE.Group();sign.position.set(cx+side*.42,top+.07,cz);sign.rotation.y=side*Math.PI/2;root.add(sign);
      box(1.80,.20,.018,0,.05,0,dark,sign);
      const geo=new TextGeometry('SAN FRANCISCO BELLE',{font,size:.095,depth:.003,curveSegments:2});geo.computeBoundingBox();geo.translate(-geo.boundingBox!.max.x/2,0,0);mesh(geo,'#ddc796',0,.014,.015,sign);
    }
  }else{
    for(const dz of [-1.42,1.42]){
      box(.35,.20,.45,cx,top+.10,cz+dz,white);
      for(const side of [-1,1])box(.012,.09,.32,cx+side*.18,top+.13,cz+dz,dark);
      box(.39,.026,.49,cx,top+.216,cz+dz,'#8a9383');
    }
    box(.28,.23,.30,cx,top+.13,cz,dark);
    for(const dz of [-.9,-.42,.42,.9])for(const side of [-1,1]){
      const x=cx+side*.30;
      mesh(new THREE.CylinderGeometry(.026,.034,.13,7),white,x,top+.065,cz+dz);
      const hood=mesh(new THREE.SphereGeometry(.052,8,6),white,x,top+.16,cz+dz);hood.scale.set(1,1,1.25);
      const mouth=mesh(new THREE.CircleGeometry(.037,8),'#934f42',x,top+.165,cz+dz+.056);mouth.rotation.x=-.1;
    }
  }
  // Open upper-deck railings follow the actual hull outline.
  for(let i=1;i<b.p.length;i++){
    const a=b.p[i-1],q=b.p[i],len=Math.hypot(q[0]-a[0],q[1]-a[1]);
    beam(new THREE.Vector3(a[0],top+.11,a[1]),new THREE.Vector3(q[0],top+.11,q[1]),.006,dark);
    for(let t=0;t<len;t+=.18){const u=t/len;box(.009,.13,.009,a[0]+(q[0]-a[0])*u,top+.06,a[1]+(q[1]-a[1])*u,dark);}
  }
  return {root,windows};
}
