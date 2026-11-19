import * as THREE from 'three';
import {StreetAssembly} from './street-amenities.ts';
import {patioFurniture} from './hotel-terraces.ts';

const oval=new THREE.SphereGeometry(1,7,4);
const up=new THREE.Vector3(0,1,0);
type Joint=[number,number,number];

function segment(a:StreetAssembly,start:Joint,end:Joint,width:number,color:string){
  const from=new THREE.Vector3(...start),to=new THREE.Vector3(...end);
  const center=from.clone().lerp(to,.5),direction=to.sub(from);
  const rod=a.box(center.x,center.y,center.z,width,direction.length(),width,color);
  rod.quaternion.setFromUnitVectors(up,direction.normalize());
}

function seatedFigure(coat:string,skin:string,cup:boolean){
  const figure=new THREE.Group(),body=new StreetAssembly(),head=new StreetAssembly();
  body.add(oval,coat,0,.722,-.045).scale.set(.191,.232,.137);
  for(const side of [-1,1]){
    const hip:Joint=[.084*side,.556,-.013],knee:Joint=[side*.103,.493,.31],ankle:Joint=[side*.106,.11,.293];
    segment(body,hip,knee,.128,'#51595c');segment(body,knee,ankle,.109,'#535b61');
    body.box(ankle[0],.064,.344,.13,.108,.227,'#504b45');
    const elbow:Joint=[side*.179,.709,.147];
    segment(body,[side*.145,.868,-.024],elbow,.097,coat);
    if(cup&&side===1)continue;
    segment(body,elbow,[side*.101,.698,.264],.079,coat);
    body.add(oval,skin,side*.089,.697,.272).scale.set(.050,.036,.047);
  }
  head.add(oval,skin,0,.014,0).scale.set(.106,.130,.099);
  head.add(oval,cup?'#614a39':'#423b39',0,.085,-.012).scale.set(.108,.069,.101);
  const face=head.bake('Diner head');face.position.set(0,1.012,-.026);
  figure.add(body.bake('Seated diner'),face);
  if(!cup)return {figure,face};
  const sleeve=new StreetAssembly();
  segment(sleeve,[0,0,0],[-.055,.069,.241],.083,coat);
  sleeve.add(oval,skin,-.06,.077,.249).scale.set(.049,.045,.041);
  sleeve.add(new THREE.CylinderGeometry(.037,.031,.093,9),'#a5b7b4',-.092,.087,.260);
  const forearm=sleeve.bake('Hand holding a tumbler');forearm.position.set(.179,.709,.147);
  figure.add(forearm);return {figure,face,forearm};
}

/** Both seats, table and people use the same furniture coordinate frame. */
export function terreneDiners(){
  const root=new THREE.Group();root.name='Terrene patio diners';
  const table=patioFurniture.positions[3];
  root.position.set(table[0],patioFurniture.ground,table[1]);root.scale.setScalar(.06);root.rotation.y=patioFurniture.yaw;
  const guest=seatedFigure('#527277','#b58b73',true),friend=seatedFigure('#ae7563','#b99078',false);
  guest.figure.position.z=-patioFurniture.chairOffset;
  friend.figure.position.z=patioFurniture.chairOffset;friend.figure.rotation.y=Math.PI;
  root.add(guest.figure,friend.figure);
  function update(elapsed:number,localMinutes:number,sheltered:boolean){
    root.visible=localMinutes>=420&&localMinutes<1320&&!sheltered;
    if(!root.visible)return;
    const phase=elapsed%28;
    const sip=THREE.MathUtils.smoothstep(phase,4,5.6)*(1-THREE.MathUtils.smoothstep(phase,6.5,8.2));
    guest.forearm!.rotation.x=-1.30*sip;
    guest.face.rotation.x=.12*sip;friend.face.rotation.y=.18*Math.sin(elapsed*.57);
    friend.face.rotation.x=.08*Math.sin(elapsed*2.1)*THREE.MathUtils.smoothstep(phase,10,11)*(1-THREE.MathUtils.smoothstep(phase,13,15));
  }
  return {root,update};
}
