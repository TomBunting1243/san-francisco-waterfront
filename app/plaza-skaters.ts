import * as THREE from 'three';
import {medianTop} from './curb-survey.ts';
import {createStreetPaint,StreetAssembly} from './street-amenities.ts';

// City 2024 8 cm orthophoto and SFMTA island curb: this strip of granite
// sits between the northern Millennium Light's octagonal steps, the tree
// row on the track side and the bollards on the roadway side.
// Port inventory C3: https://www.sfport.com/media/9230/download
const circuit=new THREE.CatmullRomCurve3([[1.85,-4.59],[1.94,-4.77],[2.19,-4.91],[2.52,-4.88],
  [2.96,-4.74],[3.38,-4.65],[3.66,-4.54],[3.75,-4.42],[3.64,-4.32],
  [3.38,-4.30],[3.02,-4.38],[2.64,-4.41],[2.24,-4.31],[2.01,-4.33]]
  .map(([x,z])=>new THREE.Vector3(x,0,z)),true,'centripetal');
// The shorter return line stays inside the outer carves, with a separate
// turning pocket at each end. Their unequal lap times let riders pass.
const inside=new THREE.CatmullRomCurve3([[2.05,-4.57],[2.16,-4.73],[2.35,-4.77],[2.61,-4.73],
  [2.93,-4.65],[3.17,-4.60],[3.33,-4.55],[3.37,-4.50],[3.24,-4.47],[3.04,-4.51],
  [2.70,-4.53],[2.43,-4.48],[2.19,-4.45]].map(([x,z])=>new THREE.Vector3(x,0,z)),true,'centripetal');
const lines=[circuit,inside],speeds=[.19,.145],laps=lines.map((line,i)=>line.getLength()/speeds[i]);
const phase=[.05,.39,.72,.16,.51,.84],cadence=[3.3,3.68,3.12,3.84,3.42,3.58];
export const plazaSkaterCount=phase.length;
const point=new THREE.Vector3(),direction=new THREE.Vector3(),ahead=new THREE.Vector3();
const smooth=THREE.MathUtils.smoothstep;
export function plazaSkaterPose(elapsed:number,index:number){
  const lane=index<3?0:1,line=lines[lane];
  const u=THREE.MathUtils.euclideanModulo(phase[index]+elapsed/laps[lane],1);
  line.getPointAt(u,point);line.getTangentAt(u,direction);line.getTangentAt((u+.012)%1,ahead);
  const stride=THREE.MathUtils.euclideanModulo(elapsed/cadence[index]+phase[index]*2,1);
  // Step sideways off the deck, plant, propel backwards and recover. During
  // contact the foot travels backward at the rider’s own forward speed. Coast through the tightest ends of the run.
  const turn=direction.x*ahead.z-direction.z*ahead.x;
  const coast=smooth(Math.abs(turn),.20,.42);
  const reach=(1-coast)*smooth(stride,0,.085)*(1-smooth(stride,.29,.42));
  const drive=smooth(stride,.085,.14)*(1-smooth(stride,.22,.29));
  const push=smooth(reach,.72,.97)*drive;
  const stroke=THREE.MathUtils.clamp((stride-.14)/.08,0,1);
  return {x:point.x,z:point.z,y:medianTop,heading:-Math.atan2(direction.z,direction.x),
    lean:THREE.MathUtils.clamp(turn*.8,-.20,.20),push,soleHeight:.1195*(1-push)+.064*reach*(1-drive),footSide:reach*.245,footAlong:reach*(.29-speeds[lane]*cadence[index]*.08/.06*stroke)};
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
    m.boundingSphere=new THREE.Sphere(new THREE.Vector3(2.81,.09,-4.6),1.18);root.add(m);return m;
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
