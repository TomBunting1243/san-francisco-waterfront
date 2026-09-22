import * as THREE from 'three';
import {center} from './sf-map.ts';
import {insideBuilding} from './building-character.ts';

type Building={id:number;name:string;p:number[][];h:number;minH?:number;parent?:number};
type Pane={x:number;y:number;z:number;ry:number;w:number;h:number};
export const commonsIds=new Set([941869554,941869555,941869556]);
const gatewayIds=new Set([588363943,588365127]);
export const isCommons=(b:Building)=>commonsIds.has(b.parent||b.id);
export function hasNeighborhoodDetail(b:Building){return isCommons(b)||gatewayIds.has(b.parent||b.id);}
export function neighborhoodColor(b:Building){return isCommons(b)?'#9b6555':'#cecbb8';}

/** OSM has unmeasured placeholder heights here. Interpret the photographed two-storey
 * podium and upper townhouses; retain every surveyed footprint and stepped upper part. */
export function refineNeighborhoodMassing<T extends Building>(buildings:T[]):T[]{
  return buildings.map(b=>isCommons(b)?{...b,name:'Golden Gateway Commons',h:b.parent?1.04:.46,minH:b.parent?.46:0}:b);
}

/** Brick arcades, projecting dark-framed bays and open roof arches from Geering's photographs. */
export function neighborhoodDetail(buildings:Building[]){
  const root=new THREE.Group(),windows:Pane[]=[],materials=new Map<string,THREE.MeshStandardMaterial>();
  root.name='Golden Gateway Commons and Center';
  const material=(color:string)=>{if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.9}));return materials.get(color)!;};
  const mesh=(g:THREE.BufferGeometry,c:string,x:number,y:number,z:number,parent:THREE.Object3D=root)=>{const m=new THREE.Mesh(g,material(c));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;};
  const box=(w:number,h:number,d:number,x:number,y:number,z:number,c:string,parent:THREE.Object3D=root)=>mesh(new THREE.BoxGeometry(w,h,d),c,x,y,z,parent);
  const brick='#9b6555',cap='#88776a',metal='#3a4d4c';
  for(const b of buildings.filter(hasNeighborhoodDetail)){
    const base=b.minH||0,commons=isCommons(b),[cx,cz]=center(b.p);
    const peers=buildings.filter(n=>n.id!==b.id&&n.p.some(p=>Math.hypot(p[0]-cx,p[1]-cz)<12));
    const clear=(x:number,y:number,z:number)=>!peers.some(n=>y>=(n.minH||0)-.005&&y<n.h+.01&&insideBuilding(x,z,n.p));
    const raw=b.p.slice(0,b.p[0][0]===b.p.at(-1)![0]&&b.p[0][1]===b.p.at(-1)![1]?-1:undefined);
    const points=raw.filter((p,i)=>{const a=raw[(i+raw.length-1)%raw.length],q=raw[(i+1)%raw.length];const ux=p[0]-a[0],uz=p[1]-a[1],vx=q[0]-p[0],vz=q[1]-p[1];return Math.abs(ux*vz-uz*vx)>.003*Math.hypot(ux,uz)*Math.hypot(vx,vz);});
    const faces=[];
    for(let e=0;e<points.length;e++){
      const a=points[e],q=points[(e+1)%points.length],len=Math.hypot(q[0]-a[0],q[1]-a[1]);if(len<.16)continue;
      let nx=(q[1]-a[1])/len,nz=-(q[0]-a[0])/len;const mx=(a[0]+q[0])/2,mz=(a[1]+q[1])/2;
      if(insideBuilding(mx+nx*.012,mz+nz*.012,b.p)){nx=-nx;nz=-nz;}
      const face=new THREE.Group();face.position.set(mx,0,mz);face.rotation.y=Math.atan2(nx,nz);root.add(face);face.updateWorldMatrix(true,false);
      const exposed=(x:number,y:number)=>[.035,.065,.12].every(depth=>{const p=face.localToWorld(new THREE.Vector3(x,y,depth));return !insideBuilding(p.x,p.z,b.p)&&clear(p.x,y,p.z);});
      faces.push({face,len,nx,nz,exposed});
      const band=(y:number,h:number,d:number,c:string)=>{const count=Math.ceil(len/.17);let start=-1;for(let i=0;i<=count;i++){const open=i<count&&exposed(-len/2+(i+.5)*len/count,y);if(open&&start<0)start=i;if(!open&&start>=0){box((i-start)*len/count,h,d,-len/2+(start+i)*len/count/2,y,.037,c,face);start=-1;}}};
      band(b.h+.01,.025,.10,commons?cap:'#d7d5c3');
      if(b.h-base<.1)continue;
      const floors=commons?2:3,step=(b.h-base-.055)/floors,bays=Math.max(1,Math.round(len/(commons?.40:.37))),spacing=len/bays;
      for(let i=0;i<bays;i++){
        const x=-len/2+(i+.5)*spacing,w=Math.min(commons?.285:.25,spacing*.76);
        for(let floor=0;floor<floors;floor++){
          const y=base+.025+(floor+.5)*step,h=step*(commons?.72:.68);
          if(![-w/2,0,w/2].every(dx=>exposed(x+dx,y)))continue;
          box(w+.035,h+.035,.035,x,y,.043,metal,face);
          const p=face.localToWorld(new THREE.Vector3(x,y,.065));windows.push({x:p.x,y:p.y,z:p.z,ry:face.rotation.y,w,h});
          for(const dx of [-w*.24,w*.24])box(.012,h,.024,x+dx,y,.086,commons?metal:'#c3c5b6',face);
          if(commons){
            // Recessed podium arcade; upper bays have the photographed dark shallow canopies.
            if(base===0&&floor===1){const arc=mesh(new THREE.TorusGeometry(w*.50,.018,4,12,Math.PI),brick,x,y+h*.29,.077,face);arc.scale.y=.55;}
            if(base>0){const awning=box(w+.022,.025,.10,x,y-h/2-.022,.092,metal,face);awning.rotation.x=.19;}
          }else box(w+.035,.024,.10,x,y-h/2-.013,.069,'#d8d4c1',face);
        }
      }
      if(commons){
        for(let y=base+.06;y<b.h-.035;y+=.075)band(y,.006,.013,'#ac7964');
        if(base>0&&len>.65){
          // Brick chimney stacks with flat metal caps, not speculative roof decks.
          const x=-len/2+.12;if(exposed(x,b.h+.05)){box(.10,.19,.13,x,b.h+.087,-.032,brick,face);box(.12,.035,.15,x,b.h+.19,-.032,metal,face);}
        }
      }else for(let y=base+step;y<b.h-.03;y+=step)band(y,.026,.10,'#d6d2bd');
    }
    if(commons&&!b.parent){
      const toward=[27.98-cx,-15.78-cz];
      const frontage=faces.filter(f=>f.len>2&&f.nx*toward[0]+f.nz*toward[1]>0).sort((a,b)=>Math.hypot(a.face.position.x-27.98,a.face.position.z+15.78)-Math.hypot(b.face.position.x-27.98,b.face.position.z+15.78))[0];
      if(frontage){
        const {face,len}=frontage;
        // An actual open arch: the void stays transparent when the camera moves around it.
        const gate=(x:number,w:number,h:number)=>{
          const half=w/2,inset=w*.16,spring=h*.47,r=half-inset,shape=new THREE.Shape();
          shape.moveTo(-half,0);shape.lineTo(-half,h);shape.lineTo(half,h);shape.lineTo(half,0);shape.lineTo(r,0);shape.lineTo(r,spring);
          for(let j=0;j<=16;j++){const a=j*Math.PI/16;shape.lineTo(Math.cos(a)*r,spring+Math.sin(a)*h*.24);}
          shape.lineTo(-r,0);shape.closePath();mesh(new THREE.ExtrudeGeometry(shape,{depth:.075,bevelEnabled:false}),brick,x,b.h,.02,face);
        };
        gate(0,.80,.72);gate(-.69,.45,.46);gate(.69,.45,.46);
        // The plaza-facing stair connects the upper garden to Walton Square.
        for(let i=0;i<8;i++)box(.42,(i+1)*.052,.095,0,(i+1)*.026,.79-i*.09,brick,face);
        for(const side of [-1,1]){
          const rail=box(.014,.014,.81,side*.23,.39,.44,metal,face);rail.rotation.x=.48;
          for(let i=0;i<5;i++)box(.013,.19,.014,side*.23,.20+i*.072,.79-i*.17,metal,face);
        }
        if(len>3)for(const x of [-1.05,1.05])box(.10,.23,.14,x,b.h+.105,-.02,brick,face);
      }
    }
  }
  return {root,windows};
}
