import * as THREE from 'three';
import {StreetAssembly} from './street-amenities.ts';

// The operator's camera passes within a metre of this rider. Shape the coat,
// jaw, cuffs and cap in the same four rigid pieces as the walking figure.
export function transitPassenger(outfit:'brimmed cap'|'canvas tote'){
  const root=new THREE.Group(),torso=new StreetAssembly(),legs=new StreetAssembly(),arm=new StreetAssembly();
  const tote=outfit==='canvas tote';
  const coat=tote?'#4f7474':'#946e50',skin=tote?'#aa7759':'#bd906d',wool=tote?'#413735':'#564941',up=new THREE.Vector3(0,1,0);
  function rings(a:StreetAssembly,profile:number[][],depth:number,ink:string,x:number,y:number,z:number,n=8){
    const g=new THREE.LatheGeometry(profile.map(([radius,height])=>new THREE.Vector2(radius,height)),n);
    a.add(g.scale(1,1,depth),ink,x,y,z);
  }
  function sleeve(a:StreetAssembly,from:number[],to:number[],r0:number,r1:number){
    const start=new THREE.Vector3(...from),axis=new THREE.Vector3(...to).sub(start),mid=start.addScaledVector(axis,.5);
    const mesh=a.add(new THREE.CylinderGeometry(r1,r0,axis.length(),6,1,true),coat,mid.x,mid.y,mid.z);
    mesh.quaternion.setFromUnitVectors(up,axis.normalize());
  }
  function oval(a:StreetAssembly,x:number,y:number,z:number,w:number,h:number,d:number,ink:string){
    a.add(new THREE.SphereGeometry(1,6,3).scale(w,h,d),ink,x,y,z);
  }
  rings(torso,[[.143,.78],[.177,.89],[.185,1.20],[.212,1.285],[.088,1.36]],.69,coat,0,0,0);
  rings(torso,[[.082,1.332],[.076,1.425]],.88,'#89684f',0,0,0);
  rings(torso,[[.046,1.399],[.087,1.433],[.111,1.516],[.106,1.606],[.068,1.642]],.90,skin,0,0,.006);
  rings(torso,[[.111,1.563],[.116,1.593],[.091,1.647],[0,1.671]],1.02,wool,0,0,-.003);
  if(tote){
    oval(torso,0,1.526,-.092,.077,.076,.061,wool);
    // A canvas shopper hangs from the right hand with a folded map tucked inside.
    for(const z of [-.058,.085])torso.box(.222,.772,z,.018,.161,.015,'#bdac87').rotation.x=z>0?-.20:.20;
    torso.box(.225,.565,.015,.110,.295,.273,'#c6b995').rotation.z=.035;
    torso.box(.224,.706,.017,.088,.008,.244,'#837961');
    torso.box(.211,.717,-.022,.024,.072,.131,'#d5ccaf').rotation.x=-.13;
    torso.box(.232,.442,.012,.110,.043,.261,'#a39b80');
  }else oval(torso,0,1.581,.081,.114,.019,.079,'#4a423c');
  // Just a nose plane and the shadow below the cap at this scale.
  torso.add(new THREE.ConeGeometry(.025,.067,4),'#b78967',0,1.512,.108).rotation.x=.29;
  for(const side of [-1,1])torso.add(new THREE.PlaneGeometry(.025,.005),'#725e50',side*.047,1.544,.095).rotation.y=side*.34;
  sleeve(torso,[.171,1.29,0],[.215,1.068,.012],.077,.056);
  sleeve(torso,[.215,1.068,.012],[.206,.884,.055],.056,.041);
  oval(torso,.206,.866,.060,.038,.055,.042,skin);
  sleeve(arm,[.026,.003,0],[-.10,-.195,.107],.075,.054);
  sleeve(arm,[-.10,-.195,.107],[-.125,-.060,.187],.054,.042);
  oval(arm,-.125,-.05,.201,.045,.051,.04,skin);
  legs.box(0,-.208,0,.13,.42,.15,'#4c5962');legs.box(0,-.58,0,.115,.36,.14,'#515c60');
  legs.box(0,-.772,.045,.135,.085,.24,'#514c46');
  const first=legs.bake('Walking leg'),second=first.clone(),gripping=arm.bake(tote?'Commuter sleeve':'Washington rider gripping arm');
  first.position.set(-.083,.817,0);second.position.set(.083,.817,0);gripping.position.set(-.195,1.28,0);
  root.add(torso.bake(tote?'Passenger carrying a canvas tote':'Passenger in a brimmed cap'),first,second,gripping);
  function stride(t:number,walking:boolean,grip:number){
    first.rotation.x=walking?.37*Math.sin(5.6*t):.014;second.rotation.x=-first.rotation.x;
    gripping.rotation.x=(1-grip)*1.18+(tote&&walking?.20*Math.sin(5.6*t):0);
  }
  return {root,stride};
}
