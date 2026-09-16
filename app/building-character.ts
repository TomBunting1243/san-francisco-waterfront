import * as THREE from 'three';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import type {Font} from 'three/addons/loaders/FontLoader.js';
import {center,footprintGeometry} from './sf-map.ts';

type Building={id:number;name:string;p:number[][];h:number;minH?:number;parent?:number};
type Pane={x:number;y:number;z:number;ry:number;w:number;h:number};
export const characterBuildings=new Set(['Hotel Griffon','Harbor Court Hotel','Army and Navy Y.M.C.A. Building','Steuart Place','1 Hotel San Francisco','Pier 5','Ferry Station Post Office Building','Fireboat Station 35']);
export const characterColors:Record<string,string>={'Hotel Griffon':'#c5b699','Harbor Court Hotel':'#ad8066','Army and Navy Y.M.C.A. Building':'#b58a70','Steuart Place':'#d0bfa5','1 Hotel San Francisco':'#b78870','Pier 5':'#d9ceb9','Ferry Station Post Office Building':'#d9ccb4','Fireboat Station 35':'#a6b6b4'};
export function insideBuilding(x:number,z:number,points:number[][]){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}

/** Selective detail on exposed faces only; adjoining mapped parts hide shared walls. */
export function buildingCharacter(b:Building,neighbors:Building[],font:Font){
  const root=new THREE.Group(),windows:Pane[]=[],materials=new Map<string,THREE.MeshStandardMaterial>();
  root.name=`${b.name} character pass`;
  const [cx,cz]=center(b.p),base=b.minH||0,cream='#e7dcc4',dark='#426369',trim='#bdac8f';
  const peers=neighbors.filter(n=>n.id!==b.id&&n.h>base&&n.p.some(p=>Math.hypot(p[0]-cx,p[1]-cz)<12));
  function mesh(g:THREE.BufferGeometry,c:string,x:number,y:number,z:number,parent=root){if(!materials.has(c))materials.set(c,new THREE.MeshStandardMaterial({color:c,roughness:.83}));const m=new THREE.Mesh(g,materials.get(c));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  const box=(w:number,h:number,d:number,x:number,y:number,z:number,c:string,parent=root)=>mesh(new THREE.BoxGeometry(w,h,d),c,x,y,z,parent);
  function text(s:string,size:number,x:number,y:number,z:number,parent:THREE.Group,c=dark){const geo=new TextGeometry(s,{font,size,depth:.004,curveSegments:2});geo.computeBoundingBox();geo.translate(-geo.boundingBox!.max.x/2,0,0);return mesh(geo,c,x,y,z,parent);}
  function exposed(parent:THREE.Group,x:number,y:number){const p=parent.localToWorld(new THREE.Vector3(x,y,.10));return !peers.some(n=>y>=(n.minH||0)-.015&&y<n.h+.015&&insideBuilding(p.x,p.z,n.p));}
  function pane(x:number,y:number,w:number,h:number,parent:THREE.Group){if(!exposed(parent,x,y))return;box(w+.045,h+.045,.035,x,y,.043,dark,parent);const p=parent.localToWorld(new THREE.Vector3(x,y,.067));windows.push({x:p.x,y:p.y,z:p.z,ry:parent.rotation.y,w,h});for(const dx of [-w/2-.012,w/2+.012])box(.015,h+.035,.055,x+dx,y,.060,trim,parent);box(w+.045,.018,.085,x,y-h/2-.016,.070,trim,parent);box(.008,h,.020,x,y,.082,'#7c9690',parent);box(w,.008,.020,x,y+.025,.083,'#7c9690',parent);}
  function shrub(x:number,y:number,z:number,parent:THREE.Group){box(.19,.07,.15,x,y,z,'#a8977e',parent);for(const dx of [-.06,.03]){const leaf=mesh(new THREE.IcosahedronGeometry(.09,1),dx<0?'#6f9978':'#8ea66b',x+dx,y+.085,z,parent);leaf.scale.y=.65;}}
  const raw=b.p[0][0]===b.p.at(-1)![0]&&b.p[0][1]===b.p.at(-1)![1]?b.p.slice(0,-1):b.p;
  const points=raw.filter((p,i)=>{const a=raw[(i+raw.length-1)%raw.length],q=raw[(i+1)%raw.length];const u=[p[0]-a[0],p[1]-a[1]],v=[q[0]-p[0],q[1]-p[1]],den=Math.hypot(...u)*Math.hypot(...v);return den>.00001&&Math.abs(u[0]*v[1]-u[1]*v[0])/den>.055;});
  const faces=points.map((p,i)=>{const q=points[(i+1)%points.length],len=Math.hypot(q[0]-p[0],q[1]-p[1]);let nx=(q[1]-p[1])/len,nz=-(q[0]-p[0])/len;if(nx*((p[0]+q[0])/2-cx)+nz*((p[1]+q[1])/2-cz)<0){nx=-nx;nz=-nz;}const face=new THREE.Group();face.position.set((p[0]+q[0])/2,0,(p[1]+q[1])/2);face.rotation.y=Math.atan2(nx,nz);root.add(face);face.updateWorldMatrix(true,false);return {face,len,nx,nz};});
  const front=faces.filter(f=>f.len>.5).sort((a,b)=>b.nz-a.nz)[0];
  const classic=['Hotel Griffon','Harbor Court Hotel','Army and Navy Y.M.C.A. Building','Steuart Place'].includes(b.name);
  for(const {face,len,nz} of faces){if(len<.19)continue;
    // Short exposed runs prevent trims crossing a neighboring building's facade.
    const band=(y:number,h:number,d:number,c:string)=>{const count=Math.ceil(len/.20);let start=-1;for(let i=0;i<=count;i++){const open=i<count&&exposed(face,-len/2+(i+.5)*len/count,y);if(open&&start<0)start=i;if(!open&&start>=0){box((i-start)*len/count+.002,h,d,-len/2+(start+i)*len/count/2,y,.05,c,face);start=-1;}}};
    if(classic){
      const harbor=/Harbor Court|Y.M.C.A./.test(b.name),floors=harbor?7:b.name==='Hotel Griffon'?5:5,step=(b.h-.23)/floors;
      band(.06,.07,.13,cream);band(.26,.055,.115,trim);band(b.h-.055,.075,.17,cream);band(b.h+.013,.035,.20,cream);
      const bays=Math.max(2,Math.round(len/.29)),spacing=len/bays;
      for(let i=0;i<bays;i++){
        const x=-len/2+(i+.5)*spacing,w=Math.min(.17,spacing*.65);
        for(let floor=0;floor<floors;floor++){
          const y=.27+(floor+.5)*step;pane(x,y,w,step*.62,face);
          if((floor===floors-1||(!harbor&&floor%2===0))&&exposed(face,x,y))mesh(new THREE.TorusGeometry(w/2+.024,.012,4,12,Math.PI),cream,x,y+step*.30,.093,face);
        }
        if(exposed(face,x,.15)){pane(x,.15,spacing*.70,.20,face);box(.035,.24,.07,x-spacing/2,.14,.09,trim,face);}
        if(exposed(face,x,b.h-.09))box(.042,.075,.11,x,b.h-.09,.08,trim,face);
      }
      for(let y=.34;y<b.h-.15;y+=.085)band(y,.008,.018,harbor?'#c19477':'#cbbba0');
      for(const side of [-1,1])for(let y=.32;y<b.h-.12;y+=.12){const x=side*(len/2-.025);if(exposed(face,x,y))box(.065,.038,.08,x,y,.07,cream,face);}
      if(face===front?.face){
        box(.36,.23,.06,0,.145,.11,dark,face);box(.016,.20,.025,0,.14,.155,cream,face);
        const canopy=box(.54,.035,.27,0,.32,.18,b.name==='Steuart Place'?'#697f75':'#49675f',face);canopy.rotation.x=.08;
        for(const x of [-.24,.24]){box(.015,.27,.015,x,.18,.285,dark,face);shrub(x*1.5,.085,.16,face);}
        if(b.name==='Hotel Griffon'){
          const sign=new THREE.Group();sign.position.set(-len*.34,.45,.16);sign.rotation.y=-Math.PI/2;face.add(sign);box(.17,.68,.06,0,.34,0,'#364c49',sign);
          [...'GRIFFON'].forEach((letter,i)=>text(letter,.073,0,.61-i*.086,.038,sign,cream));
        }else if(harbor&&b.name==='Army and Navy Y.M.C.A. Building'){
          text('YMCA',.13,0,b.h-.25,.115,face);for(const x of [-len*.34,len*.34]){box(.17,.24,.16,x,b.h+.03,-.02,'#c99e7e',face);mesh(new THREE.ConeGeometry(.18,.11,4), '#ae7155',x,b.h+.20,-.02,face).rotation.y=Math.PI/4;}
        }else if(b.name==='Harbor Court Hotel')text('HARBOR COURT',.08,0,b.h-.25,.11,face);
      }
      if(harbor&&len>.5&&nz>.5){for(let x=-len/2+.04;x<len/2;x+=.085){const tile=box(.055,.025,.23,x,b.h+.05,-.035,'#ac7658',face);tile.rotation.x=.22;}}
    }else if(b.name==='1 Hotel San Francisco'){
      band(base+.035,.065,.11,base===0?cream:'#ba9077');band(b.h+.018,.044,.13,'#c59b7d');
      const bays=Math.max(1,Math.round(len/.32)),spacing=len/bays;
      for(let i=0;i<bays;i++){
        const x=-len/2+(i+.5)*spacing;
        for(let y=base+.145;y<b.h-.055;y+=.215)pane(x,y,Math.min(.215,spacing*.73),.14,face);
        if(exposed(face,x,b.h+.08)&&b.minH&&len>.45){box(spacing,.018,.018,x,b.h+.13,.035,dark,face);box(.013,.14,.02,x-spacing/2,b.h+.067,.035,dark,face);if(i%2===0)shrub(x,b.h+.055,-.095,face);}
      }
      for(let y=base+.105;y<b.h-.06;y+=.105)band(y,.009,.012,'#c99d82');
      if(!b.minH&&face===front?.face){
        const curve=new THREE.EllipseCurve(0,0,.50,.12,0,Math.PI,false,0).getPoints(20);const pts=curve.map(p=>new THREE.Vector3(p.x,.33+p.y,.27));mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),20,.018,5,false),dark,0,0,0,face);
        for(let i=0;i<7;i++){const x=-.46+i*.153;box(.025,.018,.26,x,.33+.12*Math.sqrt(1-(x/.5)**2),.14,dark,face);}text('1 HOTEL',.079,0,.26,.09,face);for(const x of [-.61,.61])shrub(x,.10,.15,face);
      }
    }else if(b.name==='Fireboat Station 35'){
      band(b.h+.035,.065,.20,'#d4dcce');band(.08,.10,.10,'#82999a');
      for(let y=.14;y<b.h-.08;y+=.039)band(y,.012,.025,'#bdc9c3');
      if(len>1){
        const bays=Math.floor(len/.28);for(let i=0;i<bays;i++)pane(-len/2+(i+.5)*len/bays,b.h*.69,.23,.15,face);
        if(nz>.1){box(.46,.35,.06,0,.255,.08,'#a55345',face);for(let y=.14;y<.42;y+=.05)box(.43,.01,.025,0,y,.122,'#ca8970',face);text('FIREBOAT 35',.078,0,b.h-.08,.1,face);}
      }else if(len>.7){pane(0,.42,len*.74,.5,face);for(let x=-len*.3;x<len*.35;x+=.16)box(.018,.52,.04,x,.42,.103,dark,face);}
    }else if(b.name==='Pier 5'||b.name==='Ferry Station Post Office Building'){
      const pier=b.name==='Pier 5';band(.08,.085,.13,cream);band(b.h-.11,.055,.12,trim);band(b.h+.02,.075,.18,cream);
      const spacing=pier?.48:.44,bays=Math.max(1,Math.round(len/spacing));
      for(let i=0;i<bays;i++){
        const x=-len/2+(i+.5)*len/bays,w=Math.min(.29,len/bays*.66);if(!exposed(face,x,b.h*.4))continue;
        pane(x,b.h*.41,w,b.h*.58,face);mesh(new THREE.TorusGeometry(w/2+.028,.023,5,16,Math.PI),cream,x,b.h*.69,.10,face);
        for(const dx of [-w/2-.03,w/2+.03]){box(.045,b.h*.60,.10,x+dx,b.h*.4,.09,cream,face);box(.085,.043,.13,x+dx,b.h*.72,.09,trim,face);}
        for(let y=.17;y<b.h-.13;y+=.1){box(.065,.027,.012,x-len/bays/2,y,.10,trim,face);}
        box(.045,.05,.12,x,b.h-.055,.085,trim,face);
      }
      if(face===front?.face||pier&&nz<-.8&&len>2){box(Math.min(len*.7,1.25),.16,.08,0,b.h+.025,.085,cream,face);text(pier?'PIER 5':'FERRY STATION',pier?.14:.085,0,b.h-.013,.138,face);}
    }
  }
  // Modest roof furniture stays on uncovered portions of the mapped roof.
  const roofPoints=b.p.map(([x,z])=>[cx+(x-cx)*.88,cz+(z-cz)*.88]);
  const roofClear=(x:number,z:number)=>insideBuilding(x,z,b.p)&&!peers.some(n=>n.h>b.h-.01&&insideBuilding(x,z,n.p));
  if(classic||b.name==='Ferry Station Post Office Building'||b.name==='Fireboat Station 35'){
    mesh(footprintGeometry(roofPoints,.018),classic?'#a79d89':'#a9b7ac',0,b.h+.005,0);
    if(roofClear(cx,cz)){box(.23,.11,.22,cx,b.h+.072,cz,'#8f9e95');for(let i=0;i<4;i++)box(.19,.008,.017,cx,b.h+.13,cz-.075+i*.05,dark);}
  }
  if(b.name==='Army and Navy Y.M.C.A. Building'&&front){
    const {face,len}=front;const w=Math.min(.66,len*.32);
    box(w,.25,.48,0,b.h+.12,-.22,'#bc9272',face);
    for(const x of [-w*.3,0,w*.3]){box(.065,.13,.022,x,b.h+.15,.035,dark,face);mesh(new THREE.TorusGeometry(.039,.01,4,12,Math.PI),cream,x,b.h+.21,.05,face);}
    const cap=mesh(new THREE.ConeGeometry(w*.78,.26,4),'#af785a',0,b.h+.37,-.22,face);cap.rotation.y=Math.PI/4;cap.scale.z=.8;
    box(.013,.36,.013,0,b.h+.66,-.22,dark,face);
  }
  return {root,windows};
}

/** Add readable roof and podium accents to the already detailed modern buildings. */
export function modernBuildingAccents(b:Building,neighbors:Building[]){
  const root=new THREE.Group(),[cx,cz]=center(b.p),base=b.minH||0;
  const mat=new THREE.MeshStandardMaterial({color:'#dcd8c5',roughness:.85}),green=new THREE.MeshStandardMaterial({color:'#789680',roughness:.95}),shade=new THREE.MeshStandardMaterial({color:'#668184',roughness:.8});
  const add=(w:number,h:number,d:number,x:number,y:number,z:number,material:THREE.Material=mat)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;root.add(m);return m;};
  const clear=(x:number,z:number,y:number)=>!neighbors.some(n=>n.id!==b.id&&n.h>y&&y>=(n.minH||0)&&insideBuilding(x,z,n.p));
  for(let i=1;i<b.p.length;i++){
    const a=b.p[i-1],q=b.p[i],len=Math.hypot(q[0]-a[0],q[1]-a[1]);if(len<.35)continue;let nx=(q[1]-a[1])/len,nz=-(q[0]-a[0])/len;if(nx*((a[0]+q[0])/2-cx)+nz*((a[1]+q[1])/2-cz)<0){nx=-nx;nz=-nz;}
    const ry=Math.atan2(nx,nz),mid=[(a[0]+q[0])/2,(a[1]+q[1])/2];
    const beam=(y:number,w:number,h:number,d:number,material=mat)=>{if(clear(mid[0]+nx*.12,mid[1]+nz*.12,y))add(w,h,d,mid[0]+nx*.10,y,mid[1]+nz*.10,material).rotation.y=ry;};
    beam(b.h+.035,len,.085,.17);beam(Math.max(base+.18,.22),len,.10,.22);
    if(!b.name.includes('Hyatt')){
      beam(b.h-.28,len,.065,.12,shade);
      if(b.name==='One Steuart Lane')for(let u=.35;u<len-.1;u+=.65){const x=a[0]+(q[0]-a[0])*u/len+nx*.18,z=a[1]+(q[1]-a[1])*u/len+nz*.18;for(const y of [.70,1.60,2.5,3.40])if(clear(x,z,y)){add(.28,.11,.14,x,y,z,green).rotation.y=ry;}}
    }
  }
  const xs=b.p.map(p=>p[0]),zs=b.p.map(p=>p[1]),w=Math.min(.85,(Math.max(...xs)-Math.min(...xs))*.3),d=Math.min(.8,(Math.max(...zs)-Math.min(...zs))*.3);
  if(clear(cx,cz,b.h+.01)&&insideBuilding(cx,cz,b.p)){
    add(w,.22,d,cx,b.h+.12,cz,shade);for(let j=0;j<5;j++)add(w+.04,.018,d+.035,cx,b.h+.04+j*.047,cz);
    for(const dx of [-w*.7,w*.7])if(insideBuilding(cx+dx,cz,b.p))add(.13,.12,.15,cx+dx,b.h+.07,cz,shade);
  }
  return root;
}
