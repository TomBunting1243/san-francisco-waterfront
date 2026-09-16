import * as THREE from 'three';
import rawMap from '../public/data/sf-waterfront.json' with {type:'json'};
type Point=number[];
type Building={id:number;name:string;p:Point[];h:number;glass:boolean;measured:boolean;minH?:number;part?:boolean;parent?:number;roof?:string;material?:string};
export const sfMap=rawMap as {buildings:Building[];roads:{name:string;p:Point[];kind:string}[];parks:{name:string;p:Point[]}[];piers:{name:string;p:Point[];closed:boolean}[];coasts:Point[][];art:{name:string;p:Point}[]};
export const polygonArea=(ps:Point[])=>Math.abs(ps.reduce((sum,p,i)=>sum+p[0]*ps[(i+1)%ps.length][1]-ps[(i+1)%ps.length][0]*p[1],0))/2;
export function footprintGeometry(ps:Point[],height:number){
  const shape=new THREE.Shape();ps.forEach(([x,z],i)=>{if(i===0)shape.moveTo(x,-z);else shape.lineTo(x,-z);});shape.closePath();
  const geo=new THREE.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false});geo.rotateX(-Math.PI/2);return geo;
}
export function center(ps:Point[]){return [ps.reduce((sum,p)=>sum+p[0],0)/ps.length,ps.reduce((sum,p)=>sum+p[1],0)/ps.length];}
export const mappedBuildings=sfMap.buildings.filter(b=>{const [x,z]=center(b.p);return polygonArea(b.p)>(b.part?.08:1.2)&&x>-95&&x<72&&z>-112&&z<26;});
