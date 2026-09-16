import * as THREE from 'three';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import type {Font} from 'three/addons/loaders/FontLoader.js';
import {center} from './sf-map.ts';

type Building={name:string;p:number[][];h:number};
type Window={x:number;y:number;z:number;ry:number;w:number;h:number};
export const detailedWaterfrontNames=new Set(['Southern Pacific Building','The Audiffred Building','Pier 1']);

/** Reference-derived miniatures on the mapped footprints, not surveyed replicas. */
export function waterfrontLandmark(b:Building,font:Font){
  const root=new THREE.Group(),windows:Window[]=[],materials=new Map<string,THREE.MeshStandardMaterial>();
  root.name=b.name+' architectural detail';
  const [cx,cz]=center(b.p),stone='#dfcdb0',ivory='#f0dfbd',glass='#35545b',metal='#527b72';
  function mesh(g:THREE.BufferGeometry,c:string,x:number,y:number,z:number,parent=root){
    if(!materials.has(c))materials.set(c,new THREE.MeshStandardMaterial({color:c,roughness:.85}));
    const m=new THREE.Mesh(g,materials.get(c));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  const box=(w:number,h:number,d:number,x:number,y:number,z:number,c:string,parent=root)=>mesh(new THREE.BoxGeometry(w,h,d),c,x,y,z,parent);
  function text(s:string,size:number,x:number,y:number,z:number,parent:THREE.Group,c=glass){
    const geo=new TextGeometry(s,{font,size,depth:.006,curveSegments:2});geo.computeBoundingBox();geo.translate(-geo.boundingBox!.max.x/2,0,0);return mesh(geo,c,x,y,z,parent);
  }
  function pane(x:number,y:number,z:number,w:number,h:number,parent:THREE.Group){
    box(w,h,.018,x,y,z,glass,parent);
    parent.updateWorldMatrix(true,false);const p=parent.localToWorld(new THREE.Vector3(x,y,z+.013));
    windows.push({x:p.x,y:p.y,z:p.z,ry:parent.rotation.y,w:w*.84,h:h*.83});
  }
  function arch(x:number,bottom:number,w:number,stem:number,parent:THREE.Group,c=stone){
    const r=w/2,shape=new THREE.Shape();shape.moveTo(-r,0);shape.lineTo(r,0);shape.lineTo(r,stem);shape.absarc(0,stem,r,0,Math.PI,false);shape.lineTo(-r,0);
    mesh(new THREE.ShapeGeometry(shape,16),glass,x,bottom,.075,parent);
    mesh(new THREE.TorusGeometry(r+.018,.025,5,20,Math.PI),c,x,bottom+stem,.107,parent);
    for(const dx of [-r-.02,r+.02])box(.05,stem,.085,x+dx,bottom+stem/2,.09,c,parent);
    pane(x,bottom+stem*.48,.09,w*.83,stem*.86,parent);
    for(const dx of [-w*.22,0,w*.22])box(.012,stem+r*.6,.025,x+dx,bottom+(stem+r*.6)/2,.13,metal,parent);
    box(w,.017,.035,x,bottom+stem,.132,metal,parent);box(.07,.10,.11,x,bottom+stem+r,.105,ivory,parent);
  }
  function pediment(w:number,h:number,x:number,y:number,z:number,parent:THREE.Group){
    const s=new THREE.Shape();s.moveTo(-w/2,0);s.lineTo(0,h);s.lineTo(w/2,0);s.closePath();mesh(new THREE.ExtrudeGeometry(s,{depth:.07,bevelEnabled:false}),stone,x,y,z,parent);
    for(const sign of [-1,1]){const bar=box(Math.hypot(w/2,h),.035,.13,x+sign*w/4,y+h/2,z+.03,ivory,parent);bar.rotation.z=-sign*Math.atan2(h,w/2);}
  }
  // Merge near-collinear footprint vertices before laying out architectural bays.
  const points=b.p.slice(0,-1).filter((p,i,all)=>{const a=all[(i+all.length-1)%all.length],q=all[(i+1)%all.length];const u=[p[0]-a[0],p[1]-a[1]],v=[q[0]-p[0],q[1]-p[1]];return Math.abs(u[0]*v[1]-u[1]*v[0])/(Math.hypot(...u)*Math.hypot(...v))>.045;});
  const faces=points.map((p,i)=>{
    const q=points[(i+1)%points.length],dx=q[0]-p[0],dz=q[1]-p[1],len=Math.hypot(dx,dz);let nx=dz/len,nz=-dx/len;
    if(nx*((p[0]+q[0])/2-cx)+nz*((p[1]+q[1])/2-cz)<0){nx=-nx;nz=-nz;}
    const face=new THREE.Group();face.position.set((p[0]+q[0])/2,0,(p[1]+q[1])/2);face.rotation.y=Math.atan2(nx,nz);root.add(face);return {face,len,nx,nz};
  });
  if(b.name==='Southern Pacific Building'){
    const entrance=faces.filter(f=>f.len>1).sort((a,b)=>b.nz-a.nz)[0];
    for(const {face,len} of faces){if(len<.35)continue;
      box(len,.78,.07,0,.4,.025,stone,face);
      for(const [y,height,depth] of [[.08,.09,.13],[.84,.07,.15],[b.h-.53,.08,.15],[b.h-.12,.10,.22],[b.h,.055,.27]])box(len+.10,height,depth,0,y,.08,ivory,face);
      for(let y=.16;y<.77;y+=.12)box(len,.01,.012,0,y,.067,'#baa38a',face);
      const bays=Math.max(1,Math.round(len/.40)),step=len/bays;
      for(let i=0;i<bays;i++){
        const x=-len/2+(i+.5)*step,w=Math.min(.24,step*.63);
        if(face!==entrance.face)arch(x,.11,w,.36,face);
        for(let y=1.02;y<b.h-.40;y+=.265){
          pane(x,y,.049,w,.175,face);box(w+.065,.025,.095,x,y-.108,.077,stone,face);
          for(const dx of [-w/2-.018,w/2+.018])box(.025,.21,.055,x+dx,y,.072,'#c79271',face);
          box(.012,.17,.027,x,y,.083,ivory,face);
        }
      }
      for(const sign of [-1,1])box(.05,b.h-.94,.09,sign*(len/2-.04),(b.h+.72)/2,.06,stone,face);
      for(let x=-len/2+.055;x<len/2;x+=.115)box(.05,.09,.14,x,b.h-.22,.085,stone,face);
      for(let y=.96;y<b.h-.61;y+=.14)box(len,.009,.012,0,y,.012,'#bb8469',face);
      if(face===entrance.face){
        const span=Math.min(len*.8,2.65),step=span/3;
        for(let i=-1;i<=1;i++)arch(i*step,.10,step*.72,.47,face);
        box(span,.15,.09,0,.90,.10,stone,face);text('SOUTHERN PACIFIC COMPANY',.063,0,.875,.16,face);
        mesh(new THREE.CircleGeometry(.15,24),ivory,0,1.16,.095,face);mesh(new THREE.TorusGeometry(.16,.028,5,24),stone,0,1.16,.12,face);
        for(let i=0;i<12;i++){const a=i*Math.PI/6;const tick=box(.011,.022,.014,Math.sin(a)*.119,1.16+Math.cos(a)*.119,.128,glass,face);tick.rotation.z=-a;}
        const hour=box(.013,.075,.015,-.024,1.181,.139,glass,face);hour.rotation.z=.85;const minute=box(.01,.10,.015,.025,1.193,.139,glass,face);minute.rotation.z=-.55;
        for(const x of [-span/2,span/2]){box(.13,.68,.15,x,.43,.1,ivory,face);box(.23,.08,.2,x,.79,.12,stone,face);}
      }
    }
    box(1.2,.13,.8,cx,b.h+.08,cz,'#aaa38d');
  }
  if(b.name==='The Audiffred Building'){
    for(const {face,len} of faces){if(len<.25)continue;
      for(const [y,h,d] of [[.035,.06,.11],[.32,.07,.12],[.61,.075,.15],[.68,.045,.18]])box(len+.06,h,d,0,y,.06,ivory,face);
      const bays=Math.max(2,Math.round(len/.31)),step=len/bays;
      for(let i=0;i<bays;i++){
        const x=-len/2+(i+.5)*step,w=step*.68;
        pane(x,.18,.06,w,.235,face);box(.025,.26,.075,x-step/2,.18,.10,metal,face);box(.07,.045,.11,x-step/2,.302,.10,ivory,face);
        pane(x,.48,.048,w*.69,.18,face);box(w*.9,.021,.075,x,.379,.075,ivory,face);
        mesh(new THREE.TorusGeometry(w*.39,.018,4,12,Math.PI),'#d7b38e',x,.545,.08,face);
        box(.011,.18,.025,x,.48,.077,ivory,face);
        if(i%2===0){
          box(w*.87,.14,.15,x,.82,-.035,ivory,face);pane(x,.823,.048,w*.62,.10,face);pediment(w,.06,x,.897,.035,face);
        }
      }
      for(let y=.36;y<.61;y+=.065)for(const side of [-1,1])box(.08,.035,.09,side*(len/2-.025),y,.063,'#dbb58d',face);
      for(let x=-len/2+.04;x<len/2;x+=.082)box(.034,.045,.12,x,.645,.08,'#d5b291',face);
      // Inward-sloping mansard surface and a modest diamond slate pattern.
      const roofShape=new THREE.Shape();roofShape.moveTo(-len/2,0);roofShape.lineTo(len/2,0);roofShape.lineTo(len/2,.29);roofShape.lineTo(-len/2,.29);roofShape.closePath();
      const roof=mesh(new THREE.ShapeGeometry(roofShape),'#587d77',0,.69,.025,face);roof.rotation.x=-.42;
      for(let x=-len/2+.065;x<len/2-.035;x+=.11)for(let row=0;row<3;row++){
        const tile=mesh(new THREE.PlaneGeometry(.032,.032),'#a4b2a0',x+(row%2)*.04,.735+row*.076,.012-row*.034,face);tile.rotation.set(-.42,0,Math.PI/4);
      }
      box(len,.035,.08,0,.971,-.094,metal,face);
      if(len<1.2){text('AUDIFFRED',.067,0,.324,.14,face);box(.022,.23,.022,len*.28,.335,.21,metal,face);mesh(new THREE.CircleGeometry(.085,20),'#344f4b',len*.28,.39,.24,face);text('B',.095,len*.28,.351,.25,face,ivory);}
    }
    box(.6,.035,2.25,cx,.98,cz,'#69897b').rotation.y=-.15;
  }
  if(b.name==='Pier 1'){
    // The monumental bulkhead is taller than the long, utilitarian transit shed.
    const front=new THREE.Group();front.position.set(12.1,0,-1.84);front.rotation.y=Math.PI;root.add(front);
    const width=3.9;box(width,1.0,.62,0,.5,-.27,stone,front);
    for(const y of [.06,.49,.94,1.02])box(width+.10,.055,.14,0,y,.07,ivory,front);
    for(let y=.12;y<.91;y+=.10)box(width,.009,.013,0,y,.049,'#b8aa92',front);
    for(let i=-2;i<=2;i++){
      const x=i*.72;
      if(i===0){arch(x,.045,.59,.48,front);pediment(.98,.26,0,1.07,.045,front);text('PIER 1',.12,0,.938,.17,front);}
      else{pane(x,.27,.071,.40,.31,front);pane(x,.73,.071,.34,.27,front);for(const dx of [-.10,.10])box(.013,.27,.035,x+dx,.73,.108,ivory,front);box(.34,.013,.035,x,.73,.11,ivory,front);}
      for(const dx of [-.30,.30]){box(.075,.87,.10,x+dx,.48,.085,ivory,front);box(.13,.065,.15,x+dx,.92,.10,ivory,front);}
    }
    for(let x=-width/2+.055;x<width/2;x+=.095)box(.04,.055,.12,x,.977,.095,stone,front);
    // Shed roof strips, clerestory and cargo bays stay within its mapped envelope.
    box(.45,.12,8.7,12.05,.64,6.15,'#a3aca2');box(.58,.045,8.8,12.05,.715,6.15,'#d3d0b9');
    for(const {face,len} of faces){if(len<2||face.position.z<0)continue;
      for(let x=-len/2+.25;x<len/2;x+=.65){pane(x,.30,.065,.40,.29,face);box(.04,.55,.085,x-.27,.29,.07,stone,face);box(.4,.021,.05,x,.30,.1,metal,face);}
      box(len,.045,.10,0,.58,.055,ivory,face);
    }
  }
  return {root,windows};
}
