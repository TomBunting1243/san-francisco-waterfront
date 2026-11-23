import * as THREE from 'three';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';

export const howardPodiumId=1309156966;
export const howardGlassName='301 Howard storefront glass';
export function howardGlass(panes:FacadePanels){
  const material=new THREE.MeshStandardMaterial({color:'#96ada8',roughness:.28,transparent:true,opacity:.16,
    side:THREE.DoubleSide,depthWrite:false});
  material.forceSinglePass=true;
  const mesh=panes.mesh(material);mesh.name=howardGlassName;mesh.castShadow=false;return mesh;
}
// Ground footprint of the 1987 tower, in waterfront scene coordinates. The
// centered Howard lobby and separate corner retail follow Huntsman's as-built
// project and the 2021 Beale/Howard photograph. Lease widths and reveal depths
// are interpreted. Keep the existing 3.5 m podium/tower joint as the lintel.
// https://www.huntsmanag.com/portfolio/301-howard-street/4
// https://commons.wikimedia.org/wiki/File:301_Howard_Street.jpg
const howardCorner=[-28.700,-26.706],bealeCorner=[-28.960,-26.268];
export const howardOpenings=[
  {name:'Howard lobby and windows',edge:[howardCorner,[-28.991,-28.561]],center:.47,width:1.70,head:.204},
  {name:'Corner café entrance',edge:[bealeCorner,howardCorner],center:.50,width:.455,head:.204},
  {name:'Beale café windows',edge:[bealeCorner,[-30.817,-25.974]],center:.22,width:.755,head:.204},
] as const satisfies ReadonlyArray<{name:string;edge:number[][];center:number;width:number;head:number}>;

const grade=.045,metal='#35464a',basalt='#535b55',silver='#93a39b';
type Frame={nx:number;nz:number;len:number;tx:number;tz:number};

// One opaque panel batch per face. Clear panes in the framed portals look
// into furnished rooms; the few painted reflections leave those sightlines open.
export function howardInterior(r:typeof howardOpenings[number],{nx,nz,len,tx,tz}:Frame,panes:FacadePanels){
  const f=new FacadePanels(),energy:number[]=[],[a]=r.edge,mid=r.center*len,w=r.width/2;
  const at=(x:number,h:number,d:number):FacadePoint=>[a[0]+(mid+x)*tx+d*nx,h,a[1]+(mid+x)*tz+d*nz];
  type Light=readonly [number,number,number];
  const dark:Light=[0,0,0],lit:Light=[40,32,20],lamp:Light=[121,89,40];
  function quad(p:FacadePoint,q:FacadePoint,s:FacadePoint,t:FacadePoint,color:string,light:Light=dark,both=false){
    if(tz*nx-tx*nz>0)f.quad(p,q,s,t,color);else f.quad(t,s,q,p,color);
    for(let i=0;i<4;i++)energy.push(...light);
    if(both)quad(t,s,q,p,color,light);
  }
  function panel(l:number,b:number,y:number,h:number,d:number,color:string,light:Light=dark){
    quad(at(l,y,d),at(l,h,d),at(b,h,d),at(b,y,d),color,light);
  }
  function jamb(x:number,lo:number,hi:number,front:number,back:number,color:string){
    quad(at(x,lo,front),at(x,hi,front),at(x,hi,back),at(x,lo,back),color,dark,true);
  }
  function slab(l:number,b:number,h:number,front:number,back:number,color:string,light:Light=dark){
    quad(at(l,h,front),at(b,h,front),at(b,h,back),at(l,h,back),color,light,true);
  }
  function room(l:number,b:number,use:'lobby'|'cafe'|'display',doorway=false){
    const lobby=use==='lobby';
    const front=lobby?-.054:-.028,back=lobby?-.139:-.096;
    jamb(l,grade,r.head,0,back,basalt);jamb(b,grade,r.head,0,back,basalt);
    slab(l,b,grade+.001,0,back,lobby?'#aaa69a':'#aaa38d',[9,7,4]);
    slab(l,b,r.head,0,back,'#7e8277',[12,9,6]);
    panel(l,b,grade,r.head,back,lobby?'#d1cdc0':use==='cafe'?'#b5a487':'#87918b',lobby?lit:use==='cafe'?[47,36,22]:[12,13,12]);
    if(lobby){
      // The architect's photograph shows pale scalloped plaster, a warm metal
      // recess and a sculpted timber seat behind the entrance glazing.
      const center=(l+b)/2;
      for(let i=0;i<4;i++){
        const left=l+i*(b-l)/4,right=l+(i+1)*(b-l)/4;
        panel(left,right-.005,grade+.026,r.head-.008,back+.003+i*.0008,['#c5c5b9','#d1d0c6','#d9d8cd','#cccbc0'][i],lit);
      }
      panel(l+.016,l+.079,grade+.024,r.head-.016,back+.012,'#987c5e',[34,24,12]);
      // Sculpted timber seat curves up at both ends behind the door.
      for(let i=0;i<6;i++){
        const left=center+.020+i*.023,right=left+.023;
        const edge=(j:number)=>grade+.028+.012*((j-3)/3)**2;
        quad(at(left,grade+.010,back+.046),at(left,edge(i),back+.046),at(right,edge(i+1),back+.046),at(right,grade+.010,back+.046),'#967a5d',[17,11,6]);
        quad(at(left,edge(i),back+.046),at(left,edge(i),back+.020),at(right,edge(i+1),back+.020),at(right,edge(i+1),back+.046),'#b59a75',[22,16,9],true);
      }
    }else if(use==='cafe'){
      // Unbranded interior seen at pavement level: a timber service counter,
      // pale worktop, coffee machine and pendant shades.
      const barLeft=l+.022,barRight=b-.035;
      panel(barLeft,barRight,grade+.002,grade+.053,back+.027,'#967552',[21,13,6]);
      slab(barLeft-.002,barRight+.002,grade+.054,back+.032,back+.004,'#d3c7af',[26,21,14]);
      const machine=barLeft+.030;
      panel(machine,machine+.052,grade+.055,grade+.077,back+.018,'#646d69',[10,10,8]);
      panel(machine+.006,machine+.045,grade+.069,grade+.072,back+.019,'#bcc3b8',[23,22,18]);
      for(const part of [.24,.73]){
        const x=l+(b-l)*part;
        panel(x-.001,x+.001,.151,r.head,back+.012,metal);
        quad(at(x-.014,.146,back+.012),at(x-.005,.154,back+.012),at(x+.005,.154,back+.012),at(x+.014,.146,back+.012),'#ab9372',[18,12,7]);
        panel(x-.014,x+.014,.144,.146,back+.013,'#efd5a1',lamp);
      }
    }
    const door=(l+b)/2,dw=lobby?.113:.067,shoulder=.168;
    const windows=doorway?[[l,door-dw/2],[door+dw/2,b]]:[[l,b]];
    function glass(l:number,b:number,lo:number,hi:number,d:number){
      if(tz*nx-tx*nz>0)panes.quad(at(l,lo,d),at(l,hi,d),at(b,hi,d),at(b,lo,d),'#ffffff');
      else panes.quad(at(b,lo,d),at(b,hi,d),at(l,hi,d),at(l,lo,d),'#ffffff');
    }
    for(const [left,right] of windows){
      glass(left,right,grade+.019,r.head,front-.001);
      const divisions=Math.max(1,Math.round((right-left)/.095));
      for(let i=0;i<divisions;i++){
        const x=left+(right-left)*i/divisions;
        panel(x,x+.004,grade,r.head,front,metal);
        panel(x+.004,left+(right-left)*(i+1)/divisions,grade+.006,grade+.019,front-.003,'#708381',[7,9,8]);
      }
    }
    panel(l,b,shoulder,shoulder+.004,front,metal);
    panel(l,b,r.head-.007,r.head,-.002,basalt);
    if(!doorway)return;
    glass(door-dw/2,door+dw/2,shoulder,r.head,front-.001);
    for(const x of [door-dw/2,door+dw/2])panel(x-.002,x+.002,grade,shoulder,front,metal);
    // A pair of set-back door leaves occupies the portal between the tall lites.
    const leaf=front-.029;
    glass(door-dw/2,door+dw/2,grade+.010,shoulder,leaf-.001);
    for(const x of lobby?[door-dw/2,door,door+dw/2]:[door-dw/2,door+dw/2]){
      panel(x-.0018,x+.0018,grade,shoulder,leaf,metal);
    }
    panel(door-dw/2,door+dw/2,grade,grade+.010,leaf,'#718480');
    panel(door+.010,door+.013,grade+.045,grade+.085,leaf+.0015,silver,[7,8,6]);
  }
  if(r===howardOpenings[0]){
    // Full Howard frontage includes the short additional collinear edge to
    // Fremont. The mid-block lobby axis is 1.07 units from the chamfer.
    const center=1.068-mid;
    room(-w,center-.234,'cafe');
    panel(center-.234,center-.205,grade,r.head,0,basalt);
    room(center-.205,center+.205,'lobby',true);
    panel(center+.205,center+.234,grade,r.head,0,basalt);
    room(center+.234,w,'display');
  }else{
    room(-w,w,'cafe',r===howardOpenings[1]);
    if(r===howardOpenings[1]){
      // Generic café fascia, with four block letters cut into the dark band.
      const glyphs=['111100100100111','010101111101101','111100110100100','111100110100111'];
      const pitch=.0046,left=-.038;
      panel(-.054,.054,.173,.203,-.003,metal);
      glyphs.forEach((glyph,i)=>{for(let n=0;n<glyph.length;n++)if(glyph[n]==='1'){
        const x=left+(i*4+n%3)*pitch,h=.196-Math.floor(n/3)*pitch;
        panel(x,x+pitch,h-pitch,h,-.002,'#dfcca2',lamp);
      }});
    }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(f.positions,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(f.colors,3));
  g.setAttribute('signLight',new THREE.Uint8BufferAttribute(energy,3,true));
  g.setIndex(f.indices);g.computeVertexNormals();g.userData.paintVertices=true;return g;
}
