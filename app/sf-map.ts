import * as THREE from 'three';
import {steuartHotelRoof} from './steuart-hotel-shell.ts';
import rawMap from '../public/data/sf-waterfront.json' with {type:'json'};
type Point=number[];
type Building={id:number;name:string;p:Point[];h:number;glass:boolean;measured:boolean;minH?:number;part?:boolean;parent?:number;roof?:string;material?:string};
export const sfMap={...rawMap} as {buildings:Building[];roads:{name:string;p:Point[];kind:string}[];parks:{name:string;p:Point[]}[];piers:{name:string;p:Point[];closed:boolean}[];coasts:Point[][];art:{name:string;p:Point}[]};
// USGS CA_SanFrancisco_1_B23 resolves the private frontage behind the
// Howard tree rows. Both faces of 211 Main have the same offset. The Folger
// warehouse party wall stays fixed, and the 201 Spear tower and podium keep
// their shared Howard face and the sawtooth profile above the corner store.
const spearFamily=new Set([288645263,1550628439,1550628438]);
sfMap.buildings=sfMap.buildings.map(b=>{
  const hotelRoof=steuartHotelRoof(b.id);
  if(hotelRoof!==undefined)return {...b,h:hotelRoof,measured:true};
  if(b.id!==192305909&&b.id!==154217696&&!spearFamily.has(b.id))return b;
  const p=b.p.map(([x,z])=>{
    const u=.988686*(x+25.894)-.150004*(z+12.650);
    let shift=-.079;
    if(b.id===192305909)shift=u>-.56?-.65-u:0;
    if(spearFamily.has(b.id))shift=-.100*Math.max(0,Math.min(1,(u+1.20)/.47));
    return [x+.988686*shift,z-.150004*shift];
  });
  return {...b,p};
});
export const polygonArea=(ps:Point[])=>Math.abs(ps.reduce((sum,p,i)=>sum+p[0]*ps[(i+1)%ps.length][1]-ps[(i+1)%ps.length][0]*p[1],0))/2;
export function footprintGeometry(ps:Point[],height:number){
  const shape=new THREE.Shape();ps.forEach(([x,z],i)=>{if(i===0)shape.moveTo(x,-z);else shape.lineTo(x,-z);});shape.closePath();
  const geo=new THREE.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false});geo.rotateX(-Math.PI/2);return geo;
}
export function center(ps:Point[]){return [ps.reduce((sum,p)=>sum+p[0],0)/ps.length,ps.reduce((sum,p)=>sum+p[1],0)/ps.length];}
export const mappedBuildings=sfMap.buildings.filter(b=>{const [x,z]=center(b.p);return polygonArea(b.p)>(b.part?.08:1.2)&&x>-95&&x<72&&z>-112&&z<26;});
