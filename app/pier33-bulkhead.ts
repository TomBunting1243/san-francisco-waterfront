import {Color,ShapeUtils} from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import lettering from './harbor-font.json' with {type:'json'};
import {northWaterfrontGrade} from './north-quay-grade.ts';

type Ink=readonly [number,number,number];
type Surface={vertex(x:number,y:number,z:number,c:Ink):number;triangle(a:number,b:number,c:number):void;quad(a:number,b:number,c:number,d:number):void};
type Point=[station:number,height:number,depth:number];
function paint(css:string):Ink{
  const c=new Color(css);return [Math.round(c.r*255),Math.round(c.g*255),Math.round(c.b*255)];
}
const stucco=paint('#dcdad1'),stone=paint('#d4d0c6'),cap=paint('#eeeae1'),reveal=paint('#9b9c91');
const sash=paint('#a1a6a0'),glass=paint('#425253'),steel=paint('#586364'),inside=paint('#404a47');
const roof=paint('#a9a49a'),awning=paint('#5d5d54'),paving=paint('#c5bdae');
const south=93.92,north=100.06,archSouth=95.70,archNorth=97.28,center=(archSouth+archNorth)/2;
const wall=.655,eaves=.835,peak=.983;
export const pier33Floor=northWaterfrontGrade(south)+.012;
export const pier33FrontZ=(x:number)=>-4.88+(x-south)*(-7.23+4.88)/(north-south);

// The two City roof IDs 201006.0004234 and .0004928 share the arch.
export function pier33SurveyPart(x:number,z:number){
  if(Math.abs(x-94.97)<.001&&Math.abs(z+4.37)<.001)return 'south';
  if(Math.abs(x-98)<.001&&Math.abs(z+5.54)<.001)return 'north';
}

/** Pier 33, including the Alcatraz Landing shop in the former rail portal. */
export function addPier33Bulkhead(s:Surface){
  let side=false;
  const vertex=([x,y,d]:Point,c:Ink)=>{
    if(side){
      // South return joins the surveyed southwest and southeast corners.
      return s.vertex(south+.27*(.66-x)/.66+d,pier33Floor+y,-4.88+(.66-x),c);
    }
    return s.vertex(x,pier33Floor+y,pier33FrontZ(x)+d,c);
  };
  const face=(a:Point,b:Point,c:Point,d:Point,tone:Ink)=>s.quad(vertex(a,tone),vertex(b,tone),vertex(c,tone),vertex(d,tone));
  const panel=(a:number,b:number,y:number,h:number,d:number,tone:Ink)=>face([a,y,d],[a,h,d],[b,h,d],[b,y,d],tone);
  function ledge(a:number,b:number,y:number,h:number,front:number,back:number,tone:Ink){
    panel(a,b,y,h,front,tone);
    face([a,h,front],[a,h,back],[b,h,back],[b,h,front],tone);
    face([a,y,back],[a,y,front],[b,y,front],[b,y,back],reveal);
    face([a,y,back],[a,h,back],[a,h,front],[a,y,front],tone);
    face([b,y,front],[b,h,front],[b,h,back],[b,y,back],tone);
  }
  function aperture(a:number,b:number,y:number,h:number,depth:number,columns:number){
    panel(a,b,y,h,depth,glass);
    face([a,y,0],[a,h,0],[a,h,depth],[a,y,depth],reveal);
    face([b,y,depth],[b,h,depth],[b,h,0],[b,y,0],reveal);
    face([a,h,0],[b,h,0],[b,h,depth],[a,h,depth],reveal);
    for(let j=1;j<columns;j++){
      const x=a+(b-a)*j/columns;panel(x-.0025,x+.0025,y,h,depth-.002,sash);
    }
    panel(a,b,h-(h-y)*.34,h-(h-y)*.34+.005,depth-.003,sash);
  }
  const font=new FontLoader().parse(lettering);
  function name(text:string,mid:number,y:number,size:number,d:number){
    const contours=font.generateShapes(text,size).map(p=>p.extractPoints(2));
    const width=Math.max(...contours.flatMap(p=>p.shape.map(v=>v.x)));
    for(const {shape,holes} of contours){
      const faces=ShapeUtils.triangulateShape(shape,holes);
      const ids=[shape,...holes].flat().map(v=>vertex([mid+width/2-v.x,y+v.y,d],inside));
      for(const [a,b,c] of faces)s.triangle(ids[a],ids[b],ids[c]);
    }
  }
  function bay(a:number,b:number,panes:number,shop=false){
    const span=b-a,mid=(a+b)/2;
    panel(a,b,-.19,.026,0,stone);
    panel(a,b,.258,.368,0,stucco);panel(a,b,.548,wall,0,stucco);
    for(let i=0;i<panes;i++){
      const left=a+i*span/panes,right=left+span/panes,half=span/panes*.315,x=(left+right)/2;
      panel(left,x-half,.368,.548,0,stucco);panel(x+half,right,.368,.548,0,stucco);
      aperture(x-half,x+half,.368,.548,.022,2);
      if(!shop){
        panel(left,x-half,.026,.258,0,stucco);panel(x+half,right,.026,.258,0,stucco);
        aperture(x-half,x+half,.026,.258,.027,2);
      }
    }
    if(shop){
      const l=a+.040,r=b-.040;
      panel(a,l,.026,.258,0,stucco);panel(r,b,.026,.258,0,stucco);
      aperture(l,r,.026,.258,.074,4);
      face([l,.202,-.061],[l,.245,.003],[r,.245,.003],[r,.202,-.061],awning);
      panel(l,r,.193,.202,-.061,awning);name('ALCATRAZ LANDING',mid,.292,.033,-.005);
    }
    ledge(a,a+.029,0,wall,-.016,0,stone);
    for(let i=1;i<8;i++)panel(a,a+.029,.074*i,.074*i+.003,-.017,reveal);
    ledge(a,b,wall-.017,wall,-.026,.018,cap);
  }
  // Four bays to the south and six to the north, with a narrow bay at
  // either jamb. The third bay south is the converted railroad doorway.
  const cuts=[south,94.43,94.96,95.48,archSouth];
  for(let i=0;i<4;i++)bay(cuts[i],cuts[i+1],i===3?2:4,i===1);
  const northCuts=[archNorth,97.51,98.02,98.53,99.04,99.55,north];
  for(let i=0;i<6;i++)bay(northCuts[i],northCuts[i+1],i===0?2:4);
  side=true;bay(0,.33,2);bay(.33,.66,2);side=false;

  // Registered flat wing and rear roof edges. The gable gets a separate
  // roof so no flat cap crosses its opening. The slab foot reaches terrain.
  const back=[
    [south,94.19,-4.22],[94.70,94.97,-4.37],[96.97,97.24,-5.24],
    [97.65,97.91,-5.74],[97.75,98,-5.54],[north,100.27,-6.65],
  ];
  function rear(x:number,y:number):Point{
    let i=1;while(i<back.length-1&&x>back[i][0])i++;
    const [a,ax,az]=back[i-1],[b,bx,bz]=back[i],t=(x-a)/(b-a);
    const rearX=ax+t*(bx-ax);
    return [rearX,y,az+t*(bz-az)-pier33FrontZ(rearX)];
  }
  for(const [a,b] of [[south,archSouth],[archSouth,archNorth],[archNorth,north]]){
    const xs=[a,...back.map(v=>v[0]).filter(x=>x>a&&x<b),b];
    for(let i=1;i<xs.length;i++){
      const l=xs[i-1],r=xs[i];
      if(a!==archSouth)face([l,wall,.018],rear(l,wall),rear(r,wall),[r,wall,.018],roof);
      face(rear(r,-.21),rear(r,wall),rear(l,wall),rear(l,-.21),stone);
    }
  }
  face([north,-.21,0],[north,wall,0],rear(north,wall),rear(north,-.21),stone);
  // The long sill has a continuous support below the portal and storefronts.
  face([south,-.19,-.085],[south,0,-.085],[north,0,-.085],[north,-.19,-.085],stone);
  face([south,0,-.085],[south,0,.08],[north,0,.08],[north,0,-.085],paving);
  face([south,-.19,.08],[south,0,.08],[south,0,-.085],[south,-.19,-.085],stone);
  face([north,-.19,-.085],[north,0,-.085],[north,0,.08],[north,-.19,.08],stone);
  const inner=.401,outer=.490,spring=.296,rise=.352;
  const point=(i:number,r:number,h:number,d:number):Point=>{
    const angle=Math.PI*(1-i/18);
    return [center+r*Math.cos(angle),spring+h*Math.sin(angle),d];
  };
  for(let i=0;i<18;i++){
    const l=point(i,inner,rise,-.046),r=point(i+1,inner,rise,-.046);
    const p=point(i,outer,rise+.072,-.047),q=point(i+1,outer,rise+.072,-.047);
    face(l,p,q,r,i===8||i===9?cap:i%3?stone:stucco);
    face([l[0],l[1],.108],l,r,[r[0],r[1],.108],reveal);
    s.triangle(vertex([center,spring,.11],inside),vertex([l[0],l[1],.11],inside),vertex([r[0],r[1],.11],inside));
    face([p[0],p[1],-.028],[p[0],eaves,-.028],[q[0],eaves,-.028],[q[0],q[1],-.028],stucco);
  }
  for(const [a,b] of [[archSouth,center-inner],[center+inner,archNorth]])panel(a,b,-.19,spring,-.028,stucco);
  for(const [a,b] of [[archSouth,center-outer],[center+outer,archNorth]])ledge(a,b,-.19,eaves,-.041,-.018,stucco);
  panel(center-inner,center+inner,-.045,spring,.11,inside);
  for(let i=0;i<=18;i++){
    const x=center-inner+(2*inner/18)*i;
    panel(x-.0018,x+.0018,.02,spring,.094,steel);
  }
  for(const x of [center-inner,center+inner]){
    const a:Point=[x,0,-.046],b:Point=[x,spring,-.046],c:Point=[x,spring,.11],d:Point=[x,0,.11];
    if(x<center)face(a,b,c,d,reveal);else face(d,c,b,a,reveal);
  }
  for(const [a,b,y,h] of [[archSouth,center,eaves,peak],[center,archNorth,peak,eaves]]){
    face([a,eaves,-.028],[a,y,-.028],[b,h,-.028],[b,eaves,-.028],stucco);
    face([a,y-.014,-.052],[a,y+.014,-.052],[b,h+.014,-.052],[b,h-.014,-.052],cap);
    face([a,y+.014,-.052],[a,y+.014,.073],[b,h+.014,.073],[b,h+.014,-.052],cap);
    face([a,y,.07],rear(a,y),rear(b,h),[b,h,.07],roof);
    face(rear(b,wall),rear(b,h),rear(a,y),rear(a,wall),stucco);
  }
  for(const x of [archSouth,archNorth]){
    const a:Point=[x,wall,.012],b:Point=[x,eaves,.012],c=rear(x,eaves),d=rear(x,wall);
    if(x===archSouth)face(d,c,b,a,stucco);else face(a,b,c,d,stucco);
  }
  name('PIER 33',center,.77,.062,-.031);
  ledge(center-.005,center+.005,peak+.015,1.565,-.025,-.014,steel);
}
