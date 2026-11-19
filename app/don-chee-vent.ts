import * as THREE from 'three';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';

type Surface=(g:THREE.BufferGeometry,color:string,x:number,y:number,z:number)=>THREE.Mesh;
type Point=[number,number];
const paint=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.93});
export const donCheeVentDeck=.321;

// SF's 2024 8 cm aerial, registered to world coordinates at 132 px/unit.
// Trace the upper coping, retaining the concave hotel-side notch.
const fromImage=(x:number,y:number):Point=>[x/132-13,-4-y/132];
const ring=[[487,300],[551,310],[558,269],[599,275],[603,275],[606,272],[619,191],[620,188],
  [619,185],[616,182],[612,181],[541,170],[535,170],[529,171],[523,174],
  [519,178],[515,184],[512,192],[499,233],[494,250]].map(([x,y])=>fromImage(x,y));
const center=fromImage(528,250),radius=33/132;
const at=(p:Point,h:number):FacadePoint=>[p[0],h,p[1]];
const circle=(r:number,i:number):Point=>[center[0]+r*Math.cos(i*Math.PI/24),center[1]+r*Math.sin(i*Math.PI/24)];

/** The supplemental city footprint is the only rendered body for OSM 260290226. */
export function addDonCheeVent(mesh:Surface,surveyOutline:number[][]){
  const anchor=surveyOutline[0];
  if(!anchor||Math.abs(anchor[0]+9.204)>.002||Math.abs(anchor[1]+5.796)>.002)return false;
  const p=new FacadePanels(),top=donCheeVentDeck;
  const outer=ring.map(([x,z])=>new THREE.Vector2(x,z));
  const inner=Array.from({length:48},(_,i)=>new THREE.Vector2(...circle(radius,i)));
  const points=[...outer,...inner].map(v=>at([v.x,v.y],top));
  for(const [a,b,c] of THREE.ShapeUtils.triangulateShape(outer,[inner]))p.triangle(points[a],points[c],points[b],'#a7a498');
  for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length];
    p.quad(at(a,.012),at(a,.069),at(b,.069),at(b,.012),'#96958b');
    p.quad(at(a,.069),at(a,top-.011),at(b,top-.011),at(b,.069),'#bab6a6');
    p.quad(at(a,top-.011),at(a,top),at(b,top),at(b,top-.011),'#d4ceba');
    const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
    const move=(s:Point):Point=>[s[0]-.008*dz/length,s[1]+.008*dx/length];
    p.quad(at(a,top+.0004),at(move(a),top+.0004),at(move(b),top+.0004),at(b,top+.0004),'#ccc5b3');
  }
  // Recessed circular grate with two diagonal sets of steel bars and three
  // heavier cross members. The roof surface ends at its concrete collar.
  const bore=radius-.016,lip=top+.0035;
  for(let i=0;i<48;i++){
    const a=circle(radius,i),b=circle(radius,i+1),l=circle(bore,i),r=circle(bore,i+1);
    p.quad(at(a,top),at(a,lip),at(b,lip),at(b,top),'#aba99b');
    p.quad(at(a,lip),at(l,lip),at(r,lip),at(b,lip),'#d5cfba');
    p.quad(at(l,top-.019),at(r,top-.019),at(r,lip),at(l,lip),'#62685e');
    p.triangle(at(center,top-.020),at(r,top-.020),at(l,top-.020),'#555b55');
  }
  function bars(angle:number,spacing:number,count:number,halfWidth:number,y:number,color:string){
    const co=Math.cos(angle),si=Math.sin(angle);
    const point=(u:number,v:number):FacadePoint=>[center[0]+u*co-v*si,y,center[1]+u*si+v*co];
    for(let i=-count;i<=count;i++){
      const a=i*spacing-halfWidth,b=i*spacing+halfWidth;
      const l=Math.sqrt(bore*bore-a*a),r=Math.sqrt(bore*bore-b*b);
      p.quad(point(-l,a),point(-r,b),point(r,b),point(l,a),color);
    }
  }
  bars(-.64,.016,14,.0017,top-.008,'#929387');
  bars(.91,.016,14,.0015,top-.006,'#808477');
  bars(1.43,.084,2,.003,top-.0035,'#a6a698');
  const g=p.mesh(paint).geometry;g.userData.paintVertices=true;
  mesh(g,'#ffffff',0,0,0).name='Don Chee Way Muni vent structure';
  return true;
}
