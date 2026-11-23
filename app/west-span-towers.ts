import * as THREE from 'three';
import {bridgeLayout} from './bridge-layout.ts';

type MeshFactory=(shape:THREE.BufferGeometry,color:string,x:number,y:number,z:number,parent:THREE.Group)=>THREE.Mesh;
export const westTowerCableX=66*.3048*.06/2;
export const westMainCableRadius=.0219; // 0.73 m finished diameter at model scale.
const baseY=.73,saddleY=9.55;
function axis(y:number){
  return THREE.MathUtils.lerp(83*.3048*.06/2,westTowerCableX,(y-baseY)/(saddleY-baseY));
}

// HAER CA-32 pp.18–20: battered cruciform columns; two braced bays below the
// deck, three above, and an open gallery. Frank Deras Jr., May 1998, plate 181:
// https://www.loc.gov/resource/hhh.ca1352.photos.201687p
// https://tile.loc.gov/storage-services/master/pnp/habshaer/ca/ca1300/ca1352/data/ca1352data.pdf
function column(side:number){
  // One continuous stepped outline rather than intersecting facade plates.
  const outline=[[-.55,-1],[.55,-1],[.55,-.54],[1,-.54],[1,.54],[.55,.54],
    [.55,1],[-.55,1],[-.55,.54],[-1,.54],[-1,-.54],[-.55,-.54]];
  const sections=[[baseY,.183,.274],[3.42,.086,.234],[4.55,.077,.211],[9.37,.072,.18]];
  const vertices:number[]=[];
  function triangle(a:number[],b:number[],c:number[]){vertices.push(...a,...b,...c);}
  const rings=sections.map(([y,w,d])=>outline.map(([x,z])=>[side*axis(y)+w*x,y,d*z]));
  for(let j=1;j<rings.length;j++){
    const a=rings[j-1],b=rings[j];
    for(let i=0;i<a.length;i++){
      const k=(i+1)%a.length;
      triangle(a[i],b[i],a[k]);triangle(a[k],b[i],b[k]);
    }
  }
  // The first and final rings meet solid steel/concrete bearings.
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.computeVertexNormals();return g;
}

function crossedWeb(bottom:number,top:number,depth:number){
  // A single extruded X silhouette with a broad gusset at the intersection.
  // This avoids a doubled plate surface where separate diagonal bars would meet.
  const outline=[[-1,0],[-1,.14],[-.12,.50],[-1,.86],[-1,1],[-.84,1],[0,.59],
    [.84,1],[1,1],[1,.86],[.12,.50],[1,.14],[1,0],[.84,0],[0,.41],[-.84,0]];
  const shape=new THREE.Shape(outline.map(([x,t])=>{
    const y=THREE.MathUtils.lerp(bottom,top,t);
    return new THREE.Vector2(x*(axis(y)-.035),y);
  }));
  return new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false}).translate(0,0,-depth/2);
}

export function addWestSpanTowers(bridge:THREE.Group,mesh:MeshFactory){
  const cube=new THREE.BoxGeometry(1,1,1),legs=[column(-1),column(1)];
  const bays=[[1.00,2.18],[2.20,3.43],[4.63,6.13],[6.15,7.62],[7.64,9.06]];
  const webs=bays.map(([a,b])=>crossedWeb(a,b,.196));
  for(const z of bridgeLayout.towers){
    const group=new THREE.Group();group.position.z=z;group.name='West span suspension tower';bridge.add(group);
    function box(name:string,w:number,h:number,d:number,x:number,y:number,color:string){
      const part=mesh(cube,color,x,y,0,group);part.scale.set(w,h,d);part.name=name;
    }
    // Retain the existing shared caisson and cap datum.
    box('Caisson',2.3,1.25,1.45,0,-.05,'#b2b8b1');
    box('Caisson cap',2.42,.16,1.57,0,.65,'#c2c5b9');
    legs.forEach(g=>{mesh(g,'#a5b5b4',0,0,0,group).name='Battered cruciform leg';});
    for(const g of webs)mesh(g,'#98abae',0,0,0,group).name='Plate-faced X brace';
    box('Base strut',1.46,.14,.29,0,.92,'#91a5a7');
    box('Lower deck support strut',1.40,.09,.30,0,bridgeLayout.lowerDeck-.11,'#91a5a7');
    box('Upper deck support strut',1.38,.075,.30,0,bridgeLayout.upperDeck-.11,'#91a5a7');
    box('Gallery floor strut',1.32,.12,.34,0,9.12,'#a9b8b6');
    box('Gallery lintel',1.21,.06,.22,0,9.46,'#b4c1bd');
    for(const x of [-.295,0,.295]){
      const top=x===0?9.60:9.432;
      box('Gallery upright',x===0?.083:.046,top-9.18,.17,x,(top+9.18)/2,'#a7b8b6');
    }
    for(const side of [-1,1]){
      // Top of bearing touches the lower surface of the modeled main cable.
      box('Cable saddle bearing',.164,.16,.36,side*westTowerCableX,saddleY-westMainCableRadius-.08,'#96a9a9');
    }
  }
}
