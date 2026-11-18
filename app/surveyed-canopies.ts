import * as THREE from 'three';
import envelopes from '../public/data/plaza-canopies.json' with {type:'json'};

// Centimetres per metre of tree height. The anchors and independently estimated
// heights are in plaza-survey.json. Each connected surface retains the voids
// supported by 2023 USGS multi-return canopy observations.
const records:Record<string,string[]>=envelopes;
const templates=Object.keys(records).map(Number).filter(id=>id<0).sort((a,b)=>a-b);
const cache=new Map<number,{points:THREE.Vector3[];faces:Uint16Array;normals:Int8Array;density:Uint8Array}>();
const bytes=(base64:string)=>Uint8Array.from(atob(base64),v=>v.charCodeAt(0));

export function observedCanopy(id:number,plane:boolean){
  let source=records[id]?id:undefined;
  if(source===undefined&&plane&&templates.length){
    source=id<=-870100&&id>=-870125
      ?templates.filter(n=>(n-id)%2===0).reduce((a,b)=>Math.abs(a-id)<=Math.abs(b-id)?a:b)
      :templates[Math.abs(id)%templates.length];
  }
  if(source===undefined)return;
  let shape=cache.get(source);
  if(!shape){
    const [vertices,indices,directions,density]=records[source],values=new Int8Array(bytes(vertices).buffer),points=[];
    for(let i=0;i<values.length;i+=3)points.push(new THREE.Vector3(values[i]/100,values[i+1]/100,values[i+2]/100));
    shape={points,faces:new Uint16Array(bytes(indices).buffer),normals:new Int8Array(bytes(directions).buffer),density:bytes(density)};cache.set(source,shape);
  }
  return {source,...shape};
}
