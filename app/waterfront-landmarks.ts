import * as THREE from 'three';
import {staticBoxes} from './static-boxes.ts';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import type {Font} from 'three/addons/loaders/FontLoader.js';
import {center,footprintGeometry} from './sf-map.ts';

type Building={name:string;p:number[][];h:number};
type Window={x:number;y:number;z:number;ry:number;w:number;h:number};
export const detailedWaterfrontNames=new Set(['Southern Pacific Building','The Audiffred Building','Pier 1']);

/** Reference-derived miniatures on the mapped footprints, not surveyed replicas. */
export function waterfrontLandmark(b:Building,font:Font){
  if(b.name==='Southern Pacific Building'||b.name==='One Market Plaza')return oneMarket(b,font);
  const root=new THREE.Group(),windows:Window[]=[],materials=new Map<string,THREE.MeshStandardMaterial>();
  root.name=b.name+' architectural detail';
  const [cx,cz]=center(b.p),stone='#dfcdb0',ivory='#f0dfbd',glass='#35545b',metal='#527b72';
  function mesh(g:THREE.BufferGeometry,c:string,x:number,y:number,z:number,parent=root){
    if(!materials.has(c))materials.set(c,new THREE.MeshStandardMaterial({color:c,roughness:.85}));
    const m=new THREE.Mesh(g,materials.get(c));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  const box=staticBoxes(mesh,root);
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
      // Diamond slates sit on the inclined roof between the dormers.
      for(let x=-len/2+.065;x<len/2-.035;x+=.11)for(let row=0;row<3;row++){
        const tile=mesh(new THREE.PlaneGeometry(.032,.032),'#a4b2a0',x+(row%2)*.04,.735+row*.076,.012-row*.034,face);tile.rotation.set(-.42,0,Math.PI/4);
      }
      if(len<1.2){text('AUDIFFRED',.067,0,.324,.14,face);box(.022,.23,.022,len*.28,.335,.21,metal,face);mesh(new THREE.CircleGeometry(.085,20),'#344f4b',len*.28,.39,.24,face);text('B',.095,len*.28,.351,.25,face,ivory);}
    }
    // SF Landmark 7 records a slate mansard with third-story dormers. Offset
    // adjacent surveyed facade lines to join the four hips and the flat crown.
    // https://sfplanninggis.org/docs/landmarks_and_districts/LM7.pdf
    function offsetRing(distance:number){
      return points.map(([x,z],i)=>{
        const a=faces[(i+faces.length-1)%faces.length],b=faces[i];
        const scale=distance/(1+a.nx*b.nx+a.nz*b.nz);
        return [x+(a.nx+b.nx)*scale,z+(a.nz+b.nz)*scale];
      });
    }
    const eave=offsetRing(.025),crown=offsetRing(.025-.29*Math.sin(.42));
    const baseY=.69,topY=baseY+.29*Math.cos(.42),slates:number[]=[];
    for(let i=0;i<eave.length;i++){
      const j=(i+1)%eave.length;
      const a=[eave[i][0],baseY,eave[i][1]],b=[eave[j][0],baseY,eave[j][1]];
      const c=[crown[j][0],topY,crown[j][1]],d=[crown[i][0],topY,crown[i][1]];
      const outward=(a[2]-b[2])*faces[i].nx+(b[0]-a[0])*faces[i].nz>0;
      for(const point of outward?[a,b,c,a,c,d]:[c,b,a,d,c,a])slates.push(...point);
    }
    const shell=new THREE.BufferGeometry();
    shell.setAttribute('position',new THREE.Float32BufferAttribute(slates,3));shell.computeVertexNormals();
    mesh(shell,'#587d77',0,0,0).name='Audiffred slate mansard';
    mesh(footprintGeometry(crown,.016),'#69897b',0,topY,0).name='Audiffred inset roof crown';
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
    // The 2024 San Francisco orthophoto shows a long southern bank of panels
    // and two shorter banks at the head. The south eave steps in along the slip.
    const ridgeX=12.24, ridgeY=.747, pitch=.119;
    const roofY=(x:number)=>ridgeY-Math.abs(x-ridgeX)*pitch;
    const stations=[[-.35,11.12,13.195],[1.43,11.04,13.20],[5.41,11.025,13.209],[8.57,11.62,13.217],[11.71,11.62,13.224]];
    const pitches=new Map<string,{color:string;name:string;positions:number[];indices:number[]}>();
    function surface(corners:number[][],color:string,name:string){
      if(!pitches.has(color))pitches.set(color,{color,name,positions:[],indices:[]});
      const batch=pitches.get(color)!,offset=batch.positions.length/3;
      batch.positions.push(...corners.flat());
      batch.indices.push(offset,offset+1,offset+2,offset,offset+2,offset+3);
    }
    function roofSurface(corners:number[][],color:string,lift:number,name:string){
      surface(corners.map(([x,z])=>[x,roofY(x)+lift,z]),color,name);
    }
    for(let i=1;i<stations.length;i++){
      const [z0,s0,n0]=stations[i-1],[z1,s1,n1]=stations[i];
      surface([[s0,b.h,z0],[s1,b.h,z1],[s1,roofY(s1),z1],[s0,roofY(s0),z0]],'#b9af96','Pier 1 south eave');
      surface([[n0,b.h,z0],[n0,roofY(n0),z0],[n1,roofY(n1),z1],[n1,b.h,z1]],'#c5bea8','Pier 1 north eave');
      roofSurface([[s0,z0],[s1,z1],[ridgeX,z1],[ridgeX,z0]],'#c0beb1',0,'Pier 1 south pitch');
      roofSurface([[ridgeX,z0],[ridgeX,z1],[n1,z1],[n0,z0]],'#d6d2c3',0,'Pier 1 north pitch');
    }
    box(.035,.024,12.06,ridgeX,ridgeY+.006,5.68,'#dbd6c5');
    // Orthophoto bounds in the local projection. Clear service aisles divide
    // the racks, with access to the ridge and to the mechanical curb at the head.
    const fields=[[-.09,.82,11.77,12.17],[.97,2.67,11.77,12.17],[2.81,6.10,11.77,12.17],[6.34,7.63,11.77,12.17],
      [8.08,9.78,12.55,12.96],[10.02,11.66,12.55,12.76],[10.63,11.66,12.77,13.02],
      [8.08,8.39,11.70,12.16],[8.68,10.85,11.70,12.06],[10.96,11.66,11.70,12.51]];
    const panelColors=['#515f70','#56657a','#4f6073','#5c697b'];
    for(const [near,far,low,high] of fields){
      roofSurface([[low,near],[low,far],[high,far],[high,near]],'#a7aaa6',.009,'Pier 1 panel rack');
      const rows=Math.max(1,Math.round((high-low)/.11)),cols=Math.max(1,Math.round((far-near)/.185));
      for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
        const x0=low+(high-low)*row/rows+.006,x1=low+(high-low)*(row+1)/rows-.006;
        const z0=near+(far-near)*col/cols+.006,z1=near+(far-near)*(col+1)/cols-.006;
        roofSurface([[x0,z0],[x0,z1],[x1,z1],[x1,z0]],panelColors[(row*3+col*7)%4],.014,'Pier 1 solar module');
      }
    }
    const [headZ,headSouth,headNorth]=stations[stations.length-1];
    for(const [left,right] of [[headSouth,ridgeX],[ridgeX,headNorth]]){
      surface([[left,b.h,headZ],[right,b.h,headZ],[right,roofY(right),headZ],[left,roofY(left),headZ]],'#cfc6ae','Pier 1 bay end');
    }
    for(const {color,name,positions,indices} of pitches.values()){
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
      geo.setIndex(indices);geo.computeVertexNormals();mesh(geo,color,0,0,0).name=name;
    }
    for(const z of [8.85,9.45,10.12]){
      box(.19,.037,.34,12.33,ridgeY+.032,z,'#a5ada8');box(.205,.018,.36,12.33,ridgeY+.056,z,'#dfdcd0');
    }
    // Full-height, steel-framed glazing occupies the old freight openings.
    for(const {face,len} of faces){if(len<1.15||face.position.z<0)continue;
      const bays=Math.max(1,Math.round(len/.55)),spacing=len/bays;
      for(let i=0;i<bays;i++){
        const x=-len/2+(i+.5)*spacing,w=spacing*.79;
        pane(x,.315,.059,w,.422,face);
        for(const dx of [-w*.25,0,w*.25])box(.012,.428,.025,x+dx,.315,.085,'#728582',face);
        for(const y of [.251,.411])box(w,.012,.025,x,y,.086,'#84918b',face);
        box(.05,.47,.073,x-spacing*.47,.32,.054,stone,face);
      }
      box(len,.043,.088,0,.575,.053,ivory,face);
    }
  }
  return {root,windows};
}

// The developer's history plate gives the original E plan and its three street elevations.
// https://www.americanassetstrust.com/images/uploads/AAT/sustainability/2023_Sustainability_Report_for_American_Assets_Trust_Inc.pdf#page=41
// Market entrance and balcony elevation by Bliss & Faville:
// https://commons.wikimedia.org/wiki/File:A%26E_vol_LI_no_2_pg_62-1.png
// Present roof plan: SF Public Works 2024 orthophoto, checked against USGS 2023 3DEP.
// https://bsm.sfdpw.org/mapviewer/DotNet.aspx?Layers=1 (2024 aerial)
// https://s3-us-west-2.amazonaws.com/usgs-lidar-public/CA_SanFrancisco_1_B23/ept.json
function oneMarket(b:Building,font:Font){
  const root=new THREE.Group(),local=new THREE.Group(),windows:Window[]=[];
  root.name=b.name+' architectural detail';root.add(local);
  // Origin is the mapped Spear/Market corner. +u runs to Steuart, +v to Mission.
  local.position.set(-3.443,0,-15.222);local.rotation.y=Math.atan2(-4.891,.725);
  const wide=Math.hypot(4.891,.725),deep=Math.hypot(4.020,.596);
  const palette=new Map<string,THREE.MeshStandardMaterial>(),cube=new THREE.BoxGeometry(1,1,1);
  function mesh(g:THREE.BufferGeometry,c:string,x:number,y:number,z:number,parent:THREE.Group,name=''){
    if(!palette.has(c))palette.set(c,new THREE.MeshStandardMaterial({color:c,roughness:.86}));
    const m=new THREE.Mesh(g,palette.get(c));m.position.set(x,y,z);m.name=name;
    m.receiveShadow=true;m.castShadow=true;parent.add(m);return m;
  }
  function box(w:number,h:number,d:number,x:number,y:number,z:number,c:string,parent=local,name=''){
    const m=mesh(cube,c,x,y,z,parent,name);m.scale.set(w,h,d);return m;
  }
  function mass(u0:number,v0:number,u1:number,v1:number,base:number,top:number,c:string,name:string){
    return box(u1-u0,top-base,v1-v0,(u0+u1)/2,(base+top)/2,(v0+v1)/2,c,local,name);
  }
  function facade(x:number,z:number,ry:number,name:string){
    const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=ry;g.name=name;local.add(g);g.updateWorldMatrix(true,false);return g;
  }
  function light(g:THREE.Group,x:number,y:number,z:number,w:number,h:number){
    const p=g.localToWorld(new THREE.Vector3(x,y,z));
    windows.push({x:p.x,y:p.y,z:p.z,ry:local.rotation.y+g.rotation.y,w,h});
  }
  const brick='#ad8170',limestone='#c8b7a0',cream='#e0d1b7',glass='#536668',sash='#a49784';
  const deck=1.642,eave=2.612;

  if(b.name==='One Market Plaza'){
    // Six-story postwar podium, separate from the historic frontage and from both towers.
    // https://sfplanning.org/sites/default/files/za/1%20Market%20Street.pdf
    // https://www.som.com/projects/one-market-plaza/
    mesh(footprintGeometry(b.p,deck),'#bbbaac',0,0,0,root,'One Market Plaza podium');
    const [cx,cz]=center(b.p);
    for(let i=1;i<b.p.length;i++){
      const [a,z]=b.p[i-1],[c,v]=b.p[i],dx=c-a,dz=v-z,len=Math.hypot(dx,dz);
      const u=(a+c)/2,q=(z+v)/2;
      const towardsMission=local.worldToLocal(new THREE.Vector3(u,0,q)).z;
      if(len<.32||towardsMission<deep+.14)continue;
      const sign=(dz*(u-cx)-dx*(q-cz))>0?1:-1;
      const face=new THREE.Group();face.position.set(u,0,q);face.rotation.y=Math.atan2(sign*dz,-sign*dx);root.add(face);
      for(let floor=0;floor<6;floor++){
        const y=floor===0?.21:.46+(floor-1)*.257;
        const h=floor===0?.32:.161;
        box(len,h,.021,0,y,.012,'#68797c',face);
        const count=Math.max(1,Math.round(len/.34));
        for(let j=0;j<count;j++){
          box(.016,h,.024,(j/count-.5)*len,y,.026,'#a6aca8',face);
          const p=face.localToWorld(new THREE.Vector3(((j+.5)/count-.5)*len,y,.029));
          windows.push({x:p.x,y:p.y,z:p.z,ry:face.rotation.y,w:len/count*.86,h:h*.83});
        }
      }
      box(len,.041,.062,0,deck-.012,.012,'#dbd8c9',face);
    }
    for(const [u,v,r] of [[3.98,5.76,.55],[.84,8.02,.565]]){
      mesh(new THREE.CylinderGeometry(r,r,.022,48),'#bab8aa',u,deck+.01,v,local,'Circular roof garden');
      mesh(new THREE.CylinderGeometry(r-.022,r-.022,.016,48),'#8f9674',u,deck+.024,v,local);
      for(let j=0;j<15;j++){
        const angle=j*2.4,radius=r*Math.sqrt((j+.3)/17);
        const bush=mesh(new THREE.IcosahedronGeometry(.09+(j%3)*.016,0),j%2?'#79876b':'#667c62',u+radius*Math.cos(angle),deck+.041,v+radius*Math.sin(angle),local);
        bush.scale.y=.38;
      }
    }
    for(const [u,v,length] of [[2.38,5.31,1.28],[2.38,6.5,.84],[2.38,8.11,1.34]]){
      box(.60,.022,length,u,deck+.018,v,'#818e8d');
      for(let j=0;j<=5;j++)box(.60,.01,.012,u,deck+.035,v+length*(j/5-.5),'#bdbeb0');
    }
    return {root,windows};
  }

  // Street cornice and wings are about 43.5 m above grade. Only the setback
  // rooftop housings and the hipped central tower reach the higher survey returns.
  // Bliss & Faville's section cuts a vaulted vestibule behind the three
  // central Market arches. Reserve its depth in the street base itself.
  const entryWidth=wide*3/15,entryLeft=(wide-entryWidth)/2,entryRight=entryLeft+entryWidth;
  const entryDepth=.142,entryTop=.54;
  mass(0,0,entryLeft,deep,0,deck,'#b7ada0','Spear side of Market base');
  mass(entryRight,0,wide,deep,0,deck,'#b7ada0','Steuart side of Market base');
  mass(entryLeft,entryDepth,entryRight,deep,0,deck,'#b7ada0','Market vestibule rear wall');
  mass(entryLeft,0,entryRight,entryDepth,entryTop,deck,'#b7ada0','Market vestibule lintel');
  mass(0,0,wide,1.76,deck,eave,brick,'Market wing');
  mass(0,1.76,.96,deep,deck,eave,brick,'Spear wing');
  mass(4.04,1.76,wide,deep,deck,eave,brick,'Steuart wing');
  for(const [a,c,d,f] of [[0,0,wide,1.76],[0,1.76,.96,deep],[4.04,1.76,wide,deep]]){
    mass(a,c,d,f,eave,eave+.013,'#c5c2b6','Wing roof');
  }
  mass(.52,.80,4.49,1.70,eave+.013,2.91,'#b6b2a6','Setback mechanical floor');
  mass(1.12,.12,4.25,.81,eave+.013,2.86,'#c7c3b7','Front roof plant');
  mass(2.11,1.00,2.87,1.77,2.91,3.49,'#b6a48c','Central service tower');
  for(let j=0;j<5;j++)box(.077,.23,.012,2.19+j*.146,3.26,.993,'#777971');
  const hip=mesh(new THREE.ConeGeometry(.61,.26,4),'#928477',2.49,3.62,1.385,local,'Hipped service tower roof');
  hip.rotation.y=Math.PI/4;
  box(.113,.105,.127,2.49,3.79,1.385,'#b2ae9f');
  for(const [u,v] of [[3.16,1.36],[3.37,1.36]]){
    const vent=mesh(new THREE.CylinderGeometry(.087,.087,.04,12),'#8b8c7f',u,2.938,v,local);
    for(let j=0;j<3;j++)box(.14,.006,.012,u,vent.position.y+.022,v,'#b4b2a3').rotation.y=j*Math.PI/3;
  }
  // An open well lies toward Spear. The adjoining bay toward Steuart is
  // glazed. Its six ridges meet above the center, as seen in the City's aerial.
  mass(2.05,1.78,4.04,deep,deck,2.55,'#b8b1a1','Atrium drum');
  const ring=[[2.06,2.93],[2.53,1.88],[3.57,1.88],[4.03,2.93],[3.57,3.99],[2.53,3.99]];
  const peak=new THREE.Vector3(3.046,2.805,2.935);
  function rail(start:THREE.Vector3,end:THREE.Vector3,r:number,c:string){
    const diff=end.clone().sub(start),mid=start.clone().lerp(end,.5);
    const m=mesh(new THREE.CylinderGeometry(r,r,diff.length(),4),c,mid.x,mid.y,mid.z,local);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),diff.normalize());
  }
  for(let i=0;i<6;i++){
    const a=new THREE.Vector3(ring[i][0],2.568,ring[i][1]),q=new THREE.Vector3(ring[(i+1)%6][0],2.568,ring[(i+1)%6][1]);
    const geo=new THREE.BufferGeometry().setFromPoints([a,peak,q]);geo.computeVertexNormals();
    mesh(geo,i<2?'#adc2c4':i<4?'#849da3':'#98acae',0,0,0,local,'Six-sided atrium skylight');
    rail(a,q,.011,'#dfd9c7');rail(a,peak,.012,'#d1c5ad');
    for(let j=1;j<5;j++){
      rail(a.clone().lerp(q,j/5),peak,.004,'#b0afa3');
      rail(a.clone().lerp(peak,j/5),q.clone().lerp(peak,j/5),.004,'#bdb9a8');
    }
  }
  for(const [g,len] of [
    [facade(.96,(deep+1.76)/2,Math.PI/2,'Spear light court wall'),deep-1.76],
    [facade(1.505,1.76,0,'Market light court wall'),1.09],
    [facade(2.05,(deep+1.78)/2,-Math.PI/2,'Atrium light court wall'),deep-1.78]
  ] as const){
    for(let j=0;j<Math.round(len/.22);j++)for(let floor=0;floor<4;floor++){
      box(.115,.145,.016,(j+.5)*len/Math.round(len/.22)-len/2,1.76+floor*.219,.01,'#718180',g);
    }
  }

  for(const [face,len,bays,market] of [
    [facade(wide/2,0,Math.PI,'Market Street elevation'),wide,15,true],
    [facade(0,deep/2,-Math.PI/2,'Spear Street elevation'),deep,12,false],
    [facade(wide,deep/2,Math.PI/2,'Steuart Street elevation'),deep,12,false]
  ] as const){
    const step=len/bays;
    if(market){
      const wing=(len-entryWidth)/2;
      for(const side of [-1,1])box(wing,.54,.048,side*(entryWidth+wing)/2,.27,.018,limestone,face);
    }else box(len,.54,.048,0,.27,.018,limestone,face);
    for(const [y,h,d] of [[.036,.055,.068],[.553,.04,.10],[1.955,.038,.081],[2.005,.06,.09],[2.48,.06,.086],[2.55,.062,.137],[2.603,.042,.175]]){
      if(market&&y===.036){
        const wing=(len+.026-entryWidth)/2;
        for(const side of [-1,1])box(wing,h,d,side*(entryWidth+wing)/2,y,.025,cream,face);
        box(entryWidth,.022,entryDepth+.059,0,.036,(.059-entryDepth)/2,cream,face,'Market vestibule floor');
      }else box(len+.026,h,d,0,y,.025,cream,face);
    }
    // Six punched-window rows sit between the two-story arcade and giant order.
    const coords:number[]=[],colors:number[]=[];
    function panel(x:number,y:number,w:number,h:number,z:number,color:string){
      const lo=x-w/2,hi=x+w/2,base=y-h/2,top=y+h/2,c=new THREE.Color(color);
      coords.push(lo,base,z,hi,base,z,hi,top,z,lo,base,z,hi,top,z,lo,top,z);
      for(let k=0;k<6;k++)colors.push(c.r,c.g,c.b);
    }
    const r=step*.378,stem=.342;
    for(let j=0;j<bays;j++){
      const x=(j+.5)*step-len/2,entrance=market&&Math.abs(j-7)<=1;
      const arch=new THREE.Shape();arch.moveTo(-r,.047);arch.lineTo(r,.047);arch.lineTo(r,stem);arch.absarc(0,stem,r,0,Math.PI,false);arch.closePath();
      if(entrance){
        // Extrude only the stone around the opening. The curve forms the
        // soffit all the way back to the inner entrance, including oblique views.
        const surround=new THREE.Shape();
        surround.moveTo(-step/2,.047);surround.lineTo(-r,.047);surround.lineTo(-r,stem);
        surround.absarc(0,stem,r,Math.PI,0,true);surround.lineTo(r,.047);
        surround.lineTo(step/2,.047);surround.lineTo(step/2,entryTop);
        surround.lineTo(-step/2,entryTop);surround.closePath();
        const vault=new THREE.ExtrudeGeometry(surround,{depth:entryDepth+.046,bevelEnabled:false,curveSegments:10});
        mesh(vault,limestone,x,0,-entryDepth,face,'Market entrance arch');
      }else mesh(new THREE.ShapeGeometry(arch,12),'#626f70',x,0,.046,face,'Retail arcade opening');
      mesh(new THREE.TorusGeometry(r+.006,.009,4,14,Math.PI),cream,x,stem,.054,face);
      for(const side of [-1,1]){
        box(.017,.313,.028,x+side*(r+.005),.192,.052,cream,face);
        box(.043,.024,.038,x+side*(r+.005),stem,.054,cream,face);
      }
      box(.027,.037,.025,x,stem+r,.058,cream,face);
      if(entrance){
        // The photographed side doors have inset bronze-toned surrounds and
        // round ornaments in the vault ends. The center is a wider glazed entry.
        const back=-entryDepth+.004,central=j===7,doorW=r*(central?1.76:1.05);
        panel(x,.183,doorW+.025,.273,back,'#897a68');
        panel(x,.169,doorW,.244,back+.002,central?glass:'#a18c70');
        panel(x,.160,.006,.225,back+.004,sash);
        panel(x,.263,doorW,.009,back+.004,sash);
        if(!central){
          mesh(new THREE.CircleGeometry(.037,16),'#ab9b81',x,stem+.041,back+.003,face,'Vestibule roundel');
          panel(x,.312,doorW+.046,.012,back+.005,cream);
        }
      }else{
        panel(x,.217,r*1.94,.026,.061,sash);panel(x,stem,r*1.94,.013,.062,sash);
        for(const dx of [-r*.46,0,r*.46])panel(x+dx,.204,.009,.306,.063,sash);
        light(face,x,.13,.065,r*1.74,.13);
      }
      for(let col=0;col<2;col++){
        const wx=x+(col-.5)*step*.475,win=step*.257;
        for(let row=0;row<6;row++){
          const y=.68+row*.23;
          panel(wx,y,win+.016,.158,.011,'#9b8271');panel(wx,y,win,.143,.013,glass);
          panel(wx,y+.033,win*.88,.058,.015,'#8d9b99');panel(wx,y,win,.008,.017,sash);
          panel(wx,y-.078,win+.022,.011,.017,limestone);light(face,wx,y,.019,win*.78,.112);
        }
        panel(wx,2.237,win*1.27,.398,.021,glass);panel(wx,2.22,win*1.32,.081,.024,'#8d877b');
        for(const y of [2.108,2.37])light(face,wx,y,.026,win,.112);
        const px=wx-step*.24;
        box(.029,.416,.036,px,2.236,.027,limestone,face);
        for(const y of [2.046,2.439])box(.043,.027,.046,px,y,.032,cream,face);
      }
      for(let k=0;k<3;k++)box(.027,.038,.061,x+(k-1)*step*.31,2.511,.052,limestone,face);
    }
    for(const x of [-len/2+.023,-len/2+step,len/2-step,len/2-.023]){
      box(.024,1.36,.032,x,1.252,.008,limestone,face);
    }
    if(market){
      for(const y of [.567,1.267,1.976]){
        box(3*step,.032,.093,0,y,.063,cream,face);
        for(let j=-2;j<=2;j++)box(.029,.047,.05,j*step*.57,y-.028,.064,limestone,face);
      }
      for(const jamb of [-1.5,-.5,.5,1.5]){
        const x=jamb*step;
        mesh(new THREE.CylinderGeometry(.025,.029,.272,10),cream,x,.194,.056,face,'Market vestibule column');
        box(.067,.014,.063,x,.055,.053,limestone,face);
        box(.071,.021,.068,x,.340,.052,cream,face);
      }
      // The entrance plate and Joe Mabel's Market elevation photograph show
      // an open stone balustrade to either side of the clock's inscription.
      const tabletWidth=step*1.16,balconyWidth=step*3.55;
      box(balconyWidth,.015,.107,0,.562,.066,cream,face);
      box(balconyWidth,.009,.034,0,.616,.104,cream,face);
      box(tabletWidth,.049,.030,0,.590,.102,limestone,face);
      for(const side of [-1,1]){
        const run=(balconyWidth-tabletWidth)/2;
        for(let post=0;post<=2;post++)
          box(.023,.049,.030,side*(tabletWidth/2+(run-.014)*post/2),.590,.103,cream,face);
        for(let spindle=0;spindle<12;spindle++)
          panel(side*(tabletWidth/2+run*(spindle+.5)/12),.590,.007,.049,.108,sash);
      }
      // The incised lettering needs only its visible face on the stone tablet.
      const title=new THREE.ShapeGeometry(font.generateShapes('SOUTHERN PACIFIC COMPANY',.025),2);
      title.computeBoundingBox();
      const titleBounds=title.boundingBox!;
      title.translate(-(titleBounds.max.x+titleBounds.min.x)/2,0,0);
      title.scale((tabletWidth-.018)/(titleBounds.max.x-titleBounds.min.x),1,1);
      mesh(title,'#554f48',0,.578,.120,face);
      mesh(new THREE.CircleGeometry(.051,20),cream,0,.681,.098,face,'Market entrance clock');
      mesh(new THREE.TorusGeometry(.052,.007,5,20),'#6e6151',0,.681,.101,face);
      box(.005,.032,.005,0,.696,.106,'#58594f',face);
      box(.023,.005,.005,.009,.681,.106,'#58594f',face);
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();
    geo.userData.paintVertices=true;
    const panels=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.82}));
    panels.name='Sash, spandrels and sills';face.add(panels);
  }
  return {root,windows};
}
