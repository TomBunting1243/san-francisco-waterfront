import * as THREE from 'three';
import type {Font} from 'three/addons/loaders/FontLoader.js';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import {footprintGeometry} from './sf-map.ts';

type Building={id:number;p:number[][]};
type Pane={x:number;y:number;z:number;ry:number;w:number;h:number};

export function backgroundFrontage(b:Building,height:number,font:Font){
  const restaurant=b.id===193054137;
  if(!restaurant&&b.id!==256981078)return;
  const root=new THREE.Group(),windows:Pane[]=[],materials=new Map<string,THREE.MeshStandardMaterial>();
  root.name=restaurant?'139 Steuart / 132 The Embarcadero':'99 Green / 962 Battery';
  function mesh(geo:THREE.BufferGeometry,color:string,parent:THREE.Group){
    let m=materials.get(color);
    if(!m)materials.set(color,m=new THREE.MeshStandardMaterial({color,roughness:.86}));
    const part=new THREE.Mesh(geo,m);parent.add(part);return part;
  }
  const wall=restaurant?'#dfdcd1':'#afafb0';
  mesh(footprintGeometry(b.p,height),wall,root);
  mesh(footprintGeometry(b.p,.009),restaurant?'#a4a398':'#9ea29c',root).position.y=height;
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
  if(restaurant){
    // Operator photograph, 2023 events deck p.12; Jones Product's 2018
    // elevation identifies the three bays of the narrow waterfront parcel.
    const {frame,length,box,window}=frontage(2),bay=length*.29;
    const ground=height*.31,upper=height*.64;
    for(const side of [-1,1]){
      const x=side*bay;
      window(x,ground*.52,bay*.78,ground*.64,'#b5b3a5');
      box(bay*.80,.030,.015,x,ground*.89,.014,'#6e7772','Storefront louver');
    }
    for(const sign of [-1,1])box(.010,.047,.013,sign*.52*bay,ground*.67,.019,'#4f4d44');
    const wood='#694e41';
    window(0,ground*.46,bay*.89,ground*.74,wood);
    for(const x of [-bay*.43,0,bay*.43])box(.012,ground*.76,.028,x,ground*.45,.021,wood);
    box(bay*.93,.014,.033,0,ground*.81,.021,wood,'Entry transom');
    const geo=new TextGeometry('ANGLER',{font,size:.027,depth:.001,curveSegments:2});geo.center();
    mesh(geo,'#b4a188',frame).position.set(0,ground*.90,.022);
    box(length,.026,.034,0,ground+.011,.011,'#d4d1c4','Storefront cornice');
    for(const x of [-bay,0,bay]){
      window(x,(ground+upper)/2,bay*.72,(upper-ground)*.71,'#c0bfb2');
      box(.005,(upper-ground)*.71,.005,x,(ground+upper)/2,.015,'#8b9490');
      box(bay*.72,.005,.005,x,(ground+upper)/2,.015,'#8b9490');
    }
    box(length,.033,.044,0,upper,.014,'#c7c5b7','Upper cornice');
    window(0,(height+upper)/2,length*.89,(height-upper)*.72,'#a1a29a');
    for(let j=1;j<7;j++)box(.007,(height-upper)*.73,.007,length*.89*(j/7-.5),(height+upper)/2,.016,'#909b97');
    box(length*.89,.006,.006,0,(height+upper)/2,.016,'#909b97');
    // Retain the existing backdrop panes on the opposite street. The published
    // restaurant elevation documents only the waterfront side.
    const back=frontage(0);
    for(let y=.4;y<height-.25;y+=.48)for(let d=.28;d<back.length-.2;d+=.4){
      const pos=back.frame.localToWorld(new THREE.Vector3(d-back.length/2,y,.045));
      windows.push({x:pos.x,y,z:pos.z,ry:back.frame.rotation.y,w:.16,h:.23});
    }
  }else{
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
  }
  return {root,windows};
}
