import * as THREE from 'three';
import {StreetAssembly,streetPassenger} from './street-amenities.ts';

// Local metres. From the red awning the room runs toward negative Z, with
// the Steuart Street display windows on the right. The operator's interior
// photograph establishes this arrangement, rather than a measured floor plan.
const corner=[-8.611,-7.807],other=[-8.462,-6.749];
const length=Math.hypot(other[0]-corner[0],other[1]-corner[1]);
const alongX=(other[0]-corner[0])/length,alongZ=(other[1]-corner[1])/length;
function museumFrame(){
  const frame=new THREE.Group();
  frame.position.set(corner[0]+.198*alongX,.068,corner[1]+.198*alongZ);
  frame.rotation.y=Math.atan2(alongZ,-alongX);
  frame.scale.setScalar(.06);
  return frame;
}
const cream='#ddd1ab',wine='#9a4142',wood='#835f49',caseTrim='#b4ab92';
function replica(){
  const a=new StreetAssembly();
  // Car 105 is a motorman's platform replica. Three faceted windshield bays
  // turn around a cream apron. Inside are the controller and brake stand.
  for(const [x,z,yaw,width] of [[-.83,-11.73,-.39,.57],[0,-11.62,0,1.14],[.83,-11.73,.39,.57]]){
    const c=Math.cos(yaw),s=Math.sin(yaw);
    function panel(u:number,y:number,d:number,w:number,h:number,depth:number,ink:string){
      const part=a.box(x+c*u+s*d,y,z-s*u+c*d,w,h,depth,ink);part.rotation.y=yaw;
    }
    panel(0,.57,0,width,1.10,.13,cream);panel(0,.16,.064,width,.095,.014,'#685344');
    for(const u of [-width/2+.033,width/2-.033])panel(u,1.61,0,.067,1.03,.11,wine);
    panel(0,1.09,.053,width,.083,.085,wine);
    panel(0,2.12,.015,width,.11,.14,wine);
    panel(0,2.276,0,width,.20,.16,cream);panel(0,2.408,0,width+.048,.094,.26,'#5d6355');
  }
  a.box(0,.28,-12.33,2.12,.13,1.18,'#766653');
  a.box(0,2.39,-12.27,2.14,.09,1.23,'#767763');
  for(const x of [-1.075,1.075])a.box(x,1.33,-12.79,.069,2.09,.07,wine);
  a.box(-.31,1.31,-12.16,.41,.55,.39,'#575b53');
  const wheel=a.add(new THREE.TorusGeometry(.205,.022,5,14),'#736343',.346,1.32,-12.10);
  wheel.rotation.x=-Math.PI*.35;
  a.box(.346,.94,-12.19,.06,.74,.065,'#665b48');
  a.label('105',0,.825,-11.539,.19,'#54473e');
  a.box(0,2.266,-11.521,.81,.126,.024,'#423e38');
  a.label('NO PASSENGERS',0,2.239,-11.505,.057,cream);
  return a.bake('Car 105 motorman platform exhibit');
}

export function addMuseumGallery(root:THREE.Group){
  const gallery=museumFrame();gallery.name='San Francisco Railway Museum gallery';root.add(gallery);
  const shell=new StreetAssembly(),displays=new StreetAssembly(),lamps=new StreetAssembly();
  // Steuart and the entrance are open to their actual cutouts in the external
  // wall. Use an opaque interior so both oblique views resolve the same room.
  shell.box(.22,-.047,-7.55,6.10,.09,15.18,'#a49c87');
  shell.box(.22,3.28,-7.55,6.10,.13,15.18,'#615e55');
  shell.box(-2.81,1.59,-7.55,.095,3.27,15.18,'#887b69');
  shell.box(.22,1.59,-15.08,6.10,3.27,.12,'#887b69');
  for(const z of [-1.0,-2.85,-4.7,-6.55,-8.4,-10.25]){
    const i=Math.round((-z-1)/1.85);
    displays.box(-2.73,1.53,z,.042,1.14,1.57,i%2?'#a19070':'#ab5549');
    displays.box(-2.694,1.66,z+.24,.025,.56,.78,'#d8ceae');
    for(const j of [-1,0,1])displays.box(-2.669,1.64+j*.105,z+.20,.013,.022,.59,'#776e60');
    displays.box(-2.694,1.42,z-.48,.025,.51,.37,'#484c46');
  }
  // Low archival cases separate the reading aisle from the gift shop. A
  // pair of scale models under the windows have their own roof and sash.
  for(const z of [-4.10,-7.12]){
    displays.box(.85,.47,z,1.01,.89,2.42,wood);
    displays.box(.85,.944,z,1.08,.08,2.49,caseTrim);
    for(const zz of [z-.55,z+.51]){
      const ink=zz>z?'#836044':'#8e4b42';
      displays.box(.85,1.026,zz,.23,.118,.76,cream);
      displays.box(.85,1.141,zz,.225,.112,.745,'#516461');
      for(const d of [-.36,-.23,-.075,.08,.235,.36])displays.box(.85,1.142,zz+d,.232,.115,.023,ink);
      displays.box(.85,1.212,zz,.263,.047,.79,cream);
      displays.box(.85,1.246,zz,.175,.029,.61,ink);
    }
    for(const x of [.35,1.35]){
      for(const zz of [z-1.19,z+1.19])displays.box(x,1.19,zz,.018,.43,.018,caseTrim);
      displays.box(x,1.405,z,.018,.018,2.40,caseTrim);
    }
    for(const zz of [z-1.19,z+1.19])displays.box(.85,1.405,zz,1.02,.018,.018,caseTrim);
  }
  for(const z of [-2.53,-5.70,-8.88]){
    displays.box(2.57,.405,z,.68,.76,1.72,'#897459');
    for(let i=0;i<5;i++){
      const col=['#a84c42','#ba9a64','#657f80','#c6b998','#7b776c'][i];
      displays.box(2.59,.91,z-.57+i*.27,.23,.26,.20,col);
    }
  }
  for(const z of [-2.31,-5.65,-9.06,-12.38]){
    shell.box(-.55,2.97,z,.021,.55,.021,'#43453e');
    shell.add(new THREE.ConeGeometry(.335,.25,12,1,true),'#826e55',-.55,2.62,z);
    lamps.add(new THREE.CylinderGeometry(.30,.295,.032,12),'#eedbb5',-.55,2.49,z);
  }
  const light=lamps.bake('Railway museum pendant diffusers');light.userData.signLight=[.28,.21,.11];
  gallery.add(shell.bake('Museum room and pendant shades'),displays.bake('Archive panels and streetcar display cases'),replica(),light);
}

// The operator publishes Tuesday–Sunday, noon to 5 pm. Pacific civil date is
// provided by the shared city clock. No date parsing is needed on moving frames.
export function museumReader(){
  const frame=museumFrame();frame.name='Railway museum exhibit reader';
  const visitor=streetPassenger('#71898a','#b8876c');frame.add(visitor.root);
  let lastDate:string|undefined,openDay=false;
  function update(elapsed:number,minutes:number,date?:string){
    if(date!==lastDate){
      lastDate=date;
      const weekday=date?new Date(date+'T12:00:00Z').getUTCDay():NaN;
      openDay=weekday===0||weekday>=2;
    }
    frame.visible=openDay&&minutes>=720&&minutes<1020;
    if(!frame.visible)return;
    // Walk down the clear aisle, pause before car 105, then turn back toward
    // the cases. Shoes follow the gallery floor throughout the loop.
    const phase=elapsed%38;
    const outbound=THREE.MathUtils.smootherstep(phase,3,11);
    const inbound=THREE.MathUtils.smootherstep(phase,23,31);
    const position=outbound-inbound;
    visitor.root.position.set(-.45,0,-4.83-position*4.95);
    const yaw=Math.PI*.50+Math.PI*.50*THREE.MathUtils.smootherstep(phase,1,3)
      -Math.PI*THREE.MathUtils.smootherstep(phase,20,23)+Math.PI*.50*THREE.MathUtils.smootherstep(phase,31,34);
    visitor.root.rotation.y=yaw;
    // streetPassenger advances its leg cycle by 5.6 radians per unit.
    visitor.stride(position*4.95*(2*Math.PI/(1.35*5.6)),(phase>3&&phase<11)||(phase>23&&phase<31));
  }
  return {frame,update};
}
