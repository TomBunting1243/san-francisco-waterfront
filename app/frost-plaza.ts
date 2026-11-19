import * as THREE from 'three';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';
import {frostWalkHeight} from './california-sidewalk.ts';

const metre=.06,axis=new THREE.Vector2(-.4505,.8929).normalize();
const center={x:-1.858,z:-17.747};
const brick=(x:number,z:number)=>frostWalkHeight(x,z)+.00035;
function along(distance:number){
  const x=center.x+axis.x*distance,z=center.z+axis.y*distance;
  return {x,y:brick(x,z),z};
}
// The site owner's straight-on photographs put the parked car in the open heart.
// The 2024 orthophoto locates the rail stop and tree wells, before installation.
export const frostPlazaPhoto={
  artwork:along(0),pose:{...along(.098),yaw:Math.atan2(axis.x,axis.y)},
  photographer:{...along(.349),yaw:Math.atan2(-axis.x,-axis.y)},
};
const bench={x:-1.914,z:-16.53};
const pot={x:-2.072,z:-16.735};
const finish=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.74,side:THREE.DoubleSide});

export function addFrostPlaza(root:THREE.Group){
  const panels=new FacadePanels(),floor=frostPlazaPhoto.artwork.y;
  function point(u:number,h:number,d:number):FacadePoint{
    return [center.x+metre*(axis.y*u+axis.x*d),floor+metre*h,center.z+metre*(-axis.x*u+axis.y*d)];
  }
  // The reported 7 by 16 feet includes the low splayed blue photo/seat plinth.
  const width=16*.3048,height=7*.3048,base=.32;
  function ring(w:number,d:number,h:number){
    return [[-w,-d],[w,-d],[w,d],[-w,d]].map(([u,z])=>point(u,h,z));
  }
  const lower=ring(width/2,.59,0),upper=ring(width/2-.10,.48,base);
  panels.quad(upper[3],upper[2],upper[1],upper[0],'#4a5f96');
  for(let j=0;j<4;j++){
    const k=(j+1)%4;panels.quad(lower[j],upper[j],upper[k],lower[k],'#3e548b');
  }

  // Straight-on SITE/DSFP photographs, 2025. Flat cut faces share a common
  // datum. Each return has thickness, including the inside wall of the heart.
  const factor=(height-base)/428;
  function facePoint(v:THREE.Vector2,d:number){
    return point((v.x-394)*factor,base+(505-v.y)*factor,d);
  }
  function cut(shape:THREE.Shape,back:number,front:number,face:string,edge:string){
    const {shape:outline,holes}=shape.extractPoints(10);
    const loops=[outline,...holes].map(r=>r.filter((v,i)=>!i||!v.equals(r[0])));
    const points=loops.flat();
    for(const [a,b,c] of THREE.ShapeUtils.triangulateShape(loops[0],loops.slice(1))){
      panels.triangle(facePoint(points[c],front),facePoint(points[b],front),facePoint(points[a],front),face);
      panels.triangle(facePoint(points[a],back),facePoint(points[b],back),facePoint(points[c],back),face);
    }
    for(const loop of loops){
      for(let i=0;i<loop.length;i++){
        const a=loop[i],b=loop[(i+1)%loop.length];
        panels.quad(facePoint(a,front),facePoint(b,front),facePoint(b,back),facePoint(a,back),edge);
      }
    }
  }
  const heart=new THREE.Shape();
  heart.moveTo(394,130);
  heart.bezierCurveTo(313,30,164,83,157,197);
  heart.bezierCurveTo(147,289,245,389,394,505);
  heart.bezierCurveTo(547,378,632,282,631,198);
  heart.bezierCurveTo(627,80,484,27,394,130);
  const opening=new THREE.Path();
  opening.moveTo(394,176);
  opening.bezierCurveTo(474,66,577,105,589,195);
  opening.bezierCurveTo(597,253,537,329,394,454);
  opening.bezierCurveTo(251,329,192,255,197,195);
  opening.bezierCurveTo(203,115,304,60,394,176);
  heart.holes.push(opening);
  const s=new THREE.Shape();
  s.moveTo(198,227);s.bezierCurveTo(198,150,159,120,105,120);
  s.bezierCurveTo(35,120,8,156,8,220);s.bezierCurveTo(8,270,46,305,109,353);
  s.bezierCurveTo(152,386,152,449,110,449);s.bezierCurveTo(80,449,72,426,72,391);
  s.lineTo(5,391);s.bezierCurveTo(5,470,39,505,106,505);
  s.bezierCurveTo(170,505,211,470,211,405);s.bezierCurveTo(211,338,179,312,117,262);
  s.bezierCurveTo(81,234,76,223,76,208);s.bezierCurveTo(76,166,135,162,135,227);s.closePath();
  const f=new THREE.Shape();
  const vertices=[[593,121],[765,121],[765,184],[660,184],[660,273],[761,273],[761,337],[660,337],[660,505],[593,505]];
  f.moveTo(vertices[0][0],vertices[0][1]);vertices.slice(1).forEach(([x,y])=>f.lineTo(x,y));f.closePath();
  for(const letter of [s,f]){
    cut(letter,-.19,-.095,'#b9cea7','#aabf9c');
    cut(letter,-.094,.012,'#aa93b1','#9987a6');
    cut(letter,.013,.098,'#eeece0','#d7d5ca');
  }
  cut(heart,.102,.269,'#b52b38','#8b2732');

  // Photograph 6 shows three rounded low purple seats, a mint back, timber
  // seat tops and a separate faceted mint planter in the Market tree band.
  function rounded(x:number,z:number,rx:number,rz:number,h:number,levels:number[][],inks:string[],cap:string,steps=22){
    const y=brick(x,z)+h*metre;
    const circle=(i:number,r:number,v:number):FacadePoint=>[x+metre*rx*r*Math.cos(i*2*Math.PI/steps),y+metre*v,z+metre*rz*r*Math.sin(i*2*Math.PI/steps)];
    for(let i=0;i<steps;i++){
      for(let k=1;k<levels.length;k++){
        const [a,l]=levels[k-1],[b,u]=levels[k];
        panels.quad(circle(i,a,l),circle(i,b,u),circle(i+1,b,u),circle(i+1,a,l),inks[k-1]);
      }
      const [r,top]=levels[levels.length-1];
      panels.triangle(circle(i+1,r,top),circle(i,r,top),[x,y+metre*top,z],cap);
    }
  }
  for(const [du,dz,r] of [[-.86,.10,.65],[.86,.10,.65],[0,-.42,.85]]){
    rounded(bench.x+du*metre,bench.z+dz*metre,r,r,.0,[[.92,0],[1,.07],[1,.40],[.99,.438]],['#695974','#796787','#b69b76'],'#bfa784');
  }
  rounded(bench.x,bench.z-.42*metre,.70,.62,.438,[[.96,0],[1,.39]],['#b0c6a0'],'#c0d2ae');
  rounded(pot.x,pot.z,.49,.49,0,[[.56,0],[1,.68],[.96,.73]],['#9ccab4','#b2d1be'],'#726d53',9);
  for(let k=0;k<19;k++){
    const a=k*2.39996,r=.11+.25*((k*13)%17)/17,h=.26+.29*((k*7)%11)/11;
    const x=pot.x+metre*r*Math.cos(a),z=pot.z+metre*r*Math.sin(a);
    const y=brick(pot.x,pot.z)+.69*metre;
    for(let j=0;j<3;j++){
      const b=a+j*2.094,tip:FacadePoint=[x+metre*.13*Math.cos(b),y+metre*h,z+metre*.13*Math.sin(b)];
      panels.triangle([x,y,z],[x+metre*.10*Math.sin(b),y+metre*h*.5,z-metre*.10*Math.cos(b)],tip,['#617b55','#708363','#819168'][j]);
    }
  }
  const model=panels.mesh(finish);model.name='Robert Frost Plaza · Heart SF and modular seating';
  model.geometry.userData.paintVertices=true;model.castShadow=true;model.receiveShadow=true;
  root.add(model);return model;
}
