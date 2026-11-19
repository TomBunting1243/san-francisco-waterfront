import * as THREE from 'three';
import type {Font} from 'three/addons/loaders/FontLoader.js';
import {anglerFrontage} from './angler-frontage.ts';
import {footprintGeometry} from './sf-map.ts';

type Building={id:number;p:number[][]};
type Pane={x:number;y:number;z:number;ry:number;w:number;h:number};

export function backgroundFrontage(b:Building,height:number,font:Font){
  if(b.id===193054137)return anglerFrontage(b,height,font);
  if(b.id!==256981078)return;
  const root=new THREE.Group(),windows:Pane[]=[],materials=new Map<string,THREE.MeshStandardMaterial>();
  root.name='99 Green / 962 Battery';
  function mesh(geo:THREE.BufferGeometry,color:string,parent:THREE.Group){
    let m=materials.get(color);
    if(!m)materials.set(color,m=new THREE.MeshStandardMaterial({color,roughness:.86}));
    const part=new THREE.Mesh(geo,m);parent.add(part);return part;
  }
  const wall='#afafb0';
  mesh(footprintGeometry(b.p,height),wall,root);
  mesh(footprintGeometry(b.p,.009),'#9ea29c',root).position.y=height;
  // World positions stay compatible with the city's single night-window draw.
  function frontage(edge:number){
    const [x,z]=b.p[edge],[a,c]=b.p[edge+1],length=Math.hypot(a-x,c-z);
    const cx=(a+x)/2,cz=(c+z)/2;
    const center=b.p.slice(1).reduce(([u,v],[p,q])=>[u+p,v+q],[0,0]).map(n=>n/(b.p.length-1));
    let nx=(c-z)/length,nz=(x-a)/length;
    if(nx*(cx-center[0])+nz*(cz-center[1])<0){nx=-nx;nz=-nz;}
    const frame=new THREE.Group();frame.position.set(cx,0,cz);frame.rotation.y=Math.atan2(nx,nz);root.add(frame);frame.updateMatrixWorld();
    function box(w:number,h:number,d:number,x:number,y:number,z:number,color:string,name=''){
      const m=mesh(new THREE.BoxGeometry(w,h,d),color,frame);m.position.set(x,y,z);m.name=name;return m;
    }
    function window(x:number,y:number,w:number,h:number,border:string){
      box(w+.015,h+.016,.009,x,y,.006,border,'Window reveal');
      const pos=frame.localToWorld(new THREE.Vector3(x,y,.012));
      windows.push({x:pos.x,y:pos.y,z:pos.z,ry:frame.rotation.y,w,h});
    }
    return {frame,length,box,window};
  }
  // GFDS Engineers' city-filed 2024 exterior photo (p.19): a three-story
  // concrete warehouse with a horizontally jointed base and steel sash.
  for(const [edge,bays] of [[0,4],[1,8]]){
    const {length,box,window}=frontage(edge),spacing=length/bays,course=height*.31;
    for(const f of [.15,.32,.49,.66,.83])box(length,.006,.005,0,course*f,.005,'#868b8b','Base joint');
    for(let j=0;j<bays;j++){
      const x=(j+.5)*spacing-length/2,w=spacing*.60;
      window(x,course*.49,w,course*.69,'#929599');
      for(const f of [.48,.79]){
        const h=height*.144;
        window(x,height*f,w,h,'#898e8e');
        box(.005,h,.007,x,height*f,.016,'#677674');
        box(w,.005,.006,x,height*f+h*.22,.016,'#677674');
        if(f>.60)for(const m of [-.27,.27])box(.004,h*.27,.006,x+w*m,height*f+h*.36,.016,'#677674');
      }
    }
    box(length,.019,.022,0,height-.025,.009,'#bfbeb7','Parapet band');
  }
  return {root,windows};
}
