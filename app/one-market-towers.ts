import * as THREE from 'three';
import {footprintGeometry} from './sf-map.ts';

type Building={id:number;p:number[][];h:number};
type Pane={x:number;y:number;z:number;ry:number;w:number;h:number};
type Point=number[];
const spear=132238423,steuart=132238431;
// Shared with the separately modeled six-story One Market Plaza podium.
const podiumTop=1.642;
const frame='#c5c8bd',returnPaint='#929e98',glass=['#4c6269','#586c70','#56676c','#65787b','#536770'];
const facadeMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.76});
const colorCache=new Map<string,THREE.Color>();

class Panels{
  pos:number[]=[];rgb:number[]=[];indices:number[]=[];
  quad(a:Point,b:Point,c:Point,d:Point,col:string){
    let pigment=colorCache.get(col);
    if(!pigment){pigment=new THREE.Color(col);colorCache.set(col,pigment);}
    const i=this.pos.length/3;
    for(const p of [a,b,c,d]){this.pos.push(...p);this.rgb.push(pigment.r,pigment.g,pigment.b);}
    this.indices.push(i,i+1,i+2,i,i+2,i+3);
  }
  finish(root:THREE.Group,name:string){
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(this.pos,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(this.rgb,3));g.setIndex(this.indices);g.computeVertexNormals();
    const mesh=new THREE.Mesh(g,facadeMaterial);mesh.name=name;root.add(mesh);
  }
}

function deck(root:THREE.Group,plan:Point[],lo:number,hi:number,color:string,name:string){
  const m=new THREE.Mesh(footprintGeometry(plan,hi-lo),new THREE.MeshStandardMaterial({color,roughness:.88}));
  m.position.y=lo;m.name=name;root.add(m);return m;
}

/** Existing owner floor plans use the same street axes: long facades overlook
 * Steuart/Spear; the ends face Market/Mission. Keep all four mapped corners. */
export function addOneMarketTower(b:Building,root:THREE.Group,windows:Pane[]){
  if(b.id!==spear&&b.id!==steuart)return false;
  const tall=b.id===spear,group=new THREE.Group();group.name=tall?'One Market Spear Tower':'One Market Steuart Tower';root.add(group);
  // Spear's fifth survey vertex is a nearly collinear survey break on a long wall.
  const p=tall?[b.p[0],b.p[1],b.p[3],b.p[4]]:b.p.slice(0,4);
  const corners=THREE.ShapeUtils.isClockWise(p.map(([x,z])=>new THREE.Vector2(x,z)))?p:[...p].reverse();
  const walls=new Panels(),frames=new Panels(),crown=new Panels();
  const roof=b.h-(tall?.132:.165),band=roof-.165;
  const levels=(tall?42:27)-6,pitch=(band-podiumTop)/levels;
  for(let side=0;side<4;side++){
    const a=corners[side],d=corners[(side+1)%4],dx=d[0]-a[0],dz=d[1]-a[1],len=Math.hypot(dx,dz);
    const nx=-dz/len,nz=dx/len;
    const at=(u:number,y:number,depth=0)=>[a[0]+dx*u+nx*depth,y,a[1]+dz*u+nz*depth];
    function rect(s:Panels,l:number,r:number,low:number,high:number,z:number,color:string){
      s.quad(at(l,low,z),at(r,low,z),at(r,high,z),at(l,high,z),color);
    }
    const bays=len>2.32?(tall?6:5):4;
    const pierWidth=.042,bayWidth=len/bays;
    const recess=-.024;
    for(let bay=0;bay<bays;bay++){
      const l=(bay+(.5*pierWidth/bayWidth))/bays,r=(bay+1-(.5*pierWidth/bayWidth))/bays;
      for(let row=0;row<levels;row++){
        const y=podiumTop+pitch*row,top=y+pitch,wash=(bay+row*7+side*2)%glass.length;
        rect(walls,l,r,y,top,recess,glass[wash]);
        // The broad lights each contain fine glazing bars, inside the white structural grid.
        for(let j=1;j<4;j++){
          const u=l+(r-l)*j/4;
          rect(walls,u-.001/len,u+.001/len,y,top,recess+.003,'#788481');
        }
        const sill=top-(row===levels-1?.026:.039);
        rect(frames,l,r,sill,top,0,frame);
        frames.quad(at(l,sill,recess),at(r,sill,recess),at(r,sill),at(l,sill),returnPaint);
        if((bay+row*3+side)%4===0&&row<levels-1){
          const pane=(row+side)%4,u=l+(r-l)*(pane+.5)/4;
          const [x,,z]=at(u,(y+sill)/2,recess+.005);
          windows.push({x,y:(y+sill)/2,z,ry:Math.atan2(nx,nz),w:(r-l)*len*.224,h:(sill-y)*.88});
        }
      }
    }
    for(let j=0;j<=bays;j++){
      const l=Math.max(0,j/bays-pierWidth/(2*len)),r=Math.min(1,j/bays+pierWidth/(2*len));
      rect(frames,l,r,podiumTop,band,0,frame);
      frames.quad(at(l,podiumTop,recess),at(l,podiumTop),at(l,band),at(l,band,recess),returnPaint);
      frames.quad(at(r,podiumTop),at(r,podiumTop,recess),at(r,band,recess),at(r,band),returnPaint);
    }
    rect(crown,0,1,band,roof,0,frame);
  }
  walls.finish(group,'Inset office glazing and fine mullions');
  frames.finish(group,'Projecting pale piers, slab bands and shaded returns');
  crown.finish(group,'Unbroken pale roof fascia');

  const center=p.reduce(([x,z],q)=>[x+q[0]/4,z+q[1]/4],[0,0]);
  // Positive u points toward Market Street, positive v toward the waterfront.
  const long=tall?[p[3],p[0]]:[p[1],p[0]],short=tall?[p[1],p[0]]:[p[3],p[0]];
  const ux=long[1][0]-long[0][0],uz=long[1][1]-long[0][1],vx=short[1][0]-short[0][0],vz=short[1][1]-short[0][1];
  const local=(u:number,v:number)=>[center[0]+ux*u+vx*v,center[1]+uz*u+vz*v];
  const rect=(u:number,v:number,w:number,d:number)=>[[u-w/2,v-d/2],[u+w/2,v-d/2],[u+w/2,v+d/2],[u-w/2,v+d/2]].map(([x,z])=>local(x,z));
  const surface=roof-.045;
  deck(group,b.p,surface-.012,surface,tall?'#a5a99b':'#818b87','Inset roof membrane');
  // Open parapet behind the facade fascia. An opaque roof at fascia level would erase the inset.
  for(const [u,v,w,d] of [[0,-.486,.975,.024],[0,.486,.975,.024],[-.486,0,.024,.95],[.486,0,.024,.95]]){
    deck(group,rect(u,v,w,d),surface,roof,'#c0c2b4','Perimeter parapet coping');
  }
  if(tall){
    // Aerial photograph: grouped housings in the middle and two parallel equipment runs at the Market end.
    deck(group,rect(-.048,-.025,.46,.46),surface,b.h-.025,'#a8ae9e','Central mechanical housing');
    deck(group,rect(-.086,-.065,.27,.29),b.h-.025,b.h,'#b8bbaa','Upper mechanical enclosure');
    for(const u of [.235,.346]){
      deck(group,rect(u,-.015,.073,.62),surface,surface+.067,'#a4a798','Parallel roof equipment bank');
      for(let j=0;j<5;j++)deck(group,rect(u,-.23+j*.107,.057,.073),surface+.067,surface+.074,'#888e81','Equipment grille');
    }
  }else{
    // Steuart's darker open roof surrounds a single long inset penthouse.
    deck(group,rect(0,0,.65,.49),surface,b.h-.008,'#b4b9ac','Single rectangular penthouse');
    deck(group,rect(0,0,.616,.447),b.h-.008,b.h,'#8a938a','Penthouse top');
    for(const v of [-.248,.248])for(const u of [-.14,.13]){
      deck(group,rect(u,v,.116,.009),surface+.024,b.h-.031,'#858f86','Penthouse air intake');
    }
  }
  return true;
}
