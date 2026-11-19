import * as THREE from 'three';
import type {ApproachMesh} from './approach-road.ts';
import {extraBillboardAds,renderBillboardEdition} from './billboard-editions.ts';
import {renderKioskCampaign} from './kiosk-campaigns.ts';

// SmithGroup elevations and service-side configurations, sheets 28–30:
// https://sfplanning.s3.amazonaws.com/commissions/hpcpackets/2017-009220COAPTA.pdf
// Local +Z is the first commercial panel's outward normal. Units are .06/m.
const width=.0744,height=width*340/132,low=.034,high=low+height;
const step=Math.PI*2/3,steelFaceDepth=.037;
type Site={name:string;x:number;z:number;footY:number;yaw:number;kind:'column'|'vending';style?:string};
type Row=readonly [y:number,scale:number,paint:string];
const modernRows:Row[]=[
  [0,.90,'#778488'],[.009,.918,'#a5b1b0'],[.023,.955,'#6e797e'],[low,1,'#899497'],
  [high,1,'#59696e'],[high+.002,.999,'#afbab9'],[.27432,.932,'#afbabb'],
];
const historicRows:Row[]=[
  [0,1.045,'#374b43'],[.009,1.045,'#657063'],[.013,.976,'#354c43'],[.025,.964,'#536454'],[low,1,'#375146'],
  [high,1,'#806f4c'],[high+.005,1.042,'#4b6254'],[.238,1.082,'#687161'],[.244,1.082,'#3f584d'],
  [.249,1.01,'#596a59'],[.262,.983,'#3a5147'],[.287,.71,'#536457'],[.301,.32,'#526559'],
  [.305,.13,'#9c8656'],[.31,.09,'#536552'],[.315,.104,'#a18d62'],[.319,.006,'#a18d62'],
];

function displayPoint(x:number,y:number,scale:number,historic:boolean){
  if(historic){
    const radius=.046,angle=x/radius;
    return new THREE.Vector3(Math.sin(angle)*radius*scale,y,Math.cos(angle)*radius*scale);
  }
  return new THREE.Vector3(x*scale,y,steelFaceDepth*scale);
}
function rotate(p:THREE.Vector3,angle:number){
  const x=p.x,z=p.z;
  return p.set(x*Math.cos(angle)+z*Math.sin(angle),p.y,-x*Math.sin(angle)+z*Math.cos(angle));
}

function cabinet(historic:boolean){
  const positions:number[]=[],colors:number[]=[];
  const rows=historic?historicRows:modernRows;
  const half=width/2,rim=historic?.0038:.006;
  const segments=historic?8:1;
  function triangle(a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3,color:THREE.Color){
    for(const p of [a,b,c]){positions.push(p.x,p.y,p.z);colors.push(color.r,color.g,color.b);}
  }
  function strip(a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3,d:THREE.Vector3,color:THREE.Color){
    triangle(a,b,d,color);triangle(b,c,d,color);
  }
  for(let side=0;side<3;side++){
    const angle=step*side;
    const edge=(x:number,row:Row)=>rotate(displayPoint(x,row[0],row[1],historic),angle);
    function corner(t:number,row:Row){
      const a=displayPoint(half+rim,row[0],row[1],historic);
      if(historic){
        const q=Math.atan2(a.x,a.z);
        return rotate(new THREE.Vector3(0,row[0],.046*row[1]),angle+q+(step-2*q)*t);
      }
      const b=rotate(displayPoint(-half-rim,row[0],row[1],false),step);
      const control=new THREE.Vector3(Math.sqrt(3)*a.z,row[0],a.z);
      return rotate(a.multiplyScalar((1-t)**2).addScaledVector(control,2*t*(1-t)).addScaledVector(b,t*t),angle);
    }
    for(let j=0;j<rows.length-1;j++){
      const a=rows[j],b=rows[j+1],paint=new THREE.Color(a[2]);
      const bounds=[-half-rim,...Array.from({length:segments+1},(_,i)=>-half+width*i/segments),half+rim];
      for(let k=1;k<bounds.length;k++){
        // The frame borders the opening. There is no second skin behind a print.
        if(a[0]===low&&k>1&&k<bounds.length-1)continue;
        strip(edge(bounds[k-1],a),edge(bounds[k],a),edge(bounds[k],b),edge(bounds[k-1],b),paint);
      }
      for(let k=0;k<3;k++)strip(corner(k/3,a),corner((k+1)/3,a),corner((k+1)/3,b),corner(k/3,b),paint);
    }
    const top=rows[rows.length-1],center=new THREE.Vector3(0,top[0],0),paint=new THREE.Color(top[2]);
    const boundary=[edge(-half-rim,top),...Array.from({length:segments+1},(_,i)=>edge(-half+width*i/segments,top)),
      ...Array.from({length:4},(_,i)=>corner(i/3,top))];
    for(let k=1;k<boundary.length;k++)triangle(center,boundary[k-1],boundary[k],paint);
  }
  const g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3))
    .setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  g.computeVertexNormals();g.userData.paintVertices=true;return g;
}
const housings=new Map<boolean,THREE.BufferGeometry>();

function fitSurface(front:THREE.Mesh,w:number,h:number,y:number,historic:boolean,cropServiceArt=false){
  // Reuse the packed artwork's exact crop on the curved Morris-column glazing.
  const original=front.geometry.getAttribute('uv');
  const geo=new THREE.PlaneGeometry(w,h,historic?8:1,1);
  const uv=geo.getAttribute('uv'),pos=geo.getAttribute('position');
  const left=original.getX(0),right=original.getX(1);
  const v0=original.getY(0),v1=original.getY(2);
  // The shallow service panel carries the skyline detail at its original aspect.
  const top=cropServiceArt?THREE.MathUtils.lerp(v0,v1,.225):v0;
  const bottom=cropServiceArt?THREE.MathUtils.lerp(v0,v1,.625):v1;
  for(let i=0;i<uv.count;i++){
    const p=displayPoint(pos.getX(i),y+pos.getY(i),1,historic);
    pos.setXYZ(i,p.x,p.y,p.z);
    uv.setXY(i,THREE.MathUtils.lerp(left,right,uv.getX(i)),THREE.MathUtils.lerp(bottom,top,uv.getY(i)));
  }
  for(const name of ['billboardPrint','kioskPrint'])if(front.geometry.hasAttribute(name))geo.setAttribute(name,uv);
  geo.computeVertexNormals();front.geometry=geo;front.position.set(0,0,0);
}

export function addWaterfrontKiosk(mesh:ApproachMesh,root:THREE.Group,site:Site,ads:readonly [string,string]){
  const group=new THREE.Group();group.name=site.name;
  group.position.set(site.x,site.footY,site.z);group.rotation.y=site.yaw;
  group.userData.location=site;group.userData.artwork=ads[0];group.userData.commercialFaces=[...ads];root.add(group);
  const historic=site.style==='historic';
  if(!housings.has(historic))housings.set(historic,cabinet(historic));
  mesh(housings.get(historic)!,'#ffffff',0,0,0,group).name=historic?'Enamel column with domed cornice':'Rounded stainless steel kiosk housing';
  for(const [i,id] of [...ads,'civic'].entries()){
    const face=new THREE.Group();face.rotation.y=i*step;
    face.name=i<2?'Commercial display '+(i+1):'Public service face';face.userData.artwork=id;group.add(face);
    const vending=i===2&&site.kind==='vending';
    const h=vending?height*.40:height;
    const print=(extraBillboardAds as readonly string[]).includes(id)
      ?renderBillboardEdition(id,width,h,face,mesh,true):renderKioskCampaign(id,width,h,face,mesh);
    fitSurface(print,width,h,high-h/2,historic,vending);
    if(vending){
      // Closed lower French doors and the smaller public-service space above.
      const cuts=[-width/2,...(historic?[-3*width/8,-width/4,-width/8]:[]),-.00065,0,.00065,
        ...(historic?[width/8,width/4,3*width/8]:[]),width/2];
      const points:number[]=[],colors:number[]=[],indices:number[]=[];
      for(let k=1;k<cuts.length;k++){
        const paint=new THREE.Color(cuts[k-1]>=-.00065&&cuts[k]<=.00065?'#566260':'#838e8b'),i=points.length/3;
        for(const [x,y] of [[cuts[k-1],low],[cuts[k],low],[cuts[k],high-h],[cuts[k-1],high-h]]){
          const p=historic&&Math.abs(x)===.00065
            ?displayPoint(0,y,1,true).lerp(displayPoint(Math.sign(x)*width/8,y,1,true),Math.abs(x)*8/width)
            :displayPoint(x,y,1,historic);
          points.push(p.x,p.y,p.z);colors.push(paint.r,paint.g,paint.b);
        }
        indices.push(i,i+1,i+2,i,i+2,i+3);
      }
      const doors=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(points,3))
        .setAttribute('color',new THREE.Float32BufferAttribute(colors,3)).setIndex(indices);
      doors.computeVertexNormals();doors.userData.paintVertices=true;
      mesh(doors,'#ffffff',0,0,0,face).name='Closed vending doors';
    }
  }
  return group;
}
