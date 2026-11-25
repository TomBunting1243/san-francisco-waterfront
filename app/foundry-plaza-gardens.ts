import {Color} from 'three';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';
import {foundryCrowns} from './foundry-plaza-crowns.ts';

type UV=[number,number];
type Rect=[number,number,number,number];
type Point=(uv:UV,metres:number)=>FacadePoint;
const pavingHeight=.02;
const stone=['#9a9a91','#96988f','#92958d','#999b93','#95988f'];
const leaves=['#668447','#87a456','#74994c','#79994f','#96ac61','#6b8b49'].map(tint=>new Color(tint));
const shadedLeaves=['#516c41','#5e7950','#687f45','#516f42'].map(tint=>new Color(tint));
function noise(seed:number){
  const value=Math.sin(seed*127.1+41.7)*43758.5453;
  return value-Math.floor(value);
}

// A leafy branch tip has an offset crest and several uneven lobes. The narrow
// underside is drawn per tip, so neighboring branches can leave sky between them.
function spray(f:FacadePanels,p:Point,u:number,v:number,crest:number,
  radius:number,depth:number,seed:number){
  const yaw=noise(seed)*Math.PI*2,sides=5,start=f.positions.length/3;
  const tint=Math.floor(noise(seed+24)*leaves.length);
  function vertex(point:FacadePoint,color:Color){
    f.positions.push(...point);f.colors.push(color.r,color.g,color.b);
  }
  vertex(p([u,v],crest),leaves[tint]);
  depth=Math.min(depth,crest-3.10);
  vertex(p([u+1.5*Math.cos(yaw),v+1.5*Math.sin(yaw)],crest-depth),shadedLeaves[tint%shadedLeaves.length]);
  for(let k=0;k<sides;k++){
    const angle=yaw+k*2*Math.PI/sides;
    const reach=7*radius*(.76+.24*noise(seed+k+3));
    const color=k%3===0?shadedLeaves[(tint+k)%shadedLeaves.length]:leaves[(tint+k)%leaves.length];
    vertex(p([u+Math.cos(angle)*reach,v+Math.sin(angle)*reach],
      crest-depth*(.34+.24*noise(seed+2*k+18))),color);
  }
  for(let k=0;k<sides;k++){
    const a=start+2+k,b=start+2+(k+1)%sides;
    f.indices.push(start,b,a,start+1,a,b);
  }
}

function slab(f:FacadePanels,p:Point,[u,v,r,b]:Rect,h:number,tint:string){
  f.quad(p([u,v],h),p([u,b],h),p([r,b],h),p([r,v],h),tint);
}

function splitAround(rect:Rect,well:Rect):Rect[]{
  const [u,v,r,b]=rect,x=Math.max(u,well[0]),y=Math.max(v,well[1]);
  const right=Math.min(r,well[2]),bottom=Math.min(b,well[3]);
  if(x>=right||y>=bottom)return [rect];
  const pieces:Rect[]=[[u,v,r,y],[u,bottom,r,b],[u,y,x,bottom],[right,y,r,bottom]];
  return pieces.filter(([a,c,d,e])=>a<d&&c<e);
}

function pave(f:FacadePanels,p:Point,south:boolean,stems:UV[]){
  const [left,top,right,bottom]:Rect=south?[-553,311,-394,466]:[-553,31,-394,133];
  const wells:Rect[]=stems.map(([u,v])=>[u-2.4,v-2.4,u+2.4,v+2.4]);
  // Flush paving cut around each trunk. Face colors suggest separate stone units
  // without extra grout overlays competing with the walkable surface.
  for(let y=top,row=0;y<bottom;y+=7,row++){
    const shift=row%2*7;
    for(let x=left-shift,col=0;x<right;x+=17,col++){
      let pieces:Rect[]=[[Math.max(left,x),y,Math.min(right,x+17),Math.min(y+7,bottom)]];
      for(const well of wells){
        if(well[0]>=x+17||well[2]<=x||well[1]>=y+7||well[3]<=y)continue;
        pieces=pieces.flatMap(rect=>splitAround(rect,well));
      }
      for(const piece of pieces)slab(f,p,piece,pavingHeight,stone[(row*7+col*3+col*row)%stone.length]);
    }
  }
  for(const well of wells)slab(f,p,well,.008,'#6d6756');
}

function graniteSeat(f:FacadePanels,p:Point,rect:Rect,top:number){
  const [u,v,r,b]=rect,ring:UV[]=[[u,v],[r,v],[r,b],[u,b]];
  slab(f,p,rect,top,'#98998f');
  for(let i=0;i<4;i++){
    const a=ring[i],c=ring[(i+1)%4];
    f.quad(p(a,top),p(c,top),p(c,pavingHeight),p(a,pavingHeight),'#70746f');
  }
}

function limb(f:FacadePanels,p:Point,from:UV,to:UV,lo:number,hi:number,r0:number,r1:number){
  const sides=6;
  function ring(end:UV,r:number,i:number):UV{
    const a=i*2*Math.PI/sides;
    return [end[0]+r*Math.cos(a)*7,end[1]+r*Math.sin(a)*7];
  }
  for(let i=0;i<sides;i++){
    const a=p(ring(from,r0,i),lo),b=p(ring(to,r1,i),hi);
    f.quad(a,b,p(ring(to,r1,i+1),hi),p(ring(from,r0,i+1),lo),i%3===0?'#655e4d':'#766e59');
  }
}

// Add directly to the existing opaque building batch. This uses no textures,
// lights or separate scene objects. The measured support is shared across each
// grove; its vertices came from neighboring 2023 USGS lidar cells.
export function addFoundryPlazaGardens(f:FacadePanels,south:boolean,p:Point){
  const stems:UV[]=[];
  const xs=south?[-540,-518,-495]:[-540,-519,-497],ys=south?[328,349,370]:[76,99,119];
  for(const u of xs)for(const v of ys)if(u!==xs[1]||v!==ys[1])stems.push([u,v]);
  pave(f,p,south,stems);
  graniteSeat(f,p,south?[-551.75,319,-548.25,374]:[-551.75,66,-548.25,119],south?.41:.40);
  graniteSeat(f,p,south?[-545,314.25,-490,317.75]:[-540,127.25,-490,130.75],south?.42:.46);

  const {vertices,triangles}=foundryCrowns[south?'405':'400'];
  const count=vertices.length/4;
  // Shared neighbors direct the lower sprays back toward the interior along
  // the measured rim. Each top stays at its registered lidar anchor.
  const neighbors=Array.from({length:count},()=>new Set<number>());
  for(let i=0;i<triangles.length;i+=3){
    const a=triangles[i],b=triangles[i+1],c=triangles[i+2];
    neighbors[a].add(b).add(c);neighbors[b].add(c).add(a);neighbors[c].add(a).add(b);
  }
  for(let i=0;i<count;i++){
    const u=vertices[4*i],v=vertices[4*i+1],high=vertices[4*i+2]/10,low=vertices[4*i+3]/10;
    let du=0,dv=0;
    for(const j of neighbors[i]){
      du+=vertices[4*j]-u;dv+=vertices[4*j+1]-v;
    }
    du/=neighbors[i].size;dv/=neighbors[i].size;
    const seed=i*29+(south?9:13),angle=noise(seed+3)*Math.PI*2;
    const x=Math.cos(angle),y=Math.sin(angle);
    const radius=.90+.33*noise(seed+4);
    spray(f,p,u,v,high,radius,1.05+.45*noise(seed+5),seed);
    // The overlapping smaller outer tip breaks up the long straight silhouette
    // without extending far beyond the 0.70 m cell and its measured neighbors.
    if(i%3!==1)spray(f,p,u+3.8*x,v+3.8*y,high-.33-.25*noise(seed+6),
      radius*.68,.78+.30*noise(seed+7),seed+8);
    const layers=Math.max(1,Math.ceil((high-low)/1.65));
    for(let j=1;j<=layers;j++){
      const t=j/layers,depth=Math.min(1.45,Math.max(.65,(high-low)*.65));
      const offset=4.1*Math.sin(i*1.7+j*2.4);
      const centerU=u+du*(.25+1.18*t)+x*offset,centerV=v+dv*(.25+1.18*t)+y*offset;
      const crest=high-(high-low)*t+depth*.68;
      spray(f,p,centerU,centerV,crest,radius*(1-.34*t),depth,seed+11+j);
    }
  }
  // The laser recorded foliage directly above each unplanted middle station.
  const center=south?[-519.412,351.947,9.62]:[-519.216,99.138,7.60];
  spray(f,p,center[0],center[1],center[2],1.14,1.14,102);
  for(const [i,stem] of stems.entries()){
    const fork:UV=[stem[0]+Math.cos(i*2)*.65,stem[1]+Math.sin(i*1.4)*.8];
    limb(f,p,stem,stem,.008,.45,.22,.15);
    limb(f,p,stem,fork,.45,2.65,.15,.12);
    for(let arm=0;arm<3;arm++){
      const angle=i*1.42+arm*(2*Math.PI/3);
      const u=stem[0]+Math.cos(angle)*8,v=stem[1]+Math.sin(angle)*8;
      let near=0,best=Infinity;
      for(let j=0;j<vertices.length;j+=4){
        const d=(vertices[j]-u)**2+(vertices[j+1]-v)**2;
        if(d<best){best=d;near=j;}
      }
      limb(f,p,fork,[vertices[near],vertices[near+1]],2.65,vertices[near+3]/10+.12,.095,.032);
    }
  }
}
