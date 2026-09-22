import * as THREE from 'three';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import type {Font} from 'three/addons/loaders/FontLoader.js';
import {center} from './sf-map.ts';
import {insideBuilding} from './building-character.ts';

type Building={id:number;name:string;p:number[][];h:number;minH?:number;parent?:number};
type Pane={x:number;y:number;z:number;ry:number;w:number;h:number};
const gatewayTowers=new Set([32859152,32947577,260930240,32612241]);
const pierIds=new Map([[25478417,9],[25478444,15],[25489458,17],[91913152,19],[104599978,26],[104599994,28],[186071977,24]]);
export function architectureProfile(b:Building){
  const id=b.parent||b.id;
  if(/^Embarcadero Center [1-4]$/.test(b.name))return 'center';
  if(gatewayTowers.has(id))return 'gateway';
  if(id===93817368)return 'gap';
  if(id===32862740)return 'harrison';
  if(id===667097308)return 'steuart';
  if(id===28240176)return 'maritime';
  if(id===25489470)return 'bulkhead';
  if(id===288481830)return 'broadcast';
  if(id===105026993)return 'bryant';
  if(id===192328863)return 'spear';
  if(id===32016321)return 'waterfront';
  if(id===32862467)return 'bayside';
  if(id===738027034)return 'observatory';
  if(id===288481832)return 'davis';
  if(id===123559872)return 'ferry-east';
  if(id===123559869)return 'ferry-entry';
  if(id===256969674)return 'commonwealth';
  if(id===193054135)return 'steuart-brick';
  if(pierIds.has(id))return 'pier';
  return undefined;
}
export function referenceColor(b:Building){const p=architectureProfile(b);return p==='steuart-brick'?'#bb9976':p==='gap'?'#a47b66':p==='broadcast'?'#d4cbb0':p==='bryant'?'#dddfd2':p==='spear'?'#b9a16d':p==='bayside'?'#b5a390':p==='davis'?'#ac765b':p==='observatory'?'#657f84':p==='maritime'?'#4c5b58':p==='gateway'?'#bfc3b6':p==='center'?'#b8b8a9':p==='steuart'?'#697e7e':p==='harrison'?'#c6bda8':p?'#d6d2be':undefined;}
function clip(points:number[][],nx:number,nz:number,limit:number,less:boolean){
  const out:number[][]=[];const input=points.slice(0,points[0][0]===points.at(-1)![0]&&points[0][1]===points.at(-1)![1]?-1:undefined);
  for(let i=0;i<input.length;i++){
    const a=input[i],b=input[(i+1)%input.length],da=a[0]*nx+a[1]*nz-limit,db=b[0]*nx+b[1]*nz-limit,ina=less?da<=0:da>=0,inb=less?db<=0:db>=0;
    if(ina)out.push(a);if(ina!==inb){const t=da/(da-db);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
  }
  if(out.length>2)out.push(out[0]);return out;
}
/** Preserve the mapped plan while replacing OSM's single extrusions with the photographed silhouettes. */
export function refineReferenceMassing<T extends Building>(buildings:T[]):T[]{
  return buildings.flatMap(b=>{
    if(b.id===616812910){
      const nx=.888,nz=.459,values=b.p.map(p=>p[0]*nx+p[1]*nz),lo=Math.min(...values),hi=Math.max(...values),width=hi-lo;
      const result:T[]=[{...b,h:8.7}];
      for(const [i,l,r,h] of [[1,.16,.84,9.25],[2,.30,.70,9.86],[3,.42,.58,10.44]]){
        const p=clip(clip(b.p,nx,nz,lo+width*l,false),nx,nz,lo+width*r,true);result.push({...b,id:-616812910-i,parent:b.id,p,h,minH:i===1?8.7:i===2?9.25:9.86});
      }return result;
    }
    if(b.id===93817368){
      const [cx,cz]=center(b.p),scaled=(sx:number,sz:number)=>b.p.map(([x,z])=>[cx+(x-cx)*sx,cz+(z-cz)*sz]);
      return [{...b,name:'Gap headquarters, Two Folsom',h:1.9},{...b,id:-93817368,parent:b.id,name:'Gap headquarters, Two Folsom',p:scaled(.61,.68),h:4.55,minH:1.9},{...b,id:-93817369,parent:b.id,name:'Gap headquarters, Two Folsom',p:scaled(.23,.45),h:5.03,minH:4.55},{...b,id:-93817370,parent:b.id,name:'Gap headquarters, Two Folsom',p:scaled(.15,.30),h:5.46,minH:5.03}];
    }
    if(b.id===25489458)return [{...b,h:.58}];
    if(b.id===25478444)return [{...b,h:.65}];
    if(b.id===123559872)return [{...b,h:.66}];
    if(b.id===123559869)return [{...b,h:.27}];
    if(b.id===256969674)return [{...b,name:'Commonwealth Club',h:.93}];
    if(b.id===32862467){
      // Curved footprint retained; each of the three top floors pulls back from Howard Street.
      const values=b.p.map(p=>p[0]),lo=Math.min(...values),width=Math.max(...values)-lo;
      return [{...b,h:1.08},...[1,2,3].map(i=>({...b,id:-328624670-i,parent:b.id,p:clip(b.p,1,0,lo+width*i*.095,false),h:1.08+i*.20,minH:1.08+(i-1)*.20}))];
    }
    return [b];
  });
}

export function referenceArchitecture(b:Building,buildings:Building[],font:Font){
  const root=new THREE.Group(),windows:Pane[]=[],materials=new Map<string,THREE.MeshStandardMaterial>(),profile=architectureProfile(b),base=b.minH||0,[cx,cz]=center(b.p);
  root.name=`Reference architecture: ${b.name||b.id}`;
  const mat=(c:string)=>{if(!materials.has(c))materials.set(c,new THREE.MeshStandardMaterial({color:c,roughness:.87}));return materials.get(c)!;};
  const mesh=(g:THREE.BufferGeometry,c:string,x:number,y:number,z:number,parent:THREE.Object3D=root)=>{const m=new THREE.Mesh(g,mat(c));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;};
  const box=(w:number,h:number,d:number,x:number,y:number,z:number,c:string,parent:THREE.Object3D=root)=>mesh(new THREE.BoxGeometry(w,h,d),c,x,y,z,parent);
  const text=(s:string,size:number,x:number,y:number,z:number,parent:THREE.Object3D)=>{const g=new TextGeometry(s,{font,size,depth:.004,curveSegments:2});g.computeBoundingBox();g.translate(-g.boundingBox!.max.x/2,0,0);return mesh(g,'#526665',x,y,z,parent);};
  const cream='#dedbca',dark='#475f60',peers=buildings.filter(n=>n.id!==b.id&&n.p.some(p=>Math.hypot(p[0]-cx,p[1]-cz)<18));
  const clear=(x:number,y:number,z:number)=>!peers.some(n=>n.h>y+.005&&y>(n.minH||0)-.005&&insideBuilding(x,z,n.p));
  const raw=b.p.slice(0,-1),points=raw.filter((p,i)=>{const a=raw[(i+raw.length-1)%raw.length],q=raw[(i+1)%raw.length];return Math.abs((p[0]-a[0])*(q[1]-p[1])-(p[1]-a[1])*(q[0]-p[0]))>.006*Math.hypot(p[0]-a[0],p[1]-a[1])*Math.hypot(q[0]-p[0],q[1]-p[1]);});
  const faces=[];
  for(let e=0;e<points.length;e++){
    const a=points[e],q=points[(e+1)%points.length],len=Math.hypot(q[0]-a[0],q[1]-a[1]);if(len<.10)continue;
    let nx=(q[1]-a[1])/len,nz=-(q[0]-a[0])/len;const mx=(a[0]+q[0])/2,mz=(a[1]+q[1])/2;if(insideBuilding(mx+nx*.01,mz+nz*.01,b.p)){nx=-nx;nz=-nz;}
    const face=new THREE.Group();face.position.set(mx,0,mz);face.rotation.y=Math.atan2(nx,nz);root.add(face);face.updateWorldMatrix(true,false);
    const exposed=(x:number,y:number)=>[.03,.08].every(depth=>{const p=face.localToWorld(new THREE.Vector3(x,y,depth));return !insideBuilding(p.x,p.z,b.p)&&clear(p.x,y,p.z);});
    const pane=(x:number,y:number,w:number,h:number)=>{if(![-w/2,0,w/2].every(dx=>exposed(x+dx,y)))return;box(w+.014,h+.014,.023,x,y,.026,dark,face);const p=face.localToWorld(new THREE.Vector3(x,y,.044));windows.push({x:p.x,y:p.y,z:p.z,ry:face.rotation.y,w,h});};
    const band=(y:number,h:number,d:number,c:string)=>{const n=Math.ceil(len/.17);let start=-1;for(let i=0;i<=n;i++){const open=i<n&&exposed(-len/2+(i+.5)*len/n,y);if(open&&start<0)start=i;if(!open&&start>=0){box((i-start)*len/n,h,d,-len/2+(start+i)*len/n/2,y,.039,c,face);start=-1;}}};
    faces.push({face,len,nx,nz,pane,band,exposed});
    if(profile==='pier'||profile==='bulkhead')continue;
    if(profile==='steuart-brick'){
      // 121 Steuart: five visible upper window rows above a tall storefront,
      // with a deep, layered cornice. The mapped roof height is retained.
      const bays=Math.max(1,Math.round(len/.24)),spacing=len/bays,step=(b.h-.36)/5;
      for(let i=0;i<bays;i++)for(let f=0;f<5;f++){
        const x=-len/2+(i+.5)*spacing,y=.36+(f+.5)*step;
        pane(x,y,spacing*.70,step*.69);
        if(exposed(x,y))box(spacing*.76,.012,.055,x,y-step*.35,.065,'#bfb8a2',face);
      }
      for(let i=0;i<3;i++)pane(-len/2+(i+.5)*len/3,.15,len*.24,.23);
      band(.31,.022,.10,'#987359');band(.36,.022,.07,'#987359');
      band(b.h-.025,.045,.09,'#aa9175');band(b.h+.022,.035,.14,cream);band(b.h+.070,.035,.19,cream);
      continue;
    }
    if(profile==='commonwealth'){
      if(nz>.5){
        for(let i=0;i<6;i++)for(const [y,h] of [[.16,.24],[.47,.32],[.79,.24]])pane(-len/2+(i+.5)*len/6,y,len/6*.93,h);
        for(let i=0;i<=5;i++)box(.022,.31,.067,-len/2+i*len/5,.79,.06,cream,face);
        band(.63,.034,.09,cream);band(.94,.04,.10,cream);box(len*.80,.025,.14,0,.30,.09,cream,face);
        text('COMMONWEALTH',.053,0,.33,.17,face);
      }else if(nz<-.5){
        band(.30,.04,.07,cream);band(.59,.045,.11,cream);
        for(const y of [.16,.45])for(let i=0;i<3;i++)pane(-len/2+(i+.5)*len/3,y,len*.17,.19);
        for(let i=0;i<4;i++)pane(-len/2+(i+.5)*len/4,.79,len*.20,.22);
      }
      continue;
    }
    if(profile==='ferry-east'||profile==='ferry-entry'){
      const east=profile==='ferry-east';
      if(east){
        const bays=Math.max(1,Math.round(len/.15));
        for(let i=0;i<bays;i++)pane(-len/2+(i+.5)*len/bays,.55,len/bays*.91,.18);
        band(.415,.045,.15,cream);band(.64,.035,.14,'#9b8771');
        for(let x=-len/2+.028;x<len/2;x+=.057)if(exposed(x,.21))box(.025,.37,.044,x,.21,.05,'#555b4b',face);
      }else{
        const bays=Math.max(1,Math.round(len/.23));
        for(let i=0;i<bays;i++)pane(-len/2+(i+.5)*len/bays,.135,len/bays*.80,.20);
        band(.27,.055,.20,cream);
      }
      continue;
    }
    if(profile==='bayside'||profile==='observatory'){
      const floors=profile==='observatory'?2:base===0?4:1,step=(b.h-base)/floors,bays=Math.max(1,Math.round(len/(profile==='observatory'?.11:.22)));
      for(let f=0;f<floors;f++){
        const y=base+(f+.5)*step;
        for(let i=0;i<bays;i++)pane(-len/2+(i+.5)*len/bays,y,len/bays*.97,step*(profile==='observatory'?.88:.64));
        band(base+(f+1)*step,.045,.09,profile==='observatory'?'#90a3a2':'#c9b7a1');
      }
      if(profile==='bayside'){
        band(b.h+.033,.015,.11,'#d8d1bc');
        if(!b.parent||b.h>1.6)for(let x=-len/2+.14;x<len/2-.05;x+=.34)if(exposed(x,b.h-.06)){
          const ring=mesh(new THREE.TorusGeometry(.036,.009,4,10),'#d4c8ad',x,b.h-.055,.087,face);ring.rotation.z=.45;
        }
      }else {band(b.h+.024,.033,.14,'#b4c0b9');band(b.h-.068,.008,.065,'#90a3a2');}
      continue;
    }
    if(['broadcast','bryant','spear','waterfront','davis'].includes(profile||'')){
      const floors=profile==='broadcast'||profile==='bryant'?3:2,step=(b.h-.07)/floors;
      const bays=Math.max(1,Math.round(len/(profile==='broadcast'?.28:profile==='bryant'?.49:.37))),spacing=len/bays;
      for(let f=0;f<floors;f++){
        const y=.035+(f+.5)*step;
        for(let i=0;i<bays;i++){
          const x=-len/2+(i+.5)*spacing,w=spacing*(profile==='broadcast'?.98:.76);pane(x,y,w,step*.61);
          if(profile==='bryant'&&exposed(x,y))for(const dy of [-.07,0,.07])box(w,.012,.025,x,y+dy,.075,'#b5c2b7',face);
        }
        band(.035+(f+1)*step,profile==='broadcast'?.07:.038,.083,cream);
      }
      if(profile==='broadcast'){band(.08,.16,.052,'#a27a60');band(b.h+.019,.065,.11,cream);}
      if(profile==='spear'){
        band(b.h+.026,.052,.10,'#cbb783');
        for(let i=0;i<bays;i++){const x=-len/2+(i+.5)*spacing;if(exposed(x,.30)){box(spacing*.78,.018,.05,x,.30,.075,'#707d6b',face);box(.015,.31,.04,x,.28,.078,'#707d6b',face);}}
      }
      if(profile==='davis'){
        band(.035,.07,.065,'#885a48');band(b.h+.025,.045,.1,cream);
        for(let y=.09;y<b.h-.03;y+=.058)band(y,.005,.009,'#bc8a66');
        for(let i=0;i<bays;i++){const x=-len/2+(i+.5)*spacing;if(exposed(x,.16))box(.011,.18,.035,x,.16,.065,cream,face);}
      }
      if(profile==='waterfront'){
        band(.08,.045,.09,cream);band(b.h+.023,.06,.14,cream);
        for(let i=0;i<bays;i++){
          const x=-len/2+(i+.5)*spacing;
          if(exposed(x,b.h*.72)){const awning=box(spacing*.84,.024,.15,x,b.h*.87,.12,'#344d4c',face);awning.rotation.x=.25;}
        }
        if(len>.6&&nz<-.4){const awning=box(len+.06,.025,.29,0,b.h*.47,.13,'#3f5450',face);awning.rotation.x=.24;}
      }
      continue;
    }
    const centerTower=profile==='center',gateway=profile==='gateway',floors=profile==='harrison'?5:profile==='steuart'?20:gateway?(b.h>4.5?25:22):profile==='gap'?(base===0?6:Math.max(1,Math.round((b.h-base)/.29))):Math.max(1,Math.round((b.h-base)/(centerTower?.237:.269)));
    const step=(b.h-base-.06)/floors,bays=Math.max(1,Math.round(len/(centerTower?.16:gateway?.28:profile==='harrison'?.46:.32))),spacing=len/bays;
    for(let i=0;i<bays;i++){
      const x=-len/2+(i+.5)*spacing;
      for(let f=0;f<floors;f++){
        const y=base+.03+(f+.5)*step;pane(x,y,spacing*(centerTower?.78:.75),step*(gateway?.64:.79));
        if(gateway&&i%3===1&&exposed(x,y)){box(spacing*.88,.025,.10,x,y-step*.34,.080,cream,face);box(.012,step*.6,.07,x-spacing*.45,y,.071,cream,face);}
      }
      if(centerTower||profile==='steuart'||profile==='harrison'||profile==='gap'){
        for(let y=base+.14;y<b.h-.05;y+=.24)if(exposed(x-spacing/2,y))box(centerTower?.025:.033,Math.min(.24,b.h-y),centerTower?.055:.073,x-spacing/2,y,.047,cream,face);
      }
    }
    for(let f=1;f<floors;f++)band(base+.03+f*step,centerTower?.014:.026,profile==='harrison'?.12:.07,cream);
    band(b.h+.011,.033,.10,cream);
    if(profile==='steuart')for(let f=4;f<20;f+=4)band(.03+f*step,.037,.20,'#dfded0');
    if(profile==='harrison'){band(.42,.055,.14,cream);band(b.h+.055,.040,.17,cream);}
    if(profile==='gap'&&!b.parent&&nz>.3&&len>2){
      const w=Math.min(len*.34,1.25);box(w,1.72,.045,0,.96,.079,cream,face);
      for(const x of [-w*.28,w*.28])for(let y=.62;y<1.65;y+=.30){box(w*.28,.22,.023,x,y,.11,dark,face);}
      box(w*.45,.45,.04,0,.26,.113,dark,face);box(w+.12,.08,.12,0,1.87,.091,cream,face);
    }
  }
  if(profile==='ferry-east'||profile==='ferry-entry'){
    const p=b.p.slice(0,-1),east=profile==='ferry-east',peak=east?.96:.84;
    const upper=east?p.map(([x,z])=>[cx+(x-cx)*.65,cz+(z-cz)*.66]):p.map(()=>[-4.47,7.57]);
    const vertices:number[]=[];
    const triangle=(a:THREE.Vector3,q:THREE.Vector3,u:THREE.Vector3)=>{
      const normal=q.clone().sub(a).cross(u.clone().sub(a));
      if(normal.lengthSq()<1e-12)return;
      vertices.push(...a.toArray(),...(normal.y<0?u:q).toArray(),...(normal.y<0?q:u).toArray());
    };
    for(let i=0;i<p.length;i++){
      const j=(i+1)%p.length,a=new THREE.Vector3(p[i][0],b.h,p[i][1]),q=new THREE.Vector3(p[j][0],b.h,p[j][1]),u=new THREE.Vector3(upper[i][0],peak,upper[i][1]),v=new THREE.Vector3(upper[j][0],peak,upper[j][1]);
      triangle(a,u,q);triangle(q,u,v);
      const count=Math.max(1,Math.round(a.distanceTo(q)/.13));
      for(let k=0;k<=count;k++){
        const low=a.clone().lerp(q,k/count),high=u.clone().lerp(v,k/count),direction=high.clone().sub(low);
        const bar=mesh(new THREE.CylinderGeometry(.008,.008,direction.length(),4),'#9b9a87',(low.x+high.x)/2,(low.y+high.y)/2+.006,(low.z+high.z)/2);bar.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());
      }
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(vertices.length/3*2),2));geometry.computeVertexNormals();
    const roof=mesh(geometry,'#45535a',0,0,0);roof.name='Ferry Plaza glazed roof';
    if(east){
      const shape=new THREE.Shape(upper.map(([x,z])=>new THREE.Vector2(x,-z))),geo=new THREE.ShapeGeometry(shape);geo.rotateX(-Math.PI/2);mesh(geo,'#887f70',0,peak+.006,0);
      for(let i=0;i<4;i++)box(.05,.06,.06,cx-.16+i*.10,peak+.04,cz,'#d7d5c1');
    }
  }
  if(profile==='broadcast'){
    for(const dx of [-1,-.35,.35,1])if(insideBuilding(cx+dx,cz,b.p)){
      box(.035,.21,.035,cx+dx,b.h+.105,cz,'#82958c');
      const dish=mesh(new THREE.SphereGeometry(.11,10,6,0,Math.PI*2,0,Math.PI/2),'#c6c9ba',cx+dx,b.h+.23,cz);dish.rotation.x=.8;
    }
    for(const dx of [-1.2,-.9])if(insideBuilding(cx+dx,cz-.4,b.p))box(.012,.45,.012,cx+dx,b.h+.22,cz-.4,'#8a9c91');
  }
  if(profile==='pier'||profile==='bulkhead'){
    const pier=pierIds.get(b.id),bulkhead=profile==='bulkhead';
    // Every pier's street front faces inland; the long shed sides retain cargo bays.
    const front=faces.filter(f=>f.nz<-.45&&f.len>.8).sort((a,b)=>a.face.position.z-b.face.position.z)[0];
    for(const f of faces){const {len,face,pane,band}=f;if(len<.35)continue;
      band(b.h+.012,.035,.085,cream);
      const bays=Math.max(1,Math.round(len/(bulkhead?.46:.68))),step=len/bays;
      for(let i=0;i<bays;i++){const x=-len/2+(i+.5)*step;pane(x,b.h*.43,Math.min(step*.64,.42),b.h*.63);box(.030,b.h-.04,.057,x-step*.46,b.h/2,.032,'#c7c7b3',face);}
      if(!bulkhead&&f!==front&&len>3){
        for(let y=.15;y<b.h-.04;y+=.11)band(y,.008,.014,'#b9beae');
      }
    }
    const arch=(x:number,w:number,h:number,face:THREE.Group)=>{
      const shape=new THREE.Shape();shape.moveTo(-w/2,0);shape.lineTo(w/2,0);shape.lineTo(w/2,h-w/2);shape.absarc(0,h-w/2,w/2,0,Math.PI,false);shape.closePath();mesh(new THREE.ExtrudeGeometry(shape,{depth:.024,bevelEnabled:false}),dark,x,.05,.075,face);
      mesh(new THREE.TorusGeometry(w/2+.035,.035,5,18,Math.PI),cream,x,.05+h-w/2,.11,face);
      for(const side of [-1,1])box(.065,h-w/2,.10,x+side*(w/2+.034),.05+(h-w/2)/2,.10,cream,face);
      box(.020,h,.022,x,.05+h/2,.115,'#7e9186',face);box(w,.020,.026,x,h*.36,.115,'#7e9186',face);
    };
    if(front){const {face,len}=front;
      const mission=pier===26||pier===28,h=mission?Math.min(1.14,b.h):pier===24?.58:.90;
      if(bulkhead){
        for(const x of [-len*.3,len*.3]){box(1.05,.80,.24,x,.40,-.07,'#d1c9b2',face);arch(x,.46,.56,face);text(x<0?'PIER 3':'PIER 1 1/2',.082,x,.71,.12,face);}
      }else if(pier!==17&&pier!==24){
        const w=Math.min(len*.34,1.07);box(w+.28,h+.14,.22,0,(h+.14)/2,-.07,'#d0cbbb',face);
        arch(0,w*.76,h*.81,face);
        const pediment=new THREE.Shape(),half=(w+.38)/2;pediment.moveTo(-half,0);if(mission){pediment.lineTo(-half,.06);pediment.bezierCurveTo(-half*.55,.06,-half*.68,.21,-half*.28,.22);pediment.quadraticCurveTo(0,.43,half*.28,.22);pediment.bezierCurveTo(half*.68,.21,half*.55,.06,half,.06);}else pediment.lineTo(0,.21);pediment.lineTo(half,0);pediment.closePath();mesh(new THREE.ExtrudeGeometry(pediment,{depth:.14,bevelEnabled:false}),cream,0,h+.13,-.015,face);
        text(`PIER ${pier}`,.10,0,h+.038,.11,face);
        for(const side of [-1,1]){box(.09,h+.17,.13,side*(w+.23)/2,(h+.17)/2,.065,cream,face);box(.16,.06,.20,side*(w+.23)/2,h+.14,.075,cream,face);}
        if(mission)for(const x of [-len*.29,len*.29])arch(x,len*.18,h*.65,face);
        else for(const x of [-len*.33,len*.33])for(const y of [.26,.64]){box(.25,.22,.03,x,y,.065,dark,face);for(const dx of [-.07,0,.07])box(.01,.22,.02,x+dx,y,.091,cream,face);}
        box(.012,.70,.012,0,h+.65,0,cream,face);
      }else text(`PIER ${pier}`,.11,0,b.h-.13,.10,face);
    }
    if(!bulkhead&&pier!==24){
      // Roof monitor and solar rows follow the long shed, including angled southern piers.
      const longest=faces.reduce((a,b)=>a.len>b.len?a:b),axis=new THREE.Vector2(longest.nz,-longest.nx),projection=b.p.map(p=>p[0]*axis.x+p[1]*axis.y),lo=Math.min(...projection),hi=Math.max(...projection);
      const perp=new THREE.Vector2(-axis.y,axis.x),lateral=b.p.map(p=>p[0]*perp.x+p[1]*perp.y),mid=(Math.min(...lateral)+Math.max(...lateral))/2;
      for(let t=lo+.6;t<hi-.35;t+=.62){const x=axis.x*t+perp.x*mid,z=axis.y*t+perp.y*mid;if(!insideBuilding(x,z,b.p))continue;
        const monitor=box(.29,.14,.58,x,b.h+.055,z,'#b9c3b9');monitor.rotation.y=Math.atan2(axis.x,axis.y);const cap=box(.39,.025,.60,x,b.h+.138,z,'#899b97');cap.rotation.y=monitor.rotation.y;
        if(pier===15)for(const side of [-1,1]){const px=x+perp.x*.64*side,pz=z+perp.y*.64*side;if(!insideBuilding(px,pz,b.p))continue;const solar=box(.76,.025,.56,px,b.h+.04,pz,'#5a7680');solar.rotation.y=monitor.rotation.y;}
      }
    }
  }
  return {root,windows};
}
