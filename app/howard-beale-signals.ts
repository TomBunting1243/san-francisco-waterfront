import {CylinderGeometry,QuadraticBezierCurve3,Vector3} from 'three';
import {howardBealePlate} from './howard-beale-through.ts';
import type {StreetAssembly} from './street-amenities.ts';

// SFMTA controller 9206000. The 2021 Jessica Christian photograph shows a
// shaft-mounted eastbound ball below a Beale blade outside Park Tower. The
// southbound Howard mast, its lower repeater and street blade appear together
// in JackPav's KartaView 10052/1849, consistent with ET-10.0 existing pole 5.
// SFPUC 296178 and 298836 are point records; seat within 1 m of each on its
// actual corner landing. The simulated green split uses the common city clock.
const up=new Vector3(0,1,0),east=new Vector3(.15131,0,.98849),north=new Vector3(.98849,0,-.15131);
function landing(u:number,v:number){
  const [x,z]=howardBealePlate(u,v);return new Vector3(x,.045,z);
}
export const bealePoles={park:landing(950,127),southwest:landing(808,321)};
function station(p:Vector3,along:Vector3,reach:number,rise:number){
  return p.clone().addScaledVector(along,reach*.06).addScaledVector(up,rise*.06);
}
const west=east.clone().negate(),park=bealePoles.park,sw=bealePoles.southwest;
function head(point:Vector3,face:Vector3,axis:0|1){
  return {x:point.x,y:point.y-4.19*.06,z:point.z,heading:Math.atan2(face.x,face.z),axis,
    mount:{offset:0,rise:0,shared:true},surveyed:true};
}
const parkHead=station(park,north,.36,4.28),armHead=station(sw,east,9.14,5.72),lowHead=station(sw,east,.38,3.82);
export const bealeVehicleHeads=[head(parkHead,west,0),head(armHead,north,1),head(lowHead,north,1)];
function ped(p:Vector3,face:Vector3,clockOffset:number){
  return {x:p.x,y:p.y,z:p.z,side:.028,angle:Math.atan2(face.x,face.z),clockOffset};
}
export const bealePedestrianHeads=[ped(park,west,38),ped(sw,east,38),ped(sw,north,0)];

const lamps=([[park,west,8.1],[sw,east,8.35]] as const).map(([base,dir,height])=>({
  base,dir,height,tip:station(base,dir,1.82,height+.34)
}));

export function addBealeStandards(a:StreetAssembly){
  const steel='#909692';
  function tube(from:Vector3,to:Vector3,r:number,t=r){
    const d=to.clone().sub(from),mid=from.clone().lerp(to,.5);
    a.add(new CylinderGeometry(t*.06,r*.06,d.length(),8),steel,mid.x,mid.y,mid.z).quaternion.setFromUnitVectors(up,d.normalize());
  }
  function blade(center:Vector3,face:Vector3,word:string){
    const yaw=Math.atan2(face.x,face.z);
    a.box(center.x,center.y,center.z,.105,.026,.003,'#35634f').rotation.y=yaw;
    const text=center.clone().addScaledVector(face,.0017);
    a.label(word,text.x,text.y-.005,text.z,.012,'#f0f0da',yaw);
  }
  tube(park,station(park,north,0,8.1),.154,.103);
  tube(sw,station(sw,east,0,8.35),.167,.102);
  tube(station(park,north,0,4.28),parkHead,.044);
  tube(station(sw,east,0,3.82),lowHead,.044);
  const curve=new QuadraticBezierCurve3(station(sw,east,0,4.90),station(sw,east,5.1,6.53),station(sw,east,9.14,6.04));
  for(let i=0;i<5;i++)tube(curve.getPoint(i/5),curve.getPoint((i+1)/5),.105-.011*i,.094-.011*i);
  tube(station(sw,east,9.14,6.04),armHead,.039);
  const panel=station(sw,east,6.47,5.38);
  for(const reach of [5.8,7.1])tube(station(sw,east,reach,5.59),curve.getPointAt(reach/9.14),.017);
  blade(panel,north,'Howard');
  blade(station(park,west,.17,5.9),west,'Beale');
  // Each photograph also shows the short luminaire arm above the signal.
  for(const {base,dir,height,tip} of lamps){
    tube(station(base,dir,0,height-.28),tip,.053,.032);
    const m=a.box(tip.x,tip.y,tip.z,.020,.007,.038,'#9b9f95');m.rotation.y=Math.atan2(dir.x,dir.z);
    const lens=a.box(tip.x,tip.y-.004,tip.z,.016,.002,.030,'#ddd6b9');
    lens.rotation.y=m.rotation.y;
  }
  return lamps.map(({tip})=>new Vector3(tip.x,tip.y-.005,tip.z));
}
