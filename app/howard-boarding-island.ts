import * as THREE from 'three';
import {StreetAssembly} from './street-amenities.ts';
import {setPackedNormals} from './packed-normals.ts';

// 2024 SF orthophoto, 12 px/m, Spear at (300,1400). Drawing the 50 ft
// legislated zone as an unbroken 50 ft slab would cover the crosswalk.
// Brett Norman's Dec 2022 Howard approach/reverse photos show the dark ramp,
// yellow warning, red stenciled curb and two white posts at the parking end.
// https://www.sfmta.com/media/20182/download?inline=
const C=.988686,S=.150004,road=.031;
export const howardBoardingDeckY=road+.1524*.06;
function point(u:number,v:number,y:number){
  const x=(u-300)/200,z=(v-1400)/200;
  return new THREE.Vector3(-25.894+C*x+S*z,y,-12.65-S*x+C*z);
}
function rampY(v:number){
  return THREE.MathUtils.lerp(road+.00012,howardBoardingDeckY,THREE.MathUtils.clamp((v-1563.4)/26.2,0,1));
}
export function howardBoardingPoint(u:number,v:number){return point(u,v,rampY(v));}

export function addHowardBoardingIsland(root:THREE.Group){
  const a=new StreetAssembly(),pos:number[]=[],rgb:number[]=[],ix:number[]=[];
  const concrete='#c5c1b5',edge='#d1cbbb',side='#aca99e',red='#9d5353',yellow='#caa343',dark='#777875';
  function face(corners:THREE.Vector3[],ink:string){
    const start=pos.length/3,color=new THREE.Color(ink);
    corners.forEach(p=>{pos.push(p.x,p.y,p.z);rgb.push(color.r,color.g,color.b);});
    ix.push(start,start+1,start+2);if(corners.length===4)ix.push(start,start+2,start+3);
  }
  // v, traffic-side toe, bike-side toe, surface of the central access ramp.
  // The narrower west tip fits beside the continuous bike bypass and lets
  // the end concrete wings flatten toward the crossing.
  const sections=[
    [1563.4,352.7,382.0],[1565.8,350.8,383.2],[1572.6,350.6,383.5],
    [1589.6,350.5,387.0],[1590.2,350.5,387.0],[1634.0,350.6,387.6],
    [1634.4,350.6,387.6],[1678,350.9,388.1],[1678.4,350.9,388.1],
    [1729,351.0,388.1],[1732.5,351.7,387.8],[1735.3,354.1,385.3],
  ];
  const rim=(v:number)=>Math.min(howardBoardingDeckY,rampY(v)+Math.min(.0025,(v-1563.4)*.00035));
  function cross([v,l,r]:number[]){
    return [point(l,v,rim(v)),point(l+1.85,v,rim(v)),point(l+3.10,v,rampY(v)),
      point(r-2.05,v,rampY(v)),point(r,v,rim(v))];
  }
  function down(p:THREE.Vector3){return new THREE.Vector3(p.x,road-.00003,p.z);}
  for(let i=1;i<sections.length;i++){
    const prev=cross(sections[i-1]),next=cross(sections[i]);
    const v=sections[i][0],joint=v===1590.2||v===1634.4||v===1678.4;
    const middle=v<=1565.8?edge:v<=1572.6?yellow:v<=1589.6?dark:joint?'#9b9a91':concrete;
    for(const [j,tone] of [red,edge,middle,edge].entries())face([prev[j],next[j],next[j+1],prev[j+1]],tone);
    face([down(prev[0]),down(next[0]),next[0],prev[0]],red);
    face([down(next[4]),down(prev[4]),prev[4],next[4]],side);
    if(i===1||i===sections.length-1){
      const arr=i===1?prev:next;
      for(let j=0;j<4;j++){
        const quad=[down(arr[j]),arr[j],arr[j+1],down(arr[j+1])];
        face(i===1?quad:quad.reverse(),side);
      }
    }
  }
  // A compact cap on the sunward side of each detectable warning dome keeps
  // the tactile surface legible without a separate textured material.
  for(let col=0;col<35;col++)for(let row=0;row<8;row++){
    const u=354.35+col*.76,v=1566.22+row*.83;
    face([point(u-.145,v-.14,rampY(v-.14)+.000035),point(u,v+.16,rampY(v+.16)+.00016),
      point(u+.145,v-.14,rampY(v-.14)+.000035)],'#dcb65c');
  }
  const geom=new THREE.BufferGeometry();
  geom.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geom.setAttribute('color',new THREE.Float32BufferAttribute(rgb,3));geom.setIndex(ix);setPackedNormals(geom);
  geom.userData.paintVertices=true;a.add(geom,'#ffffff',0,0,0);

  // The stencil reads from the vehicle lane. Its baseline follows the curb;
  // the lettering lies on the red top course, clear of the boarding surface.
  const label=point(351.35,1659,howardBoardingDeckY+.00016);
  a.label('BUS STOP - TOW AWAY',label.x,label.y,label.z,.0048,'#e0d8c4');
  a.parts[a.parts.length-1].rotation.set(-Math.PI/2,0,Math.atan2(-C,S),'YXZ');
  for(const u of [354.4,384.9]){
    const p=point(u,1730.2,howardBoardingDeckY);
    for(const [lo,hi,r,tone] of [[0,.045,.095,'#adaea3'],[.045,.82,.043,'#dddcd0'],[.82,.92,.043,'#f0eee0']] as const){
      a.add(new THREE.CylinderGeometry(r*.06,r*.06,(hi-lo)*.06,8),tone,p.x,p.y+(lo+hi)*.03,p.z);
    }
  }
  const mesh=a.bake('Howard at Spear boarding island');mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);
  return mesh;
}
