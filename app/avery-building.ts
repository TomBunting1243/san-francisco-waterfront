import * as THREE from 'three';

type Building={id:number;p:number[][];h:number;minH?:number};
type Window={x:number;y:number;z:number;ry:number;w:number;h:number};
type Point=[number,number];
type Vertex=[number,number,number];
const strips=8, floors=56;
const glass=['#80949f','#899da5','#8196a0','#90a1a7'];
const metal='#b2bcbb',returnGlass='#637b89',roof='#a4a49d';
const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.77});

// OMA's south upper crenellations mirror the north lower overhang above Avery Lane.
// Bruce Damonte's completion photographs show blue-grey unitized glazing and deep returns.
// https://www.archdaily.com/919113/the-avery-mixed-use-building-oma
// https://www.oma.com/projects/the-avery
// Depth and handedness of the upper terraces checked against the 2023 USGS 1.5 m DSM.
// Individual mullions and lower step depths are interpreted at this scale.
export function addAveryBuilding(b:Building,root:THREE.Group,windows:Window[]){
  if(b.id!==945194177)return false;
  const [a,eastCorner,mid,westCorner,south]=b.p;
  const base=b.minH??1.26, pitch=(b.h-.12)/floors;
  const positions:number[]=[],colors:number[]=[],indices:number[]=[];
  const tones=new Map<string,THREE.Color>();
  function quad(a:Vertex,b:Vertex,c:Vertex,d:Vertex,tone:string){
    let color=tones.get(tone);
    if(!color){color=new THREE.Color(tone);tones.set(tone,color);}
    const i=positions.length/3;
    for(const p of [a,b,c,d]){positions.push(...p);colors.push(color.r,color.g,color.b);}
    indices.push(i,i+1,i+2,i,i+2,i+3);
  }
  const mix=(p:number[],q:number[],t:number):Point=>[p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t];
  function plan(u:number,v:number):Point{
    const far=u<.53?mix(eastCorner,mid,u/.53):mix(mid,westCorner,(u-.53)/.47);
    return mix(mix(a,south,u),far,v);
  }
  const vertex=(p:Point,y:number):Vertex=>[p[0],y,p[1]];
  function slab(u0:number,u1:number,v0:number,v1:number,y:number,tone:string,up=true){
    if(Math.abs(u1-u0)<1e-7)return;
    const corners=[plan(u0,v0),plan(u1,v0),plan(u1,v1),plan(u0,v1)];
    if(!up)corners.reverse();
    quad(vertex(corners[0],y),vertex(corners[1],y),vertex(corners[2],y),vertex(corners[3],y),tone);
  }
  function wall(p:Point,q:Point,lo:number,hi:number,tone:string,offset=0){
    const dx=q[0]-p[0],dz=q[1]-p[1],len=Math.hypot(dx,dz);
    if(len<.00001)return;
    const shift=(r:Point,y:number):Vertex=>[r[0]-dz/len*offset,y,r[1]+dx/len*offset];
    quad(shift(p,lo),shift(q,lo),shift(q,hi),shift(p,hi),tone);
  }
  function curtain(p:Point,q:Point,lo:number,hi:number,panes:number,phase:number,row:number){
    for(let k=0;k<panes;k++){
      const left=mix(p,q,k/panes),right=mix(p,q,(k+1)/panes);
      wall(left,right,lo+.009,hi,glass[(phase+k)%glass.length]);
      wall(left,mix(left,right,.033),lo+.009,hi,metal,.001);
      if((row*3+k+phase)%9===0){
        const dx=right[0]-left[0],dz=right[1]-left[1],len=Math.hypot(dx,dz);
        windows.push({x:(left[0]+right[0])/2-dz/len*.003,z:(left[1]+right[1])/2+dx/len*.003,y:(lo+hi)/2,ry:Math.atan2(-dz,dx),w:len*.89,h:(hi-lo)*.83});
      }
    }
    wall(p,q,lo,lo+.009,metal);
  }
  // Four paired levels of retreat over the southern top 24 floors; the airborne
  // northern bays project progressively back over the lane up to the shared datum.
  function limits(row:number,j:number):Point{
    const lower=Math.max(0,Math.min(4,Math.ceil((32-row)/7)));
    const upper=Math.max(0,Math.min(4,Math.ceil((row-32)/6)));
    return [.038*Math.max(0,lower-Math.floor(j/2)),1-.054*Math.max(0,upper-Math.floor((8-j)/2))];
  }
  const first=Math.floor(base/pitch),top=pitch*floors;
  for(let row=first;row<floors;row++){
    const lo=Math.max(base,row*pitch),hi=(row+1)*pitch;
    for(let j=0;j<strips;j++){
      const v=j/strips,w=(j+1)/strips,[n,s]=limits(row,j);
      curtain(plan(n,w),plan(n,v),lo,hi,2,j+1,row);
      curtain(plan(s,v),plan(s,w),lo,hi,2,j+3,row);
      if(j===0)curtain(plan(n,v),plan(s,v),lo,hi,13,0,row);
      if(j===strips-1){
        curtain(plan(s,w),plan(.53,w),lo,hi,6,1,row);
        curtain(plan(.53,w),plan(n,w),lo,hi,7,3,row);
      }
      if(j>0){
        const [pn,ps]=limits(row,j-1);
        // The previous strip terminates and this one begins on opposite edges.
        wall(plan(n,v),plan(pn,v),lo,hi,returnGlass);
        wall(plan(ps,v),plan(s,v),lo,hi,returnGlass);
      }
      if(row>first){
        const [pn,ps]=limits(row-1,j);
        slab(n,pn,v,w,lo,'#9ba5a6',false);
        slab(s,ps,v,w,lo,roof);
      }
      if(row===first)slab(n,s,v,w,lo,returnGlass,false);
      if(row===floors-1)slab(n,s,v,w,top,roof);
    }
  }
  // OMA's axonometric shows an open parapet and a recessed rectangular plant enclosure.
  function screen(p:Point,q:Point){
    const dx=q[0]-p[0],dz=q[1]-p[1],len=Math.hypot(dx,dz);
    if(len<.00001)return;
    const inner=(r:Point):Point=>[r[0]+dz/len*.012,r[1]-dx/len*.012];
    wall(p,q,top,b.h,metal);wall(inner(q),inner(p),top,b.h,'#889294');
    quad(vertex(p,b.h),vertex(q,b.h),vertex(inner(q),b.h),vertex(inner(p),b.h),metal);
  }
  for(let j=0;j<strips;j++){
    const [n,s]=limits(floors-1,j),v=j/strips,w=(j+1)/strips;
    screen(plan(n,w),plan(n,v));screen(plan(s,v),plan(s,w));
    if(!j)screen(plan(n,v),plan(s,v));
    else {const [pn,ps]=limits(floors-1,j-1);screen(plan(n,v),plan(pn,v));screen(plan(ps,v),plan(s,v));}
    if(j===strips-1){screen(plan(s,w),plan(.53,w));screen(plan(.53,w),plan(n,w));}
  }
  const housing=[plan(.35,.36),plan(.60,.36),plan(.60,.61),plan(.35,.61)];
  for(let i=0;i<4;i++)wall(housing[i],housing[(i+1)%4],top,top+.085,'#8e999a');
  slab(.35,.6,.36,.61,top+.085,'#b3b3aa');
  const g=new THREE.BufferGeometry();g.setIndex(indices);
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  g.computeVertexNormals();g.userData.paintVertices=true;
  const mesh=new THREE.Mesh(g,material);mesh.name='The Avery · OMA folded residential curtain wall';
  root.add(mesh);return true;
}
