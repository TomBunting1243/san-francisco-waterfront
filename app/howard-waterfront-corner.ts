import {BufferGeometry,Color,Float32BufferAttribute,ShapeUtils,Vector2} from 'three';
import type {Mesh,Vector3} from 'three';
import curbs from '../public/data/curb-survey.json' with {type:'json'};

type Point=[number,number];
type Triangle=(a:number[],b:number[],c:number[],color:string)=>void;
type Surface=(geometry:BufferGeometry,color:string,x:number,y:number,z:number)=>Mesh;

const plateU=(p:number[])=>(p[0]+56)*132;

// SF 2024 RGB 8 cm, plate x=-56+u/132, z=2-v/132. The June 2020 agency
// photograph resolves the warning panel and red curb. The later aerial
// supplies their extents and the post-quick-build turn box.
// https://www.sfmta.com/files/gallery-images/2020/06/img_1069.jpg
// https://www.sfmta.com/project-updates/project-update-august-2020
export function howardWaterfrontCurb(source:number,strip:number,a:number[],b:number[],c:number[],d:number[],triangle:Triangle){
  if(strip!==2&&(source!==3803776||strip!==3))return false;
  if(plateU(b)<plateU(a)){[a,b]=[b,a];[c,d]=[d,c];}
  const start=plateU(a),end=plateU(b);
  if(end<4301||start>4351||end<=start)return false;
  const lerp=(p:number[],q:number[],t:number)=>p.map((n,i)=>n+(q[i]-n)*t);
  const point=(u:number,t:number)=>{
    const along=(u-start)/(end-start);
    return lerp(lerp(a,b,along),lerp(d,c,along),t);
  };
  // Split the receiving surface itself. This keeps the warning panel flush
  // with the inclined apron, and the red curb finish on the original lip.
  const stops=[start,...[4301,4324.2,4334.5,4351].filter(u=>u>start&&u<end),end];
  for(let i=1;i<stops.length;i++){
    const lo=stops[i-1],hi=stops[i],mid=(lo+hi)/2;
    const warning=mid>4324.2&&mid<4334.5&&strip===3;
    const bands=warning?[0,.32,1]:[0,1];
    for(let j=1;j<bands.length;j++){
      const s=bands[j-1],t=bands[j];
      const color=strip===2?((mid<4324.2||mid>4334.5)&&mid>=4301&&mid<=4351?'#ac6864':'#d1cbb9')
        :warning&&j===1?'#d3b468':'#c9c5b3';
      const p=point(lo,s),q=point(hi,s),r=point(hi,t),v=point(lo,t);
      triangle(p,q,r,color);triangle(p,r,v,color);
    }
  }
  return true;
}

export function addHowardWaterfrontPaint(mesh:Surface){
  const position:number[]=[],colors:number[]=[];
  const pale=new Color('#dedbc7'),green=new Color('#859877'),worn=new Color('#bec1a5');
  // Longitudinal and transverse positions on the photographed buffer in
  // pixels. Its two ends are skewed, exactly as the crossing corners are.
  const pixel=([s,t]:Point):Point=>[
    4169.8+s-1.65*t/15-.011*s*t/15,
    375.9+.014*s+t,
  ];
  function face(outer:Point[],ink:Color,holes:Point[][]=[],project=pixel){
    const rings=[outer,...holes].map(r=>r.map(p=>new Vector2(...project(p))));
    const points=rings.flat();
    for(const ids of ShapeUtils.triangulateShape(rings[0],rings.slice(1))){
      const [a,b,c]=ids.map(i=>points[i]);
      const positive=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)>0;
      for(const p of positive?[a,b,c]:[a,c,b]){
        position.push(-56+p.x/132,.03124,2-p.y/132);
        colors.push(ink.r,ink.g,ink.b);
      }
    }
  }
  const rect=(l:number,t:number,r:number,b:number):Point[]=>[[l,t],[r,t],[r,b],[l,b]];
  // Both pedestrian ladders and the track-side limit bars already have
  // independent surveyed geometry. End this outline inside the clear gap.
  const right=127.0,split=79.2,bottom=15.1,line=1.1;
  face(rect(0,0,right,line),pale);face(rect(0,bottom-line,right,bottom),pale);
  for(const x of [0,split,right-line])face(rect(x,line,x+line,bottom-line),pale);
  for(const x of [8.3,56.7])face([[x,line],[x+1.3,line],[x+12.8,bottom-line],[x+11.5,bottom-line]],pale);
  for(const [l,r] of [[2.4,7.8],[12.8,17],[25,30.8],[36.1,41.7],[47.4,53.4],[58.9,64.5],[70.8,76.4]]){
    face(rect(l,11.45,r,12.40),pale);
  }
  // Two pale turn arrows survive at this resolution. The worn central
  // marking is too indistinct to assign a symbol; leave that area green.
  const arrow:Point[]=[[84.0,2.8],[86.8,3.0],[89.6,4.1],[91.4,6.5],[91.9,8.0],[94.3,7.8],
    [91.4,11.2],[88.1,8.4],[90,8.2],[89.3,6.1],[87.4,4.8],[84,4.5]];
  const reverse=arrow.map(([x,y]):Point=>[206.6-x,y]);
  face(rect(split+line,line,right-line,bottom-line),green,[arrow,reverse]);
  face(arrow,worn);face(reverse,worn);
  // A separate yield tooth at the southern end of the painted buffer.
  face([[-6.8,.3],[-2.0,.4],[-4.9,6.1]],pale);
  // Beyond the north ladder the 2024 photograph shows two opposing arrows,
  // two cycle stencils and one southbound stop stripe. Its length is taken
  // from the marking itself; the asphalt continues without a green overlay.
  const arrowMark:Point[]=[[-5,-.6],[.6,-.6],[.6,-2.1],[5.2,0],[.6,2.1],[.6,.6],[-5,.6]];
  const bike:Point[]=[[-7,-3.5],[-6,-5],[-3.7,-5.2],[-1.8,-4.6],[-1.4,-2],[-2.3,-.9],
    [.2,-.3],[1,-1.2],[2,-1.1],[2.3,.1],[4.2,.1],[5,-.5],[6.4,-.3],[6.4,1],[3.8,1.6],
    [.7,1.5],[-1,1.2],[-2.1,1.4],[-1.7,3.3],[-2.6,4.9],[-4.6,5.2],[-6.7,4.6],[-7.3,2.9],
    [-6.6,1.2],[-5.4,.65],[-4.6,.3],[-4.1,-.9],[-5.5,-.9],[-6.8,-2.2]];
  const wheel=(y:number):Point[]=>[[-5.8,y],[-5.1,y-1.15],[-3.7,y-1.05],[-3,y],[-3.9,y+.95],[-5.3,y+.95]];
  const local=(u:number,v:number,sign:number)=>([x,y]:Point):Point=>[u+sign*(x-.11*y),v+sign*(y+.11*x)];
  face(arrowMark,pale,[],local(4447.2,374.4,1));face(arrowMark,pale,[],local(4397.4,383.6,-1));
  face(bike,pale,[wheel(-3.0),wheel(3.1)],local(4399.5,368.8,1));
  face(bike,pale,[wheel(-3.0),wheel(3.1)],local(4448.8,390.0,-1));
  face([[4366.3,373.3],[4367.6,373.5],[4366.0,385.4],[4364.7,385.2]],pale,[],p=>p);
  const g=new BufferGeometry();
  g.setAttribute('position',new Float32BufferAttribute(position,3));
  g.setAttribute('color',new Float32BufferAttribute(colors,3));
  g.computeVertexNormals();g.userData.paintVertices=true;g.userData.roadPaint='Waterfront crossings';
  const m=mesh(g,'#ffffff',0,0,0);m.userData.roadExposure=1;m.name='Howard waterfront bicycle turn box';
}

// The port-side curb apron and the park exit were built independently. Meet
// their actual edges at every section vertex so a walker crosses one surface.
export function addHowardRampLanding(edge:Vector3[],mesh:Surface){
  type Vertex=[number,number,number];
  const source=(curbs.lines as [number,number,number[][]][]).find(([id])=>id===3803776)![2];
  const apron:Vertex[]=[];
  for(const [x,z,nx,nz,cut] of source){
    if(cut!==0)break;
    apron.push([x-.157*nx,.0451,z-.157*nz]);
  }
  const walk:Vertex[]=edge.map(p=>[p.x,p.y,p.z]);
  const start=apron[0][0],end=apron.at(-1)![0];
  const stations=[...apron.map(p=>p[0]),...walk.map(p=>p[0]).filter(x=>x>start&&x<end)].sort((a,b)=>a-b);
  const at=(line:Vertex[],x:number):Vertex=>{
    const i=line.findIndex(p=>p[0]>=x),b=line[i],a=line[Math.max(0,i-1)];
    const t=b[0]===a[0]?0:(x-a[0])/(b[0]-a[0]);
    return [x,a[1]+t*(b[1]-a[1]),a[2]+t*(b[2]-a[2])];
  };
  const vertices:number[]=[];
  for(let i=1;i<stations.length;i++){
    const left=stations[i-1],right=stations[i];
    const a=at(apron,left),b=at(apron,right),c=at(walk,left),d=at(walk,right);
    vertices.push(...a,...c,...b,...b,...c,...d);
  }
  const g=new BufferGeometry();
  g.setAttribute('position',new Float32BufferAttribute(vertices,3));g.computeVertexNormals();
  mesh(g,'#c9c5b3',0,0,0).name='Howard north ramp landing';
}
