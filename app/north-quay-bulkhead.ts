import {Color,ShapeUtils} from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import fontData from './harbor-font.json' with {type:'json'};
import {northWaterfrontGrade} from './north-quay-grade.ts';

type Paint=readonly [number,number,number];
type Surface={
  vertex(x:number,y:number,z:number,color:Paint):number;
  quad(a:number,b:number,c:number,d:number):void;
  triangle(a:number,b:number,c:number):void;
};
type Point=[x:number,height:number,projection:number];
function paint(hex:string):Paint{
  const c=new Color(hex);
  return [Math.round(c.r*255),Math.round(c.g*255),Math.round(c.b*255)];
}
const plaster=paint('#d9d2c1'),ashlar=paint('#dbd5c7'),course=paint('#e8e1cf'),sill=paint('#b8b3a3');
const shadow=paint('#797d73'),glass=paint('#495957'),sash=paint('#aaa999'),shutter=paint('#505759'),rib=paint('#646967');

// DataSF 201006.0000042 and .0001692 form the street elevations of Piers
// 29 and 31. Match the two decoded survey footprints by their first corner.
export function northQuayFront(x:number,z:number){
  if(Math.abs(x-81.73)<.001&&Math.abs(z-.13)<.001)return {south:true,first:2,last:5};
  if(Math.abs(x-92.04)<.001&&Math.abs(z+3.78)<.001)return {south:false,first:3,last:12};
}

// 2024 city ortho registers both pavilions to their roof ridges. The Port's
// Historic Piers RFI pp. 30–31 and district nomination pp. 106–108 show
// the shuttered arches, paired truck openings and two-storey timber sash.
export function addNorthQuayFront(surface:Surface,south:boolean){
  const lo=south?80.97:83.62,hi=south?83.64:91.94;
  const frontZ=south?-2.19:-2.77,endZ=south?-2.67:-4.36;
  const floor=(northWaterfrontGrade(lo)+northWaterfrontGrade(hi))/2+.016;
  const wall=.552;
  let side=false;
  const returnDepth=south?1.31:.71;
  function vertex([x,y,d]:Point,color:Paint){
    if(side){
      const depth=returnDepth-x;
      return surface.vertex(lo+.183*depth-d,floor+y,frontZ+depth,color);
    }
    return surface.vertex(x,floor+y,frontZ+(endZ-frontZ)*(x-lo)/(hi-lo)-d,color);
  }
  function face(a:Point,b:Point,c:Point,d:Point,color:Paint){
    surface.quad(vertex(a,color),vertex(b,color),vertex(c,color),vertex(d,color));
  }
  function panel(a:number,b:number,y:number,h:number,d:number,color:Paint){
    face([a,y,d],[a,h,d],[b,h,d],[b,y,d],color);
  }
  function block(a:number,b:number,y:number,h:number,d:number,back:number,color:Paint){
    panel(a,b,y,h,d,color);
    face([a,y,back],[a,h,back],[a,h,d],[a,y,d],color);
    face([b,y,d],[b,h,d],[b,h,back],[b,y,back],color);
    face([a,h,d],[a,h,back],[b,h,back],[b,h,d],color);
    face([a,y,back],[a,y,d],[b,y,d],[b,y,back],color);
  }
  function sashWindow(a:number,b:number,y:number,h:number,lower:boolean){
    const inset=-.019;
    panel(a,b,y,h,inset,glass);
    face([a,y,0],[a,h,0],[a,h,inset],[a,y,inset],shadow);
    face([b,y,inset],[b,h,inset],[b,h,0],[b,y,0],shadow);
    face([a,h,0],[b,h,0],[b,h,inset],[a,h,inset],shadow);
    // Five lower-story pane columns and three above. The transom and
    // meeting rail are heavier than the intermediate glazing bars.
    const cols=lower?5:3,rows=lower?7:4;
    for(let j=1;j<cols;j++){const x=a+(b-a)*j/cols;panel(x-.0016,x+.0016,y,h,inset+.002,sash);}
    for(let j=1;j<rows;j++){const v=y+(h-y)*j/rows;panel(a,b,v-.0015,v+.0015,inset+.003,sash);}
    const split=y+(h-y)*(lower?5/7:.5);panel(a,b,split-.003,split+.003,inset+.004,sash);
    block(a-.009,b+.009,y-.012,y,.012,inset,sill);
  }
  function bay(a:number,b:number,door:boolean){
    const width=b-a,mid=(a+b)/2;
    if(door){
      const doorCenter=(a+mid)/2,half=width*.118;
      panel(a,doorCenter-half,-.13,.039,0,plaster);panel(doorCenter+half,b,-.13,.039,0,plaster);
    }else panel(a,b,-.13,.039,0,plaster);
    panel(a,b,.261,.351,0,plaster);
    panel(a,b,.489,wall,0,plaster);
    // Each structural bay has paired openings and a continuous sill.
    for(const [left,right] of [[a,mid],[mid,b]]){
      const x=(left+right)/2,half=width*.118;
      for(const [y,h,low] of [[.039,.261,true],[.351,.489,false]] as const){
        panel(left,x-half,y,h,0,plaster);panel(x+half,right,y,h,0,plaster);
        if(door&&low&&left===a){
          panel(x-half,x+half,-.055,h,-.020,shutter);
          panel(x-half+.006,x+half-.006,.090,h-.008,-.017,glass);
          face([x-half,-.055,0],[x-half,h,0],[x-half,h,-.020],[x-half,-.055,-.020],shadow);
          face([x+half,-.055,-.020],[x+half,h,-.020],[x+half,h,0],[x+half,-.055,0],shadow);
          face([x-half,h,0],[x+half,h,0],[x+half,h,-.020],[x-half,h,-.020],shadow);
        }else sashWindow(x-half,x+half,y,h,low);
      }
    }
    block(a,a+.022,-.03,wall,.024,0,ashlar);
    for(let k=1;k<=6;k++)panel(a,a+.022,.073*k,.073*k+.003,.0245,sill);
  }
  function truckOpening(a:number,b:number){
    // A pair of rectangular entries replaced the central connector windows.
    panel(a,b,.395,wall,0,plaster);
    panel(a,b,-.04,.395,-.040,shutter);
    for(let i=1;i<=13;i++)panel(a,b,.026*i,.026*i+.002,-.038,rib);
    face([a,-.04,0],[a,.395,0],[a,.395,-.04],[a,-.04,-.04],shadow);
    face([b,-.04,-.04],[b,.395,-.04],[b,.395,0],[b,-.04,0],shadow);
    face([a,.395,0],[b,.395,0],[b,.395,-.04],[a,.395,-.04],shadow);
    block(a,a+.021,-.04,.395,.012,-.04,ashlar);
  }
  function cornice(a:number,b:number){
    block(a,b,wall-.035,wall-.022,.017,0,sill);
    block(a,b,wall-.022,wall+.006,.033,-.08,course);
  }
  function pavilion(a:number,b:number){
    const center=(a+b)/2,width=b-a,inner=width*.314,outer=width*.365;
    const spring=.299,arch=.287,eaves=.679,peak=.794,steps=17;
    // The two piers and wedge stones enclose a genuinely recessed rolling door.
    for(const [left,right] of [[a,center-inner],[center+inner,b]]){
      panel(left,right,-.13,spring,.028,plaster);
      block(left,right,-.060,.060,.043,.028,ashlar);
    }
    panel(center-inner,center+inner,-.11,spring,-.044,shutter);
    for(let k=1;k<=11;k++)panel(center-inner,center+inner,k*.025,k*.025+.002,-.043,rib);
    block(center-.005,center+.005,-.03,spring,-.039,-.044,shadow);
    function archPoint(i:number,r:number,h:number,d:number):Point{
      const t=Math.PI*(1-i/steps);return [center+r*Math.cos(t),spring+h*Math.sin(t),d];
    }
    for(let i=0;i<steps;i++){
      const p=archPoint(i,inner,arch,.038),q=archPoint(i+1,inner,arch,.038);
      const top=archPoint(i,outer,arch+.063,.038),next=archPoint(i+1,outer,arch+.063,.038);
      face(p,top,next,q,i===8?course:i%3===1?plaster:ashlar);
      face([p[0],p[1],-.044],p,q,[q[0],q[1],-.044],sill);
      const v=vertex([center,spring,-.044],shutter);
      surface.triangle(v,vertex([p[0],p[1],-.044],shutter),vertex([q[0],q[1],-.044],shutter));
      face([top[0],top[1],.028],[top[0],eaves,.028],[next[0],eaves,.028],[next[0],next[1],.028],plaster);
    }
    for(const [left,right] of [[a,center-outer],[center+outer,b]]){
      panel(left,right,spring,eaves,.028,plaster);
      block(left,right,-.032,eaves,.052,.028,ashlar);
    }
    const left=center-inner,right=center+inner;
    face([left,-.03,.038],[left,spring,.038],[left,spring,-.044],[left,-.03,-.044],sill);
    face([right,-.03,-.044],[right,spring,-.044],[right,spring,.038],[right,-.03,.038],sill);
    for(const [x,u,y,v] of [[a,center,eaves,peak],[center,b,peak,eaves]]){
      face([x,eaves,.028],[x,y,.028],[u,v,.028],[u,eaves,.028],plaster);
      face([x,y-.016,.045],[x,y+.015,.045],[u,v+.015,.045],[u,v-.016,.045],course);
      face([x,y+.015,.045],[x,y+.015,-.08],[u,v+.015,-.08],[u,v+.015,.045],course);
    }
    // Returned roof planes give the gable its silhouette from the oblique
    // passenger view. The raised lettering faces the Embarcadero.
    for(const [x,u,y,v] of [[a,center,eaves,peak],[center,b,peak,eaves]]){
      face([x,y,.027],[x+.10,y,-.52],[u+.10,v,-.52],[u,v,.027],plaster);
    }
    for(const x of [a,b]){
      const d=-.52,back=x+.10;
      if(x===a)face([back,wall,d],[back,eaves,d],[x,eaves,.028],[x,wall,.028],plaster);
      else face([x,wall,.028],[x,eaves,.028],[back,eaves,d],[back,wall,d],plaster);
    }
    const shapes=new FontLoader().parse(fontData).generateShapes(south?'PIER 29':'PIER 31',.044);
    const contours=shapes.map(shape=>shape.extractPoints(2));
    const widthText=Math.max(...contours.flatMap(shape=>shape.shape.map(p=>p.x)));
    for(const {shape,holes} of contours){
      const triangles=ShapeUtils.triangulateShape(shape,holes);
      const vertices=[shape,...holes].flat().map(p=>vertex([center+widthText/2-p.x,.675+p.y,.031],shutter));
      for(const [i,j,k] of triangles)surface.triangle(vertices[i],vertices[j],vertices[k]);
    }
    block(center-.004,center+.004,peak+.015,peak+.32,.004,-.004,sash);
  }
  function wing(a:number,b:number,n:number,connector=false){
    const step=(b-a)/n;
    for(let i=0;i<n;i++){
      const left=a+i*step,right=left+step;
      if(connector&&(i===4||i===5))truckOpening(left,right);
      else{
        const besidePavilion=connector?(i===0||i===n-1):south?i===n-1:i===0;
        bay(left,right,!side&&besidePavilion);
      }
    }
    cornice(a,b);
  }
  if(south){
    wing(lo,82.35,3);pavilion(82.35,hi);
    face([lo,wall,-.034],[lo+.24,wall,-1.35],[hi+.24,wall,-1.35],[hi,wall,-.034],plaster);
    side=true;wing(0,returnDepth,2);
  }else{
    wing(lo,89.49,11,true);pavilion(89.49,90.92);wing(90.92,hi,2);
    side=true;panel(0,returnDepth,-.13,wall,0,plaster);cornice(0,returnDepth);
  }
}
