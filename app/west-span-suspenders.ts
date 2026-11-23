import * as THREE from 'three';
import {bridgeLayout} from './bridge-layout.ts';
import {addBayLightStrand} from './bay-lights.ts';
import {westMainCableRadius,westTowerCableX} from './west-span-towers.ts';

type MeshFactory=(shape:THREE.BufferGeometry,color:string,x:number,y:number,z:number,parent:THREE.Group)=>THREE.Mesh;
const ropeRadius=2.25*.0254*.06/2;
const shaftSpacing=.015;
const tread=bridgeLayout.upperDeck+.0755+.015;
export const westMainSag=9.55-(tread+1.42*.06);
const saddle=9.55,anchorage=4.85;
const [w2,w3,w5,w6]=bridgeLayout.towers;
const spans=[
  [15.64,w2,anchorage,saddle,38],[w2,w3,saddle,saddle,75],[w3,bridgeLayout.anchor,saddle,anchorage,38],
  [bridgeLayout.anchor,w5,anchorage,saddle,38],[w5,w6,saddle,saddle,75],[w6,bridgeLayout.length,saddle,anchorage,44]
];

// HAER CA-32, pp. 15–23 and Deras photographs 182–184. Two ropes loop over
// each band. Their four vertical legs enter sockets in the deck-edge tread.
export function addWestSpanSuspenders(bridge:THREE.Group,mesh:MeshFactory){
  const emitters:number[]=[];
  const rod=new THREE.CylinderGeometry(1,1,1,4,1,true);
  const collar=new THREE.CylinderGeometry(1,1,1,8,1,true).rotateX(Math.PI/2);
  for(const side of [-1,1])for(const [from,to,ya,yb,count] of spans){
    const x=side*westTowerCableX, main=ya===yb,sag=main?westMainSag:1.65;
    const level=(t:number)=>ya+(yb-ya)*t-4*sag*t*(1-t);
    const slope=(t:number)=>(yb-ya-4*sag*(1-2*t))/(to-from);
    const path=(lift:number)=>{
      const samples=Array.from({length:33},(_,i)=>new THREE.Vector3(x,level(i/32)+lift,THREE.MathUtils.lerp(from,to,i/32)));
      return new THREE.CatmullRomCurve3(samples);
    };
    const cable=mesh(new THREE.TubeGeometry(path(0),64,westMainCableRadius,8,false),'#8e9d9d',0,0,0,bridge);
    cable.name='Wrapped main cable';
    const handwire=new THREE.TubeGeometry(path(.059),48,.0015,4,false);
    for(const edge of [-1,1])mesh(handwire,'#859492',edge*.014,0,0,bridge).name='Cable maintenance handrope';

    // Build the small repeating steelwork directly in indexed sections. Separate
    // sections retain spatial culling on both the waterfront and the passenger ride.
    const lowStation=Math.max(1,Math.min(count,Math.round((.5-(yb-ya)/(8*sag))*(count+1))));
    for(let first=1;first<=count;first+=10){
      const pos:number[]=[],normal:number[]=[],indices:number[]=[],pigments:number[]=[];
      const centerZ=from+(to-from)*Math.min(count,first+4.5)/(count+1);
      function tube(shape:THREE.BufferGeometry,cx:number,cy:number,cz:number,rx:number,ry:number,rz:number,angle:number,tone:number){
        const vertices=shape.getAttribute('position'),normals=shape.getAttribute('normal'),start=pos.length/3;
        const cos=Math.cos(angle),sin=Math.sin(angle);
        for(let j=0;j<vertices.count;j++){
          const y=vertices.getY(j)*ry,z=vertices.getZ(j)*rz;
          pos.push(cx+vertices.getX(j)*rx,cy+y*cos-z*sin,cz+y*sin+z*cos);
          const ny=normals.getY(j),nz=normals.getZ(j);
          normal.push(normals.getX(j),ny*cos-nz*sin,ny*sin+nz*cos);
          pigments.push(tone,tone,tone);
        }
        const index=shape.getIndex()!;
        for(let j=0;j<index.count;j++)indices.push(start+index.getX(j));
      }
      for(let i=first;i<=Math.min(count,first+9);i++){
        const t=i/(count+1),z=from+(to-from)*t,top=level(t),dz=z-centerZ;
        const angle=-Math.atan(slope(t));
        const radius=westMainCableRadius+.0038;
        tube(collar,0,top,dz,radius,radius,.064,angle,.82);
        const rigid=!main&&i===lowStation;
        for(const edge of [-1,1])for(const leg of [-1,1]){
          const deltaZ=leg*shaftSpacing;
          const upper=top+slope(t)*deltaZ;
          const h=upper-tread,legX=edge*westMainCableRadius;
          // The eight shortest side-span connections use rigid steel suspenders.
          const diameter=rigid?.0042:ropeRadius;
          tube(rod,legX,(upper+tread)/2,dz+deltaZ,diameter,h,diameter,0,rigid?.82:1);
          tube(rod,legX,tread+.012,dz+deltaZ,.0039,.024,.0039,0,.83);
        }
        if(i%4===0){
          for(const edge of [-1,1])tube(rod,edge*.014,top+.037,dz,.0016,.044,.0016,0,.91);
        }
        addBayLightStrand(emitters,x+side*westMainCableRadius,z+shaftSpacing,top+slope(t)*shaftSpacing);
      }
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
      geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normal,3));
      geometry.setAttribute('color',new THREE.Float32BufferAttribute(pigments,3));
      geometry.setIndex(indices);geometry.userData.paintVertices=true;
      mesh(geometry,'#a0adac',x,0,centerZ,bridge).name='Cable bands and four-legged suspenders';
    }
  }
  rod.dispose();collar.dispose();
  return emitters;
}
