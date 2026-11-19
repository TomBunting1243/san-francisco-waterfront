import * as THREE from 'three';
import {signalPeriod} from './waterfront-signals.ts';
import {medianTop} from './curb-survey.ts';
import {createStreetPaint,StreetAssembly} from './street-amenities.ts';

// Between the Millennium Light landings, the riders keep to the eastern
// edge while people gather. After the crossing parties return to the curb,
// the long carves run back across their paths on the same granite.
const promenade=new THREE.CatmullRomCurve3([[-.17,-5.06],[-.12,-5.16],[-.07,-5.18],[-.074,-5.06],
  [-.070,-4.83],[-.052,-4.55],[-.060,-4.38],[-.061,-4.31],[-.107,-4.34],[-.145,-4.56],
  [-.177,-4.86]].map(([x,z])=>new THREE.Vector3(x-.028*(1-THREE.MathUtils.smoothstep(z,-4.79,-4.60)),0,z)),true,'centripetal');
const island=new THREE.CatmullRomCurve3([[.026,-4.84],[.048,-4.62],[.061,-4.42],[.135,-4.35],
  [.161,-4.40],[.16,-4.56],[.136,-4.79],[.105,-4.99],[.068,-5.09],[.024,-4.99]]
  .map(([x,z])=>new THREE.Vector3(x-.028*(1-THREE.MathUtils.smoothstep(z,-4.79,-4.60)),0,z)),true,'centripetal');
const lines=[promenade,island],laps=[signalPeriod/6,signalPeriod/5];
const speeds=lines.map((line,i)=>line.getLength()/laps[i]);
// This interval follows the two signal-controlled parties in plaza-walkers.
function clearCrossing(elapsed:number){
  const t=THREE.MathUtils.euclideanModulo(elapsed,signalPeriod);
  return -.81*THREE.MathUtils.smoothstep(t,30,40)*(1-THREE.MathUtils.smoothstep(t,45,54));
}
const phase=[.05,.39,.72,.16,.51,.84],cadence=[3.3,3.68,3.12,3.84,3.42,3.58];
export const plazaSkaterCount=phase.length;
const point=new THREE.Vector3(),direction=new THREE.Vector3(),ahead=new THREE.Vector3();
const smooth=THREE.MathUtils.smoothstep;
export function plazaSkaterPose(elapsed:number,index:number){
  const lane=index<3?0:1,line=lines[lane];
  const u=THREE.MathUtils.euclideanModulo(phase[index]+elapsed/laps[lane],1);
  line.getPointAt(u,point);line.getTangentAt(u,direction);line.getTangentAt((u+.012)%1,ahead);
  const offset=clearCrossing(elapsed),drift=(clearCrossing(elapsed+.025)-clearCrossing(elapsed-.025))/.05;
  point.x+=offset;
  direction.multiplyScalar(speeds[lane]);direction.x+=drift;
  const speed=direction.length();direction.normalize();
  ahead.multiplyScalar(speeds[lane]);ahead.x+=drift;ahead.normalize();
  const stride=THREE.MathUtils.euclideanModulo(elapsed/cadence[index]+phase[index]*2,1);
  // Step sideways off the deck, plant, propel backwards and recover. During
  // contact the foot travels backward at the rider’s own forward speed. Coast through the tightest ends of the run.
  const turn=direction.x*ahead.z-direction.z*ahead.x;
  const coast=smooth(Math.abs(turn),.20,.42);
  const reach=(1-coast)*smooth(stride,0,.085)*(1-smooth(stride,.29,.42));
  const drive=smooth(stride,.085,.14)*(1-smooth(stride,.22,.29));
  const push=smooth(reach,.72,.97)*drive;
  const stroke=THREE.MathUtils.clamp((stride-.14)/.08,0,1);
  return {x:point.x,z:point.z,y:medianTop+.00035,heading:-Math.atan2(direction.z,direction.x),
    lean:THREE.MathUtils.clamp(turn*.8,-.20,.20),push,soleHeight:.1195*(1-push)+.064*reach*(1-drive),footSide:reach*.245,footAlong:reach*(.29-speed*cadence[index]*.08/.06*stroke)};
}

export function createPlazaSkaters(material=createStreetPaint()){
  const root=new THREE.Group();root.name='Harry Bridges Plaza skateboarders';
  const silhouettes=['#a05e44','#477576','#7c6a91'].map((coat,i)=>{
    const board=new StreetAssembly(),body=new StreetAssembly(),trailingLeg=new StreetAssembly();
    const skin=['#b58168','#976d51','#c79d77'][i],denim=['#53616b','#514f54','#606a69'][i],shoe='#e0d8bd';
    function limb(assembly:StreetAssembly,a:number[],b:number[],radius:number,color:string){
      const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),delta=to.clone().sub(from);
      const mid=from.lerp(to,.5);
      const part=assembly.add(new THREE.CylinderGeometry(radius*.82,radius,delta.length(),7,1,color===denim),color,mid.x,mid.y,mid.z);
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
    sphere(.05,1.05,0,.16,.273,.193,coat).rotation.z=[-.16,-.25,-.08][i];
    sphere(.113,1.434,0,.114,.139,.107,skin);
    sphere(.118,1.533,0,.117,.069,.110,i===1?'#58605c':'#55473e');
    body.box(.189,1.542,.006,.16,.024,.180,i===1?'#58605c':'#55473e');
    limb(body,[.043,.859,-.055],[.255,.55,-.060],.089,denim);
    limb(body,[.255,.55,-.060],[.174,.181,-.018],.073,denim);
    board.box(.184,.156,-.008,.143,.073,.187,shoe).rotation.y=.35;
    for(const side of [-1,1]){
      const hand=i===1?.09*side:i===2?-.11:0;
      limb(body,[.072,1.208,side*.149],[.082,1.035,side*.249],.065,coat);
      limb(body,[.082,1.035,side*.249],[.12+side*.13+hand,.956+hand,side*(.392+hand*.3)],.045,skin);
    }
    limb(trailingLeg,[0,0,0],[-.19,-.335,.005],.087,denim);
    limb(trailingLeg,[-.19,-.335,.005],[-.155,-.655,-.02],.071,denim);
    trailingLeg.box(-.153,-.679,-.012,.145,.07,.18,shoe);
    return {board:board.bake('Deck',material).geometry,upper:body.bake('Stance',material).geometry,
      back:trailingLeg.bake('Push leg',material).geometry};
  });
  function batch(geometry:THREE.BufferGeometry,name:string,count:number){
    const m=new THREE.InstancedMesh(geometry,material,count);m.name=name;m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.boundingSphere=new THREE.Sphere(new THREE.Vector3(-.39,.09,-4.75),.82);root.add(m);return m;
  }
  const boards=batch(silhouettes[0].board,'Skateboards with four wheels',plazaSkaterCount);
  const legs=batch(silhouettes[0].back,'Trailing skate legs',plazaSkaterCount);
  const stances=silhouettes.map(({upper},i)=>batch(upper,'Skater stance '+i,2));
  for(const {board,back} of silhouettes.slice(1)){board.dispose();back.dispose();}
  // Preserve vertex paint on skin, clothes and deck in the shared weather
  // material. Small warm/cool tints distinguish the two riders of each build.
  const inks=['#ffffff','#ffffff','#ffffff','#e9f7ee','#f5e4da','#e6ecf6'].map(v=>new THREE.Color(v));
  for(let i=0;i<plazaSkaterCount;i++){
    stances[i%3].setColorAt(Math.floor(i/3),inks[i]);legs.setColorAt(i,inks[i]);
  }
  const base=new THREE.Matrix4(),stance=new THREE.Matrix4(),leg=new THREE.Matrix4(),pose=new THREE.Object3D();
  const pivot=new THREE.Matrix4().makeTranslation(0,-.16,0);
  let previous=NaN;
  function update(elapsed:number){
    if(elapsed===previous)return;previous=elapsed;
    for(let i=0;i<plazaSkaterCount;i++){
      const p=plazaSkaterPose(elapsed,i),c=Math.cos(p.heading)*.06,s=Math.sin(p.heading)*.06;
      base.set(c,0,s,p.x, 0,.06,0,p.y, -s,0,c,p.z, 0,0,0,1);
      boards.setMatrixAt(i,base);
      pose.position.y=.16;pose.rotation.set(p.lean*.53,0,-.045*p.push);pose.updateMatrix();
      stance.multiplyMatrices(base,pose.matrix).multiply(pivot);
      stances[i%3].setMatrixAt(Math.floor(i/3),stance);
      leg.set(1,-p.footAlong/.679,0,-.041, 0,(.835-p.soleHeight)/.714,0,.835,
        0,-p.footSide/.679,1,.045, 0,0,0,1).premultiply(base);
      legs.setMatrixAt(i,leg);
    }
    for(const m of root.children as THREE.InstancedMesh[])m.instanceMatrix.needsUpdate=true;
  }
  update(0);
  return {root,update,material};
}
