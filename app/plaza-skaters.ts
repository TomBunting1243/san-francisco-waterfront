import * as THREE from 'three';
import {StreetAssembly} from './street-amenities.ts';

// Trace of the open herringbone court in the pre-removal 2024 orthophoto.
// The art stalls run along its Market side and the fountain cuts its east end.
const circuit=new THREE.CatmullRomCurve3([[1.50,-8.63],[1.68,-8.36],[2.16,-8.32],
  [2.68,-8.54],[3.16,-8.69],[3.33,-8.86],[3.40,-9.18],[3.26,-9.40],
  [2.96,-9.48],[2.44,-9.36],[1.90,-9.08]].map(([x,z])=>new THREE.Vector3(x,0,z)),true,'centripetal');
const phase=[.04,.38,.73],speed=.19;
export function plazaSkaterPose(elapsed:number,index:number){
  const t=phase[index]+elapsed*speed/circuit.getLength(),u=t-Math.floor(t);
  const p=circuit.getPointAt(u),d=circuit.getTangentAt(u),next=circuit.getTangentAt((u+.004)%1);
  return {x:p.x,z:p.z,y:.127-.0012*(p.x-2)+.0008*(p.z+8),
    heading:-Math.atan2(d.z,d.x),lean:THREE.MathUtils.clamp((d.x*next.z-d.z*next.x)*1.8,-.18,.18),
    push:Math.max(0,Math.sin(elapsed*2.05+index*2.3))**3};
}

export function createPlazaSkaters(){
  const root=new THREE.Group();root.name='Embarcadero Plaza skateboarders';
  const riders=['#a05e44','#477576','#7c6a91'].map((coat,i)=>{
    const figure=new THREE.Group(),board=new StreetAssembly(),body=new StreetAssembly(),trailingLeg=new StreetAssembly();
    const skin=['#b58168','#976d51','#c79d77'][i],denim=['#53616b','#514f54','#606a69'][i],shoe='#e0d8bd';
    function limb(assembly:StreetAssembly,a:number[],b:number[],radius:number,color:string){
      const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),delta=to.clone().sub(from);
      const mid=from.lerp(to,.5);
      const part=assembly.add(new THREE.CylinderGeometry(radius*.82,radius,delta.length(),7),color,mid.x,mid.y,mid.z);
      part.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
    }
    const track='#555a53';
    board.box(0,.096,0,.63,.025,.21,'#725844');
    board.box(0,.113,0,.63,.013,.207,'#48534e');
    for(const side of [-1,1]){
      board.box(side*.346,.122,0,.104,.029,.194,'#79644a').rotation.z=side*.24;
      board.box(side*.245,.066,0,.064,.032,.139,track);
      for(const z of [-.088,.088])board.add(new THREE.CylinderGeometry(.031,.031,.031,8).rotateX(Math.PI/2),'#d3c39d',side*.245,.031,z);
    }
    const sphere=(x:number,y:number,z:number,w:number,h:number,d:number,color:string)=>
      body.add(new THREE.SphereGeometry(1,8,6).scale(w,h,d),color,x,y,z);
    sphere(.05,1.05,0,.16,.273,.193,coat).rotation.z=-.16;
    sphere(.113,1.434,0,.114,.139,.107,skin);
    sphere(.118,1.533,0,.117,.069,.110,i===1?'#58605c':'#55473e');
    body.box(.189,1.542,.006,.16,.024,.180,i===1?'#58605c':'#55473e');
    limb(body,[.043,.859,-.055],[.255,.55,-.060],.089,denim);
    limb(body,[.255,.55,-.060],[.174,.181,-.018],.073,denim);
    body.box(.184,.156,-.008,.143,.073,.187,shoe).rotation.y=.35;
    for(const side of [-1,1]){
      limb(body,[.072,1.208,side*.149],[.082,1.035,side*.249],.065,coat);
      limb(body,[.082,1.035,side*.249],[.12+side*.13,.956,side*.392],.045,skin);
    }
    limb(trailingLeg,[0,0,0],[-.19,-.335,.005],.087,denim);
    limb(trailingLeg,[-.19,-.335,.005],[-.155,-.655,-.02],.071,denim);
    trailingLeg.box(-.153,-.679,-.012,.145,.07,.18,shoe);
    const back=trailingLeg.bake('Trailing skate leg');
    back.position.set(-.041,.835,.045);
    const upper=new THREE.Group();upper.add(body.bake('Skater in low stance'),back);
    figure.add(board.bake('Skateboard with four wheels'),upper);
    figure.scale.setScalar(.06);figure.name='Plaza skater '+(i+1);root.add(figure);
    return {figure,upper,back};
  });
  function update(elapsed:number){
    for(const [i,{figure,upper,back}] of riders.entries()){
      const p=plazaSkaterPose(elapsed,i);
      figure.position.set(p.x,p.y,p.z);figure.rotation.y=p.heading;
      upper.rotation.x=p.lean*.53;upper.rotation.z=-.045*p.push;
      back.rotation.z=-.36*p.push;
    }
  }
  update(0);
  return {root,update};
}
