import * as THREE from 'three';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import type {Font} from 'three/addons/loaders/FontLoader.js';
import {footprintGeometry,sfMap} from './sf-map.ts';
import {harborDatum,waterSurface} from './water-surface.ts';

type Building={id:number;p:number[][];h:number;parent?:number};
type Point=[number,number];
type Pane={x:number;y:number;z:number;ry:number;w:number;h:number};
export const mooredVesselIds=new Set([281243360,281243626]);
export const pierThreeFloat=sfMap.piers.find(p=>p.p[0][0]===20.232&&p.p[0][1]===10.731)!;
export const isMooredVessel=(b:Building)=>mooredVesselIds.has(b.parent||b.id);
const foot=.3048*.06;

// Longitudinal axis points outward from the pier. Fit the center of the
// bounding rectangle, avoiding bias from OSM's extra nodes at a rounded end.
function berth(plan:number[][]){
  let best={area:Infinity,x:0,z:0,angle:0,length:0,width:0};
  for(let i=1;i<plan.length;i++){
    let dx=plan[i][0]-plan[i-1][0],dz=plan[i][1]-plan[i-1][1];
    if(Math.abs(dz)<Math.abs(dx))continue;
    const len=Math.hypot(dx,dz);if(len<.01)continue;
    if(dz<0){dx=-dx;dz=-dz;}dx/=len;dz/=len;
    const along=plan.map(([x,z])=>x*dx+z*dz),across=plan.map(([x,z])=>x*dz-z*dx);
    const a=Math.min(...along),b=Math.max(...along),c=Math.min(...across),d=Math.max(...across);
    if((b-a)*(d-c)>=best.area)continue;
    best={area:(b-a)*(d-c),x:(a+b)/2*dx+(c+d)/2*dz,z:(a+b)/2*dz-(c+d)/2*dx,
      angle:Math.atan2(dx,dz),length:b-a,width:d-c};
  }
  return best;
}

// Stations have common indices from keel through sheer. Bow is negative z;
// the Belle's exposed paddle occupies the opposite end.
const pointed=[[-.5,.06],[-.465,.40],[-.40,.69],[-.29,.91],[-.16,1],[.16,1],[.29,.91],[.40,.69],[.465,.40],[.5,.06]];
const steamer=[[-.5,.035],[-.475,.40],[-.427,.74],[-.346,.95],[-.28,1],[.29,1],[.42,.965],[.485,.87],[.50,.81]];
function contour(stations:number[][],length:number,width:number,center=0):Point[]{
  const edge=stations.map(([z,w]):Point=>[w*width/2,z*length+center]);
  return [...edge,...edge.slice().reverse().map(([x,z]):Point=>[-x,z])];
}
function salon(from:number,to:number,width:number,bow:number,aft:number):Point[]{
  const w=width/2;
  return [[w*.56,from],[w*.86,from+bow*.34],[w,from+bow],[w,to-aft],[w*.82,to-aft*.22],[w*.65,to],
    [-w*.65,to],[-w*.82,to-aft*.22],[-w,to-aft],[-w,from+bow],[-w*.86,from+bow*.34],[-w*.56,from]];
}

/** Pier 3's two ships share a mooring datum but have different hulls and deck arrangements. */
export function mooredVessel(b:Building,font:Font){
  const root=new THREE.Group(),windows:Pane[]=[],frame=berth(b.p),belle=b.id===281243626;
  const white='#e4e1d1',shadow='#344b50',rail='#cdd3c6',blue='#485d71',maroon='#a55443';
  const paint=new Map<string,THREE.MeshStandardMaterial>();
  root.name=belle?'San Francisco Belle, Pier 3':'Santa Rosa, Pier 3';
  root.position.set(frame.x,waterSurface.level,frame.z);root.rotation.y=frame.angle;root.updateMatrixWorld();
  function mesh(geo:THREE.BufferGeometry,color:string,x=0,y=0,z=0,name=''){
    let mat=paint.get(color);
    if(!mat)paint.set(color,mat=new THREE.MeshStandardMaterial({color,roughness:.83}));
    const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.name=name;root.add(m);return m;
  }
  const box=(w:number,h:number,d:number,x:number,y:number,z:number,c:string,name='')=>mesh(new THREE.BoxGeometry(w,h,d),c,x,y,z,name);
  function slab(p:Point[],y:number,h:number,c:string,name=''){
    return mesh(footprintGeometry(p,h),c,0,y,0,name);
  }
  const v=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
  function rod(a:THREE.Vector3,b:THREE.Vector3,r:number,c:string,name=''){
    const diff=b.clone().sub(a),mid=a.clone().lerp(b,.5);
    const m=mesh(new THREE.CylinderGeometry(r,r,diff.length(),6),c,mid.x,mid.y,mid.z,name);
    m.quaternion.setFromUnitVectors(v(0,1,0),diff.normalize());return m;
  }
  function trace(p:Point[],y:number,r:number,c:string,posts=false){
    for(let i=0;i<p.length;i++){
      const [x,z]=p[i],[a,b]=p[(i+1)%p.length];
      rod(v(x,y,z),v(a,y,b),r,c);
      if(posts){
        const n=Math.ceil(Math.hypot(a-x,b-z)/.135);
        for(let j=0;j<n;j++)rod(v(x+(a-x)*j/n,y-.065,z+(b-z)*j/n),v(x+(a-x)*j/n,y,z+(b-z)*j/n),.003,c);
      }
    }
  }
  const length=(belle?228:256)*foot,beam=(belle?60:46.5)*foot;
  const freeboard=belle?58/12*foot:.108,draft=belle?7.6*foot:.185;
  const peak=belle?steamer:pointed;
  const offset=belle?-.09:0;
  const hullRings=[
    {p:contour(peak,length*.85,beam*.37,offset),y:-draft,c:'#785f56'},
    {p:contour(peak,length*.93,beam*.78,offset),y:-draft*.57,c:'#495754'},
    {p:contour(peak,length*(belle?218.9/228:.972),beam*.93,offset),y:0,c:'#344748'},
    {p:contour(peak,length,beam,offset),y:freeboard,c:'#344748'},
  ];
  for(let j=1;j<hullRings.length;j++){
    const lo=hullRings[j-1],hi=hullRings[j],coords:number[]=[];
    for(let i=0;i<lo.p.length;i++){
      const n=(i+1)%lo.p.length;
      const pt=(ring:typeof lo,k:number)=>[ring.p[k][0],ring.y,ring.p[k][1]];
      coords.push(...pt(lo,i),...pt(hi,i),...pt(hi,n),...pt(lo,i),...pt(hi,n),...pt(lo,n));
    }
    const g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(coords,3));g.computeVertexNormals();
    mesh(g,lo.c,0,0,0,'Raked hull strake');
  }
  slab(hullRings[0].p,-draft,.006,'#705c54','Keel');
  const mainWidth=belle?74*foot:frame.width,mainLength=belle?4.79:length;
  const deckPlan=belle?salon(-mainLength/2,mainLength/2,mainWidth,.57,.52):contour(pointed,length,mainWidth);
  // The paddle shaft passes through a stern well between the side galleries.
  if(belle)deckPlan.splice(6,0,[.29,mainLength/2],[.29,1.91],[-.29,1.91],[-.29,mainLength/2]);
  slab(deckPlan,freeboard-.013,.022,'#777e76','Main deck');
  trace(deckPlan,freeboard-.007,.012,'#46534f');

  function panes(plan:Point[],y:number,h:number,style:'arch'|'sash'|'bridge'|'promenade'){
    for(let i=0;i<plan.length;i++){
      const [x,z]=plan[i],[a,q]=plan[(i+1)%plan.length],dx=a-x,dz=q-z,len=Math.hypot(dx,dz);
      if(len<.085)continue;
      const nx=dz/len,nz=-dx/len,heading=Math.atan2(nx,nz);
      const n=Math.max(1,Math.round(len/(style==='bridge'?.073:style==='arch'?.155:.157)));
      const bay=len/n,w=bay*(style==='sash'?.43:style==='arch'?.54:.86);
      for(let j=0;j<n;j++){
        const f=(j+.5)/n,xx=x+dx*f+nx*.003,zz=z+dz*f+nz*.003;
        const point=root.localToWorld(v(xx,y,zz));
        windows.push({x:point.x,y:point.y,z:point.z,ry:frame.angle+heading,w,h});
        if(style==='sash'){
          const mullion=box(.004,h,.004,xx+nx*.001,y,zz+nz*.001,white);mullion.rotation.y=heading;
          const sash=box(w,.006,.004,xx+nx*.002,y+h*.09,zz+nz*.002,white);sash.rotation.y=heading;
        }
        if(style==='arch'){
          // Round-headed glazing continues above the batched rectangular panes.
          const top=mesh(new THREE.CircleGeometry(w/2,10,0,Math.PI),shadow,xx,y+h/2,zz);top.rotation.y=heading;
        }
      }
    }
  }
  function stripedRoof(p:Point[],y:number,color:string){
    slab(p,y,.017,color,'Weather deck');
    trace(p,y+.017,.007,white);
  }
  function wheelhouse(z:number,y:number,width:number,depth:number){
    const p=salon(z-depth/2,z+depth/2,width,.075,.06),h=.135;
    slab(p,y,h,white,'Wheelhouse');panes(p,y+h*.62,h*.55,'bridge');
    const over=salon(z-depth/2-.016,z+depth/2+.016,width+.032,.075,.06);
    stripedRoof(over,y+h,'#9aa49d');
  }
  const story=belle?.207:.215;
  if(belle){
    const decks=[
      {lo:-2.04,hi:1.81,w:1.07,edge:deckPlan},
      {lo:-1.89,hi:1.70,w:1.05,edge:salon(-2.18,1.86,1.35,.35,.045)},
      {lo:-1.72,hi:1.61,w:1.02,edge:salon(-1.99,1.95,1.32,.24,.035)},
    ];
    for(const [i,d] of decks.entries()){
      const bottom=freeboard+i*story,p=salon(d.lo,d.hi,d.w,.24,.04);
      slab(p,bottom+.008,story-.014,white,'Dining salon');
      panes(p,bottom+story*.48,story*.46,'arch');
      if(i)stripedRoof(d.edge,bottom-.012,'#a9a495');
      for(const h of [.038,.079])trace(d.edge,bottom+h,.004,rail,h>.05);
      trace(d.edge,bottom+.006,.009,blue);
      // Slender uprights leave the exterior walks open to light.
      for(const side of [-1,1])for(let z=d.lo+.16;z<d.hi;z+=.295)
        rod(v(side*.585,bottom+.01,z),v(side*.585,bottom+story,z),.0055,white);
    }
    const top=freeboard+story*3,roof=salon(-1.76,1.70,1.19,.17,.03);
    stripedRoof(roof,top,'#b5ab94');trace(roof,top+.081,.004,white,true);
    wheelhouse(-1.29,top+.018,.44,.39);
    // A narrow, crowned canopy leaves open walks on both sides of the sundeck.
    for(const side of [-1,1])for(let z=-.91;z<1.06;z+=.28)rod(v(side*.28,top+.02,z),v(side*.28,top+.153,z),.005,white);
    for(const side of [-1,1]){
      const roofPanel=box(.30,.012,2.07,side*.149,top+.169,.065,'#c2b9a5','Sundeck canopy');roofPanel.rotation.z=-side*.095;
      for(let z=-.91;z<=1.02;z+=.26)
        rod(v(0,top+.189,z),v(side*.296,top+.159,z),.0026,'#a69887');
    }
    for(const side of [-1,1]){
      const x=side*.31,z=-.63;
      mesh(new THREE.CylinderGeometry(.041,.052,.216,12),shadow,x,top+.132,z,'Fluted stack');
      for(const y of [.203,.222])mesh(new THREE.CylinderGeometry(.051,.049,.014,12),maroon,x,top+y,z);
      for(let i=0;i<8;i++){const a=i*Math.PI/4;rod(v(x+.042*Math.cos(a),top+.22,z+.042*Math.sin(a)),v(x+.073*Math.cos(a),top+.306,z+.073*Math.sin(a)),.005,'#a58c66');}
      const board=box(1.15,.116,.014,side*.51,top+.109,.48,blue);board.rotation.y=side*Math.PI/2;
      const geo=new TextGeometry('SAN FRANCISCO BELLE',{font,size:.060,depth:.002,curveSegments:2});geo.computeBoundingBox();geo.center();
      mesh(geo,'#dd945d',side*.519,top+.11,.48).rotation.y=side*Math.PI/2;
    }
    const paddleZ=2.17,r=.217,y=.12;
    rod(v(-.30,y,paddleZ),v(.30,y,paddleZ),.018,shadow,'Transverse paddle axle');
    for(const x of [-.248,0,.248]){
      const rim=mesh(new THREE.TorusGeometry(r,.012,5,22),maroon,x,y,paddleZ,'Paddle rim');rim.rotation.y=Math.PI/2;
      for(let i=0;i<10;i++){const a=i*Math.PI/5;rod(v(x,y,paddleZ),v(x,y+r*Math.cos(a),paddleZ+r*Math.sin(a)),.006,maroon);}
    }
    for(let i=0;i<12;i++){const a=i*Math.PI/6;box(.54,.063,.016,0,y+r*Math.cos(a),paddleZ+r*Math.sin(a),maroon,'Paddle float').rotation.x=a;}
    // Twin stowed bow ramps account for the vessel's extreme length.
    for(const x of [-.38,.38]){
      const lip=v(x,freeboard+.03,-2.20),tip=v(x,freeboard+.45,-2.94),run=tip.clone().sub(lip);
      const ramp=box(.145,.017,run.length(),x,(lip.y+tip.y)/2,(lip.z+tip.z)/2,'#8f9287','Raised bow ramp');
      ramp.rotation.x=Math.atan2(run.y,-run.z);
      rod(v(x,freeboard+.02,-2.13),v(x,freeboard+.82,-2.13),.008,white);
      rod(v(x,freeboard+.80,-2.13),tip,.0035,rail);
      for(const s of [-1,1])rod(v(x+s*.069,lip.y+.065,lip.z),v(x+s*.069,tip.y+.065,tip.z),.003,rail);
    }
  }else{
    const low=salon(-2.10,2.08,mainWidth*.94,.29,.29);
    slab(low,freeboard+.009,story,white,'Historic enclosed car deck');
    panes(low,freeboard+.112,.115,'sash');
    const high=salon(-1.94,1.98,mainWidth*.77,.23,.24);
    const balcony=salon(-2.13,2.12,mainWidth*.97,.30,.30);
    stripedRoof(balcony,freeboard+story,'#969b8d');
    slab(high,freeboard+story+.016,.144,white,'Passenger saloon');
    panes(high,freeboard+story+.103,.071,'promenade');
    for(const side of [-1,1])for(let z=-1.91;z<2.0;z+=.21)rod(v(side*mainWidth*.463,freeboard+story+.012,z),v(side*mainWidth*.463,freeboard+story+.169,z),.004,white);
    trace(balcony,freeboard+story+.083,.004,rail,true);
    const top=freeboard+story+.161;
    stripedRoof(balcony,top,'#b3ad99');
    // The end wheelhouses and the central casing are independently mapped
    // building parts. Transform their actual centroids onto the ship axis.
    for(const id of [404478466,404478468]){
      const part=sfMap.buildings.find(p=>p.id===id)!;
      const stations=part.p.map(([x,z])=>root.worldToLocal(v(x,0,z)).z);
      wheelhouse((Math.min(...stations)+Math.max(...stations))/2,top+.016,.315,.44);
    }
    slab(salon(-.34,.31,.39,.054,.054),top+.017,.085,'#bcbcad','Engine casing');
    const stack=mesh(new THREE.CylinderGeometry(.105,.117,.242,16),shadow,0,top+.195,.015,'Single oval funnel');stack.scale.z=1.48;
    const rim=mesh(new THREE.CylinderGeometry(.113,.11,.027,16),'#716e63',0,top+.316,.015);rim.scale.z=1.48;
    const throat=mesh(new THREE.CircleGeometry(.091,16),'#38413e',0,top+.330,.015);throat.rotation.x=-Math.PI/2;throat.scale.y=1.5;
    for(const z of [-.86,-.48,.45,.83])for(const side of [-1,1]){
      const x=side*.26;
      mesh(new THREE.CylinderGeometry(.026,.034,.094,8),white,x,top+.058,z);
      const hood=mesh(new THREE.SphereGeometry(.05,10,7),white,x,top+.125,z,'Ventilator cowl');hood.scale.z=1.35;
      const end=mesh(new THREE.CircleGeometry(.038,12),maroon,x,top+.135,z+Math.sign(z)*.055);
      end.rotation.y=z<0?Math.PI:0;
    }
    for(const z of [-1.04,1.02]){
      const skylight=salon(z-.11,z+.11,.34,.018,.018);
      slab(skylight,top+.018,.037,'#8b9c98','Skylight');
      for(const x of [-.10,0,.10])box(.007,.008,.22,x,top+.058,z,white);
    }
  }
  // Port orthophoto, 2024 (8 cm GSD), aligned to the same survey datum.
  // Rosa boards at her outboard end. Belle boards via a separate float.
  const worldPoint=(x:number,y:number,z:number)=>root.worldToLocal(v(x,y,z));
  function gangway(ship:THREE.Vector3,landing:THREE.Vector3,width:number,name:string){
    const delta=landing.clone().sub(ship),mid=ship.clone().lerp(landing,.5);
    const ramp=box(width,.014,delta.length(),mid.x,mid.y,mid.z,'#aaa99c',name);
    ramp.rotation.order='YXZ';ramp.rotation.y=Math.atan2(delta.x,delta.z);ramp.rotation.x=-Math.atan2(delta.y,Math.hypot(delta.x,delta.z));
    const n=v(delta.z,0,-delta.x).normalize().multiplyScalar(width*.45);
    for(const side of [-1,1]){
      const s=ship.clone().addScaledVector(n,side),e=landing.clone().addScaledVector(n,side);
      const spacing=Math.max(1,Math.ceil(delta.length()/.19));
      for(let i=0;i<=spacing;i++){const p=s.clone().lerp(e,i/spacing);rod(p,p.clone().add(v(0,.068,0)),.003,rail);}
      rod(s.clone().add(v(0,.068,0)),e.clone().add(v(0,.068,0)),.0034,rail);
    }
  }
  if(belle){
    const plan=pierThreeFloat.p.map(([x,z]):Point=>{const a=worldPoint(x,0,z);return [a.x,a.z];});
    const deck=harborDatum.pierThreeFreeboard;
    slab(plan,-.049,deck-.014+.049,'#7d8175','Pier 3 boarding float');
    slab(plan,deck-.014,.014,'#bbad95','Float deck');
    gangway(worldPoint(19.99,waterSurface.level+deck,8.72),worldPoint(19.50,harborDatum.pierDeck,7.06),.155,'Pier 3 boarding gangway');
    gangway(worldPoint(20.16,waterSurface.level+deck,9.07),v(-mainWidth*.493,freeboard+.018,-.80),.124,'Boarding brow');
  }else{
    gangway(v(-.13,freeboard+story+.015,2.05),worldPoint(19.49,harborDatum.pierDeck,6.62),.123,'Pier 3 boarding gangway');
  }
  // Fine, slack breast lines run outside the hull; heavy fenders separate
  // the ship's side from the float and wharf.
  for(const sign of [-1,1]){
    const s=v(-mainWidth*.425,freeboard+.07,sign*(belle?1.74:1.62));
    const e=worldPoint(19.54,harborDatum.pierDeck+.015,frame.z+sign*(belle?2.10:2.02));
    const mid=s.clone().lerp(e,.5);mid.y-=.055;
    rod(s,mid,.0045,'#8f846b');rod(mid,e,.0045,'#8f846b');
    mesh(new THREE.CylinderGeometry(.037,.035,.12,8),'#565c56',-mainWidth*.49,freeboard-.009,sign*.92,'Fender');
  }
  return {root,windows};
}
