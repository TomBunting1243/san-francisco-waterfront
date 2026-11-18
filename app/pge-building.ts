import * as THREE from 'three';
import {footprintGeometry} from './sf-map.ts';

type Building={id:number;p:number[][]};
type Window={x:number;y:number;z:number;ry:number;w:number;h:number};
type Point=[number,number,number];
const tower=260291405,serviceLink=260291408;
const street=.04,lobby=.48,roof=8.668,grille=7.835,hood=8.53;
const granite='#c9c4b8',shadow='#a6a397',spandrel='#beb9ad';
const smoke=['#505b60','#58636a','#4d585d','#606a6c'];
const paint=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.89});
const roofing=new THREE.MeshStandardMaterial({color:'#a6a599',roughness:.94});

// SF Planning, Matson Block (2025), existing site plan fig. 2 and table 1:
// https://files.ceqanet.lci.ca.gov/327649-1/attachment/gufVD2S8z-rQb9tOdzWOJei-LhSnAG_o4ocJW5LtAHXe7egtI1rhhYbvM43gbhVLgQ74mIaImoF37Czd0
// The 77 Beale tower is separate from the historic 245 Market offices and
// the 25 Beale annex. The second ID is the low Main-side service connection.
// SF Planning DPR for 260 Mission / 77 Beale: granite, notched corners,
// tripartite smoked windows, steel frame, Hertzka & Knowles, completed 1971.
// https://archives.sfplanning.org/CDG/docs/transit_center/Survey_A_and_B_forms.pdf
// Orthogonal elevations photographed by Minesweeper (2013) and A. Nelson (2021):
// https://commons.wikimedia.org/wiki/File:77_Beale_Street,_San_Francisco.jpg
// https://sfyimby.com/2021/05/number-33-the-peregrine-falcon-topped-77-beale-street-soma-san-francisco.html

class Front{
  vertices:number[]=[];colors:number[]=[];indices:number[]=[];
  pigments=new Map<string,THREE.Color>();
  quad(a:Point,b:Point,c:Point,d:Point,tint:string){
    let color=this.pigments.get(tint);
    if(!color)this.pigments.set(tint,color=new THREE.Color(tint));
    const i=this.vertices.length/3;
    for(const p of [a,b,c,d]){this.vertices.push(...p);this.colors.push(color.r,color.g,color.b);}
    this.indices.push(i,i+1,i+2,i,i+2,i+3);
  }
  finish(parent:THREE.Group){
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(this.vertices,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(this.colors,3));
    g.setIndex(this.indices);g.computeVertexNormals();g.userData.paintVertices=true;
    const m=new THREE.Mesh(g,paint);m.name='77 Beale facade';parent.add(m);
  }
}

function elevation(s:Front,a:number[],b:number[]){
  const dx=b[0]-a[0],dz=b[1]-a[1],width=Math.hypot(dx,dz),ux=dx/width,uz=dz/width;
  const p=(x:number,y:number,depth:number):Point=>[a[0]+ux*x-uz*depth,y,a[1]+uz*x+ux*depth];
  function rect(l:number,r:number,lo:number,hi:number,d:number,color:string){
    s.quad(p(l,lo,d),p(r,lo,d),p(r,hi,d),p(l,hi,d),color);
  }
  function reveals(l:number,r:number,lo:number,hi:number,back:number,front:number){
    s.quad(p(l,lo,front),p(l,lo,back),p(l,hi,back),p(l,hi,front),shadow);
    s.quad(p(r,lo,back),p(r,lo,front),p(r,hi,front),p(r,hi,back),shadow);
    s.quad(p(l,hi,back),p(l,hi,front),p(r,hi,front),p(r,hi,back),shadow);
  }
  return {p,width,rect,reveals,rotation:Math.atan2(-uz,ux)};
}

function office(s:Front,a:number[],b:number[],bays:number,side:number,windows:Window[]){
  const f=elevation(s,a,b),step=f.width/bays,levels=31,pitch=(grille-lobby)/levels;
  for(let bay=0;bay<bays;bay++){
    const l=(bay+.105)*step,r=(bay+.895)*step,w=r-l;
    if(!bay)f.rect(0,l,street,roof,0,granite);
    f.rect(r,Math.min(f.width,r+.21*step),street,roof,0,granite);
    // Deep lobby columns and recessed full-height plate glass.
    f.rect(l,r,street,lobby,-.066,'#475453');
    f.reveals(l,r,street,lobby,-.066,0);
    f.rect(l+w*.49,l+w*.51,street,lobby,-.063,'#80847c');
    f.rect(l,r,lobby-.055,lobby,0,granite);
    // An uninterrupted strip of glass behind the granite sills keeps the
    // three lights of a bay aligned through every floor.
    for(let light=0;light<3;light++){
      const x=l+w*light/3;
      f.rect(x,x+w/3,lobby,grille,-.014,smoke[(bay+light+side)%4]);
      if(light)f.rect(x-.002,x+.002,lobby,grille,-.012,'#747671');
    }
    f.reveals(l,r,lobby,grille,-.014,0);
    for(let row=0;row<levels;row++){
      const y=lobby+row*pitch,sill=y+pitch*.32,lintel=y+pitch*.89;
      f.rect(l,r,y,sill,-.004,spandrel);
      f.rect(l,r,lintel,y+pitch,-.004,granite);
      f.rect(l,r,sill-.007,sill,.001,shadow);
      if((bay+row+side)%4===0){
        const light=(bay+row)%3;
        const [x,py,z]=f.p(l+(light+.5)*w/3,(sill+lintel)/2,-.011);
        windows.push({x,y:py,z,ry:f.rotation,w:w*.31,h:(lintel-sill)*.9});
      }
    }
    // Monumental recessed slots and their vertical screen fins terminate each
    // run of punched windows under a square stone hood.
    f.rect(l,r,grille,hood,-.070,'#686d69');f.reveals(l,r,grille,hood,-.070,0);
    for(let fin=1;fin<7;fin++){
      const x=l+w*fin/7;
      f.rect(x-.0032,x+.0032,grille+.012,hood-.013,-.052,'#adb0a6');
    }
    f.rect(l,r,hood,roof,0,granite);
  }
}

function deck(part:THREE.Group,p:number[][],y:number,name:string){
  const m=new THREE.Mesh(footprintGeometry(p,.006),roofing);
  m.name=name;m.position.y=y-.006;part.add(m);
}

export function addPgeBuilding(b:Building,root:THREE.Group,windows:Window[]){
  if(b.id!==tower&&b.id!==serviceLink)return false;
  const part=new THREE.Group(),s=new Front(),p=b.p.slice(0,-1);root.add(part);
  if(b.id===serviceLink){
    part.name='77 Beale Main-side service connection';
    // The source way gives this three-story structure a contradictory height
    // of 151 m. The median LiDAR roof plane is 21.4 m (1.286 units).
    const y=1.286;
    const cross=p.reduce((sum,a,i)=>sum+a[0]*p[(i+1)%p.length][1]-p[(i+1)%p.length][0]*a[1],0);
    for(let i=0;i<p.length;i++){
      const j=(i+1)%p.length;
      const f=elevation(s,cross>0?p[j]:p[i],cross>0?p[i]:p[j]);
      f.rect(0,f.width,street,y,0,'#aba99d');
      for(const h of [.42,.84,y-.025])f.rect(0,f.width,h,h+.009,.002,shadow);
    }
    deck(part,p,y,'Main-side service roof');s.finish(part);return true;
  }
  part.name='77 Beale PG&E tower';
  // The Market-facing side is split at the service connection in the map.
  // Its ten-bay elevation continues uninterrupted above that low roof.
  const faces=[[2,4,10],[6,7,8],[9,10,10],[12,0,8]];
  for(const [i,j,n] of faces)office(s,p[j],p[i],n,i,windows);
  for(const i of [0,1,4,5,7,8,10,11]){
    const f=elevation(s,p[(i+1)%p.length],p[i]);
    f.rect(0,f.width,street,roof,0,granite);
    for(let y=lobby;y<roof;y+=(grille-lobby)/31)f.rect(0,f.width,y,y+.005,.001,shadow);
  }
  deck(part,p,roof,'77 Beale parapet roof');
  // Pickard Chilton's existing-condition plan locates the rectangular raised
  // plant enclosure near the center. USGS resolves 4.62 m relief over the roof.
  const dx=p[6][0]-p[7][0],dz=p[6][1]-p[7][1],d=Math.hypot(dx,dz),ux=dx/d,uz=dz/d;
  const penthouse=[[-.54,-.83],[.54,-.83],[.54,.83],[-.54,.83]].map(([u,v])=>[-13.13+ux*u-uz*v,-24.58+uz*u+ux*v]);
  for(let i=0;i<4;i++){
    const f=elevation(s,penthouse[(i+1)%4],penthouse[i]);
    f.rect(0,f.width,roof,roof+.277,0,'#9e9f95');
  }
  deck(part,penthouse,roof+.277,'77 Beale penthouse');
  s.finish(part);return true;
}
