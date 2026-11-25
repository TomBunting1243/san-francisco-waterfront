import {CylinderGeometry,QuadraticBezierCurve3,Vector3} from 'three';
import type {StreetAssembly} from './street-amenities.ts';
import {fremontClockOffset} from './waterfront-signals.ts';

// SFMTA 9370500 / CNN 24527000 records an operating signal and pedestrian
// heads at all crossings, not shaft coordinates. 2017 KartaView 366261/2071
// shows the northbound mast beside Town Hall; the Howard westbound photographs
// show two separate far-side arms. Seats below are corner-landings registered
// to the 2024 city 8 cm ortho. Arm reaches and heights are photo estimates.
// https://kartaview.org/details/366261/2071/track-info
// https://data.sf.gov/resource/ybh5-27n2.json?cnn=24527000
function landing(u:number,v:number){
  // Seven pixels per metre, positive u along Howard eastbound and v down Fremont.
  return new Vector3(-28.766041+.001297019*(u-455)-.008473203*(v-245),.045,
    -30.979132+.008473203*(u-455)+.001297019*(v-245));
}
export const fremontPoles={ne:landing(391,140),nw:landing(266,135),sw:landing(252,303),se:landing(411,303)};
const north=new Vector3(.98849,0,-.15131),east=new Vector3(.15131,0,.98849),up=new Vector3(0,1,0);
type Pole=keyof typeof fremontPoles;
type Arm={pole:Pole;reach:number;along:Vector3;face:Vector3;axis:0|1;blade?:string};
const arms:Arm[]=[
  {pole:'ne',reach:5.8,along:east.clone().negate(),face:north.clone().negate(),axis:0,blade:'Howard'},
  {pole:'sw',reach:6.4,along:north,face:east,axis:1,blade:'Fremont'},
  {pole:'nw',reach:4.1,along:north.clone().negate(),face:east,axis:1},
];
function point(arm:Arm,reach:number,rise:number){
  return fremontPoles[arm.pole].clone().addScaledVector(arm.along,reach*.06).addScaledVector(up,rise*.06);
}
function head(p:Vector3,face:Vector3,axis:0|1){
  return {x:p.x,y:p.y-4.19*.06,z:p.z,heading:Math.atan2(face.x,face.z),axis,
    surveyed:true,mount:{offset:0,rise:0,shared:true},localClock:true as const};
}
const lowerRise=3.8,upperRise=5.72;
export const fremontVehicleHeads=[
  ...arms.flatMap(a=>[head(point(a,a.reach,upperRise),a.face,a.axis),head(point(a,.36,lowerRise),a.face,a.axis)]),
  head(fremontPoles.nw.clone().addScaledVector(up,lowerRise*.06).addScaledVector(east,.022),north.clone().negate(),0),
];
function pedestrian(from:Pole,to:Pole,parallelToFremont:boolean){
  const p=fremontPoles[from],q=fremontPoles[to];
  return {x:p.x,y:p.y,z:p.z,side:.028,angle:Math.atan2(q.x-p.x,q.z-p.z),
    clockOffset:fremontClockOffset+(parallelToFremont?38:0)};
}
export const fremontPedestrianHeads=[
  pedestrian('nw','ne',false),pedestrian('ne','nw',false),pedestrian('sw','se',false),pedestrian('se','sw',false),
  pedestrian('nw','sw',true),pedestrian('sw','nw',true),pedestrian('ne','se',true),pedestrian('se','ne',true),
];

export function addFremontStandards(a:StreetAssembly){
  const steel='#89918b';
  function tube(lo:Vector3,hi:Vector3,r:number,t:number){
    const d=hi.clone().sub(lo),mid=lo.clone().lerp(hi,.5);
    a.add(new CylinderGeometry(t,r,d.length(),8),steel,mid.x,mid.y,mid.z).quaternion.setFromUnitVectors(up,d.normalize());
  }
  for(const [id,p] of Object.entries(fremontPoles))
    tube(p,p.clone().addScaledVector(up,.06*(id==='se'?3.25:6.18)),.0075,.0042);
  for(const arm of arms){
    const arc=new QuadraticBezierCurve3(point(arm,0,4.48),point(arm,arm.reach*.62,6.32),point(arm,arm.reach,upperRise+.30));
    for(let i=0;i<5;i++)tube(arc.getPoint(i/5),arc.getPoint((i+1)/5),.0047-.00044*i,.00426-.00044*i);
    tube(point(arm,0,lowerRise),point(arm,.36,lowerRise),.0022,.0022);
    if(arm.blade){
      const ctr=point(arm,arm.reach-1.25,upperRise-.20),yaw=Math.atan2(arm.face.x,arm.face.z);
      for(const delta of [-.60,.60]){
        const reach=arm.reach-1.25+delta;
        tube(point(arm,reach,upperRise),arc.getPointAt(reach/arm.reach),.0012,.0012);
      }
      a.box(ctr.x,ctr.y,ctr.z,.095,.024,.0026,'#386250').rotation.y=yaw;
      ctr.addScaledVector(arm.face,.0015);
      a.label(arm.blade,ctr.x,ctr.y-.0053,ctr.z,.011,'#f3f0df',yaw);
    }
  }
  const p=fremontPoles.nw.clone().addScaledVector(up,lowerRise*.06);
  tube(p,p.clone().addScaledVector(east,.022),.0022,.0022);
}
